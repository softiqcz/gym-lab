import { useState } from "react";
import definitions from "../data/workouts.json";
import exercises from "../data/exercises.json";
import {
  time,
  type History as HistoryData,
  type WorkoutRecord,
  type Result,
} from "../types";
const name = (id: string) =>
  (
    definitions.find((w) => w.id === id)?.name ?? id.replaceAll("-", " ")
  ).replaceAll(" + ", " ");
const date = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
const canonical = (id: string) =>
  exercises.find((e) => "historyIds" in e && e.historyIds?.includes(id))?.id ??
  id;
export function progression(history: HistoryData, id: string) {
  return history.workouts
    .flatMap((w, index) =>
      w.exercises
        .filter((r) => canonical(r.exerciseId) === canonical(id))
        .map((r) => ({ date: w.date, result: r, index })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
}
type Point = { date: string; value: number; label: string };
function Graph({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: Point[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const chosen = points[hover ?? points.length - 1];
  const max = Math.max(1, ...points.map((p) => p.value));
  const upper = Math.ceil(max * 1.15);
  const width = 400,
    height = 190,
    left = 40,
    right = 16,
    top = 16,
    bottom = 34;
  const x = (i: number) =>
    points.length === 1
      ? (left + width - right) / 2
      : left + (i / (points.length - 1)) * (width - left - right);
  const y = (v: number) =>
    height - bottom - (v / upper) * (height - top - bottom);
  return (
    <section className="progress-graph">
      <div className="graph-heading">
        <span className="eyebrow">{title}</span>
        <span>{chosen ? `${chosen.value} ${unit}` : "—"}</span>
      </div>
      {points.length ? (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={`${title} over time. ${points.map((p) => `${date(p.date)}: ${p.value} ${unit}`).join("; ")}`}
          >
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(upper * f)}
                  y2={y(upper * f)}
                  stroke="#333"
                  strokeDasharray={f ? "3 5" : undefined}
                />
                <text
                  x={left - 10}
                  y={y(upper * f) + 4}
                  textAnchor="end"
                  fill="#888"
                  fontSize="14"
                >
                  {Number((upper * f).toFixed(1))}
                </text>
              </g>
            ))}
            <polyline
              fill="none"
              stroke="white"
              strokeWidth="2"
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
            />
            {points.map((p, i) => (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`${date(p.date)} ${p.date.slice(0, 4)} · ${p.label}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setHover(i);
                  }
                }}
              >
                <circle cx={x(i)} cy={y(p.value)} r="22" fill="transparent" />
                <circle
                  cx={x(i)}
                  cy={y(p.value)}
                  r={hover === i ? 6 : 4}
                  fill="white"
                  stroke="#080808"
                  strokeWidth="2"
                />
              </g>
            ))}
            <text x={left} y={height - 8} fill="#999" fontSize="14">
              {date(points[0].date)}
            </text>
            {points.length > 1 && (
              <text
                x={width - right}
                y={height - 8}
                fill="#999"
                textAnchor="end"
                fontSize="14"
              >
                {date(points.at(-1)!.date)}
              </text>
            )}
          </svg>
          <p className="graph-caption">
            {chosen
              ? `${date(chosen.date)} ${chosen.date.slice(0, 4)} · ${chosen.label}`
              : ""}
          </p>
        </>
      ) : (
        <p className="graph-empty">
          No recorded {title.toLowerCase()} for this exercise.
        </p>
      )}
    </section>
  );
}
function loadLabel(r: Result) {
  return r.weight !== undefined
    ? `${r.weight} KG`
    : r.position !== undefined
      ? `POS ${r.position} ${r.positionDirection ?? ""}`
      : "BODYWEIGHT";
}
export function Progression({
  history,
  exerciseId,
}: {
  history: HistoryData;
  exerciseId: string;
}) {
  const records = progression(history, exerciseId);
  const latest = records.at(-1)?.result;
  const timed = exerciseId === "plank";
  const positionOnly =
    latest?.weight === undefined &&
    records.some((r) => r.result.position !== undefined);
  const directions = Array.from(
    new Set(
      records
        .filter((r) => r.result.position !== undefined)
        .map((r) => r.result.positionDirection ?? "UNSPECIFIED"),
    ),
  );
  const points = (metric: (r: Result) => number | undefined) =>
    records.flatMap((r) => {
      const value = metric(r.result);
      return value === undefined
        ? []
        : [
            {
              date: r.date,
              value,
              label: `${loadLabel(r.result)} × ${r.result.averageReps}${timed ? " SEC" : " REPS"}`,
            },
          ];
    });
  return (
    <>
      <div className="progress-summary">
        <div>
          <span className="eyebrow">LATEST RESULT</span>
          <strong>
            {latest ? loadLabel(latest) : "—"}
            <span>
              {" "}
              × {latest?.averageReps ?? "—"}
              {timed ? " SEC" : ""}
            </span>
          </strong>
        </div>
        <span className="eyebrow">{records.length} RECORDS</span>
      </div>
      <div className="exercise-graphs">
        {positionOnly ? (
          directions.map((direction) => (
            <Graph
              key={direction}
              title={`Machine position · ${direction}`}
              unit="POS"
              points={points((r) =>
                r.positionDirection === direction ||
                (direction === "UNSPECIFIED" && !r.positionDirection)
                  ? r.position
                  : undefined,
              )}
            />
          ))
        ) : (
          <Graph title="Weight" unit="KG" points={points((r) => r.weight)} />
        )}
        <Graph
          title={timed ? "Average hold" : "Average reps"}
          unit={timed ? "SEC" : "REPS"}
          points={points((r) => r.averageReps)}
        />
      </div>
      <div className="progress-records">
        <div className="section-label">
          <span className="eyebrow">EVERY RESULT</span>
          <span className="eyebrow">NEWEST FIRST</span>
        </div>
        {[...records].reverse().map((r, i) => (
          <div className="progress-record" key={i}>
            <span>
              {date(r.date)}
              <small>{r.date.slice(0, 4)}</small>
            </span>
            <strong>
              {loadLabel(r.result)} × {r.result.averageReps}
              {timed ? " SEC" : ""}
            </strong>
          </div>
        ))}
        {!records.length && <p className="muted">No results recorded yet.</p>}
      </div>
    </>
  );
}
export default function History({
  history,
  loaded,
  onWorkout,
}: {
  history: HistoryData;
  loaded: boolean;
  onWorkout: (record: WorkoutRecord) => void;
}) {
  const choices = Array.from(
    new Set(
      history.workouts.flatMap((w) =>
        w.exercises.map((r) => canonical(r.exerciseId)),
      ),
    ),
  );
  const [exercise, setExercise] = useState("one-arm-dumbbell-row");
  const selected = choices.includes(exercise) ? exercise : (choices[0] ?? "");
  const logs = [
    ...history.workouts.map((w, index) => ({
      date: w.date,
      index,
      w,
      a: undefined,
    })),
    ...(history.activities ?? []).map((a, index) => ({
      date: a.date,
      index,
      w: undefined,
      a,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);
  return (
    <section className="history-page">
      <div className="history-heading">
        <div>
          <p className="eyebrow">YOUR TRAINING LOG</p>
          <h1>History</h1>
        </div>
      </div>
      {!loaded ? (
        <p className="muted">Loading history…</p>
      ) : !logs.length ? (
        <p className="muted">Your completed workouts will appear here.</p>
      ) : (
        <div className="history-layout">
          <section className="session-log">
            <div className="section-label">
              <span className="eyebrow">SESSIONS</span>
              <span className="eyebrow">NEWEST FIRST</span>
            </div>
            {logs.map(({ w, a, index }, i) =>
              w ? (
                <button
                  className="history-row"
                  key={`w${index}`}
                  onClick={() => onWorkout(w)}
                >
                  <span className="history-date">
                    {date(w.date)}
                    <small>{w.date.slice(0, 4)}</small>
                  </span>
                  <span className="history-name">
                    {name(w.workoutId)}
                    <small>
                      {w.durationSeconds === null
                        ? "DURATION NOT RECORDED"
                        : time(w.durationSeconds)}
                    </small>
                  </span>
                  <span>↗</span>
                </button>
              ) : (
                <div className="history-row" key={`a${i}`}>
                  <span className="history-date">
                    {date(a!.date)}
                    <small>{a!.date.slice(0, 4)}</small>
                  </span>
                  <span className="history-name">
                    {a!.activityId}
                    <small>ACTIVITY · {time(a!.durationSeconds)}</small>
                  </span>
                </div>
              ),
            )}
          </section>
          <section className="history-progression">
            <div className="section-label">
              <label htmlFor="history-exercise" className="eyebrow">
                EXERCISE PROGRESSION
              </label>
            </div>
            {choices.length ? (
              <>
                <select
                  id="history-exercise"
                  value={selected}
                  onChange={(e) => setExercise(e.target.value)}
                >
                  {choices.map((id) => (
                    <option key={id} value={id}>
                      {exercises.find((e) => e.id === id)?.name ??
                        id.replaceAll("-", " ")}
                    </option>
                  ))}
                </select>
                <Progression
                  key={selected}
                  history={history}
                  exerciseId={selected}
                />
              </>
            ) : (
              <p className="muted">
                Complete a strength workout to see exercise progression.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
