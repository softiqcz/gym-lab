import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export type BodyWeight = { id: string; date: string; kg: number };
export function validateReading(value: unknown): asserts value is BodyWeight {
  const r = value as BodyWeight;
  if (!r || typeof r.id !== 'string' || !r.id || typeof r.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      Number.isNaN(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date ||
      typeof r.kg !== 'number' || !Number.isFinite(r.kg) || r.kg <= 0 || r.kg > 1000)
    throw Object.assign(new Error('Enter a valid date and weight between 0 and 1000 kg.'), { status: 400 });
}
export function makeBodyWeightStore(path: string, seedPath: string) {
  let queue = Promise.resolve();
  async function read(): Promise<BodyWeight[]> {
    try {
      const records = JSON.parse(await readFile(path, 'utf8')) as BodyWeight[];
      if (!Array.isArray(records)) throw new Error('Invalid body-weight history');
      records.forEach(validateReading);
      return records;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const seed = await readFile(seedPath, 'utf8');
      const records = JSON.parse(seed) as BodyWeight[];
      records.forEach(validateReading);
      await mkdir(dirname(path), { recursive: true });
      try { await writeFile(path, seed, { flag: 'wx' }); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
      return read();
    }
  }
  async function append(reading: BodyWeight) {
    validateReading(reading);
    const operation = queue.then(async () => {
      const records = await read();
      const existing = records.find(r => r.id === reading.id);
      if (existing) {
        if (existing.date !== reading.date || existing.kg !== reading.kg)
          throw Object.assign(new Error('This reading ID already exists.'), { status: 409 });
        return records;
      }
      const next = [...records, reading];
      const temp = path + '.' + randomUUID() + '.tmp';
      await writeFile(temp, JSON.stringify(next, null, 2) + '\n');
      await rename(temp, path);
      return next;
    });
    queue = operation.then(() => {}, () => {});
    return operation;
  }
  return { read, append };
}
