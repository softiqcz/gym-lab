import { NumberControl, Timer } from "./Controls";
import { elapsed, type Active } from "../types";
type Exercise = {
  id: string;
  name: string;
  sets: number;
  unit: string;
  targetReps: string;
  loadType: string;
  tutorialUrl: string;
};
export default function WorkoutExercise({
  active,
  exercise,
  progress,
  nextExercise,
  total,
  now,
  onChange,
  onPause,
}: {
  active: Active;
  exercise: Exercise;
  progress: number;
  nextExercise?: { name: string; load: string };
  total: number;
  now: number;
  onChange: (active: Active) => void;
  onPause: () => void;
}) {
  const resting = active.restStartedAt !== null;
  const transitioning = active.phase === "transition";
  const finishing = transitioning && active.exerciseIndex === total - 1;
  const action = finishing
    ? "FINISH WORKOUT"
    : transitioning
      ? "START NEXT EXERCISE"
      : resting
        ? "START SET"
        : "START REST";
  const showNext =
    !!nextExercise &&
    (transitioning ||
      (!resting && active.setReps.length === exercise.sets - 1));
  const seconds = elapsed(
    resting ? active.restStartedAt! : active.setStartedAt,
    now,
  );
  return (
    <section className="workout-layout">
      <div className="workout-context">
        <div className="day-progress">
          <div>
            <strong>{progress}%</strong>
          </div>
          <progress
            aria-label="Overall workout progress"
            max={100}
            value={progress}
          />
        </div>
        <h1 className="exercise-title">
          <a
              href={exercise.tutorialUrl}
              target="_blank"
              rel="noopener noreferrer"
          >
            {exercise.name}</a></h1>
        <div className="next-exercise-slot">
          <aside
            className={showNext ? "next-exercise" : "next-exercise is-hidden"}
            aria-label="Next exercise"
            aria-hidden={!showNext}
          >
            <span className="eyebrow">UP NEXT</span>
            <strong>{nextExercise?.name ?? " "}</strong>
            <span className="next-load">{nextExercise?.load ?? " "}</span>
          </aside>
        </div>
      </div>
      <div className="workout-controls">
        <div className="workout-numbers">
          <div>
            <NumberControl
              label={exercise.loadType === "position" ? "POSITION" : "KG"}
              value={active.weight}
              step={exercise.loadType === "position" ? 1 : 2}
              onChange={(weight) => onChange({ ...active, weight })}
            />
            {exercise.loadType === "position" && (
              <button
                className="direction"
                onClick={() =>
                  onChange({
                    ...active,
                    positionDirection:
                      active.positionDirection === "DOWN" ? "UP" : "DOWN",
                  })
                }
              >
                POSITION DIRECTION · {active.positionDirection} ↕
              </button>
            )}
          </div>
          <NumberControl
            label={exercise.unit}
            value={active.reps}
            onChange={(reps) => onChange({ ...active, reps })}
          />
        </div>
        <div className="set-row">
          <span className="eyebrow">
            {finishing
              ? "FINAL REST"
              : transitioning
                ? "RESTING · NEXT EXERCISE"
                : resting
                  ? "RESTING · NEXT SET"
                  : "CURRENT SET"}
          </span>
          <strong>
            {transitioning ? exercise.sets : active.setReps.length + 1}
            <span> / {exercise.sets}</span>
          </strong>
        </div>
        <button className="primary pause" onClick={onPause}>
          {action}
          <span>→</span>
        </button>
      </div>
      <div className="workout-timing">
        <div className="active-timer">
          <Timer
            label={resting ? "REST" : "SET"}
            seconds={seconds}
            warning={seconds >= 69}
          />
        </div>
      </div>
    </section>
  );
}
