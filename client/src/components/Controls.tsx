import { time } from "../types";
export function NumberControl({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="number-control">
      <button
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(0, value - step))}
      >
        −
      </button>
      <label>
        <input
          aria-label={label}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0) onChange(n);
          }}
        />
        <span>{label}</span>
      </label>
      <button
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Number((value + step).toFixed(2)))}
      >
        +
      </button>
    </div>
  );
}
export function Timer({
  label,
  seconds,
  warning = false,
}: {
  label: string;
  seconds: number;
  warning?: boolean;
}) {
  return (
    <div className={warning ? "timer warning" : "timer"}>
      <span className="eyebrow">{label}</span>
      <strong>{time(seconds)}</strong>
    </div>
  );
}
