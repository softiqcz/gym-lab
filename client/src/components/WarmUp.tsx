import { elapsed, time, type Active } from "../types";
export default function WarmUp({
  active,
  name,
  firstExercise,
  now,
  onReady,
}: {
  active: Active;
  name: string;
  firstExercise: string;
  now: number;
  onReady: () => void;
}) {
  return (
    <section className="warmup-layout">
      <div className="warmup-intro">
        <p className="eyebrow">BEFORE YOU BEGIN</p>
        <h1>Warm up</h1>
        <h2>{name}</h2>
      </div>
      <div className="warmup-action">
        <span className="eyebrow">WARM-UP TIME</span>
        <div className="warmup-time">
          {time(elapsed(active.startedAt, now))}
        </div>
        <div className="warmup-next">
          <span className="eyebrow">UP NEXT</span>
          <strong>{firstExercise}</strong>
        </div>
        <button className="primary" onClick={onReady}>
          START {active.activityId ? "ACTIVITY" : "FIRST EXERCISE"}{" "}
          <span>→</span>
        </button>
        <p className="keyboard-hint">
          ENTER / SPACE · START{" "}
          {active.activityId ? "ACTIVITY" : "FIRST EXERCISE"}
        </p>
      </div>
    </section>
  );
}
