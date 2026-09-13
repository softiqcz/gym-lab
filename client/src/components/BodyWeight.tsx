import { useEffect, useRef, useState } from 'react';
import { localDate } from '../types';
type Reading = { id: string; date: string; kg: number };
const CACHE = 'gym-body-weight-cache';
const PENDING = 'gym-body-weight-pending';
function readLocal(key: string): Reading[] {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function combine(records: Reading[], pending: Reading[]) {
  return [...records, ...pending.filter(p => !records.some(r => r.id === p.id))]
    .sort((a, b) => a.date.localeCompare(b.date));
}
const dateLabel = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export default function BodyWeight() {
  const pending = useRef(readLocal(PENDING));
  const busy = useRef(false);
  const [records, setRecords] = useState(() => combine(readLocal(CACHE), pending.current));
  const [ready, setReady] = useState(false);
  const [kg, setKg] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  async function sync() {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch('/api/body-weight', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load body-weight history. Retrying shortly.');
      let remote = await response.json() as Reading[];
      for (const reading of [...pending.current]) {
        const saved = await fetch('/api/body-weight', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reading),
        });
        if (!saved.ok) throw new Error('Weight saved on this device. Waiting to sync.');
        remote = await saved.json() as Reading[];
        const remaining = pending.current.filter(r => r.id !== reading.id);
        localStorage.setItem(PENDING, JSON.stringify(remaining));
        pending.current = remaining;
      }
      localStorage.setItem(CACHE, JSON.stringify(remote));
      setRecords(combine(remote, pending.current));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof TypeError ? 'Server unavailable. Cached weight shown; saves will retry.' : (error as Error).message);
    } finally { busy.current = false; setReady(true); }
  }
  useEffect(() => {
    void sync();
    const refresh = () => { void sync(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  function save() {
    if (kg === null) return;
    const value = Math.round(Number(kg.replace(',', '.')) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0 || value > 1000) {
      setMessage('Enter a valid weight between 0 and 1000 kg.'); return;
    }
    if (value === records.at(-1)?.kg) { setKg(null); return; }
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
    const reading = { id, date: localDate(), kg: value };
    const next = [...pending.current, reading];
    try { localStorage.setItem(PENDING, JSON.stringify(next)); }
    catch { setMessage('Device storage unavailable. Weight was not saved; please try again.'); return; }
    pending.current = next;
    setRecords(current => combine(current, next));
    setKg(null);
    setSelected(null);
    setMessage('Weight saved on this device. Syncing…');
    void sync();
  }
  const latest = records.at(-1);
  const chosen = records.find(r => r.id === selected) ?? latest;
  const width = 600, height = 110, inset = 12;
  const low = Math.min(...records.map(r => r.kg)), high = Math.max(...records.map(r => r.kg));
  const firstTime = records.length ? Date.parse(records[0].date) : 0;
  const lastTime = latest ? Date.parse(latest.date) : 0;
  const x = (r: Reading) => records.length === 1 ? width / 2 : inset + (Date.parse(r.date) - firstTime) / (lastTime - firstTime || 1) * (width - inset * 2);
  const y = (r: Reading) => high === low ? height / 2 : height - inset - (r.kg - low) / (high - low) * (height - inset * 2);
  return <section className="body-weight-panel" aria-label="Body weight progress">
    <div className="body-weight-current">
      <h2 className="eyebrow">BODY WEIGHT</h2>
      <div className="body-weight-input-row">
        <input aria-label="Body weight in kilograms" inputMode="decimal" disabled={!ready}
          value={kg ?? latest?.kg.toFixed(2) ?? ''} placeholder="—"
          onChange={event => setKg(event.target.value)} onBlur={save}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}/>
        <span>KG</span>
      </div>
      <p>{latest ? `Recorded ${dateLabel(latest.date)}` : ready ? 'Add your first reading' : 'Loading weight…'}</p>
    </div>
    <div className="body-weight-chart">
      {records.length > 0 && <>
        <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Body weight over time">
          <polyline points={records.map(r => `${x(r)},${y(r)}`).join(' ')} fill="none" stroke="white" strokeWidth="2"/>
          {records.map(r => <g key={r.id} role="button" tabIndex={0} aria-label={`${r.kg.toFixed(2)} kg on ${dateLabel(r.date)}`} onClick={() => setSelected(r.id)} onFocus={() => setSelected(r.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(r.id); } }}>
            <circle cx={x(r)} cy={y(r)} r="12" fill="transparent"/>
            <circle cx={x(r)} cy={y(r)} r={chosen?.id === r.id ? 5 : 3} fill="white"/>
          </g>)}
        </svg>
        <div className="body-weight-chart-caption"><span>{dateLabel(records[0].date)}</span><span>{chosen?.kg.toFixed(2)} KG · {chosen && dateLabel(chosen.date)}</span></div>
      </>}
    </div>
    {message && <p className="body-weight-message" role="status">{message}</p>}
  </section>;
}
