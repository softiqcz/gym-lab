import { useEffect, useRef, useState } from "react";
import definitions from "./data/workouts.json";
import exercises from "./data/exercises.json";
import Home from "./components/Home";
import HistoryPage, { Progression } from "./components/History";
import WorkoutExercise from "./components/WorkoutExercise";
import WarmUp from "./components/WarmUp";
import { loadHistory, saveHistory } from "./api/workoutsApi";
import {
  elapsed,
  localDate,
  time,
  type Active,
  type History,
  type WorkoutRecord,
  type Activity,
  type Result,
} from "./types";
const ACTIVE_KEY = "bodybuilding-active";
const PENDING_KEY = "bodybuilding-pending";
type Pending = { workouts: WorkoutRecord[]; activities: Activity[] };
function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
const workoutName = (id: string) =>
  (
    definitions.find((w) => w.id === id)?.name ?? id.replaceAll("-", " ")
  ).replaceAll(" + ", " ");
const exerciseName = (id: string) =>
  exercises.find((e) => e.id === id)?.name ?? id.replaceAll("-", " ");
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
const sorted = (h: History) =>
  h.workouts
    .map((w, index) => ({ w, index }))
    .sort((a, b) => b.w.date.localeCompare(a.w.date) || b.index - a.index);
const resultLabel = (r: Result) =>
  `${r.weight !== undefined ? r.weight + " KG" : r.position !== undefined ? "POS " + r.position + " " + (r.positionDirection ?? "") : "BODYWEIGHT"} × ${r.averageReps}${r.exerciseId === "plank" ? " SEC" : ""}`;
function latest(h: History, id: string) {
  const definition = exercises.find((e) => e.id === id);
  const ids =
    definition && "historyIds" in definition ? definition.historyIds : [id];
  for (const { w } of sorted(h)) {
    const result = w.exercises.find((e) =>
      (ids ?? [id]).includes(e.exerciseId),
    );
    if (result) return result;
  }
  return undefined;
}
function initialActive(id: string, h: History): Active {
  const w = definitions.find((w) => w.id === id)!;
  const e = exercises.find((e) => e.id === w.exercises?.[0]);
  const last = e ? latest(h, e.id) : undefined;
  const now = Date.now();
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
            n.toString(16).padStart(2, "0"),
          ).join(""),
    date: localDate(),
    phase: "warmup",
    workoutId: id,
    exerciseIndex: 0,
    weight: last?.weight ?? last?.position ?? 0,
    positionDirection: last?.positionDirection ?? "DOWN",
    reps: Math.round(last?.averageReps ?? (e?.id === "plank" ? 45 : 10)),
    setReps: [],
    results: [],
    startedAt: now,
    exerciseStartedAt: now,
    setStartedAt: now,
    restStartedAt: null,
    activityId: w.activities?.[0],
  };
}
function merge(h: History, p: Pending): History {
  return {
    ...h,
    workouts: [
      ...h.workouts,
      ...p.workouts.filter((w) => !h.workouts.some((x) => x.id === w.id)),
    ],
    activities: [
      ...(h.activities ?? []),
      ...p.activities.filter((a) => !h.activities?.some((x) => x.id === a.id)),
    ],
  };
}
export default function App() {
  const [history, setHistory] = useState<History>(() =>
    merge(
      { workouts: [] },
      readLocal<Pending>(PENDING_KEY, { workouts: [], activities: [] }),
    ),
  );
  const [active, setActive] = useState<Active | null>(() => {
    const a = readLocal<Active | null>(ACTIVE_KEY, null);
    return a &&
      definitions.some((w) => w.id === a.workoutId) &&
      Number.isFinite(a.startedAt) &&
      Array.isArray(a.results) &&
      Array.isArray(a.setReps)
      ? a
      : null;
  });
  const [page, setPage] = useState<
    "home" | "workout" | "history" | "detail" | "progress" | "complete"
  >("home");
  const [detail, setDetail] = useState<WorkoutRecord | null>(null);
  const [progress, setProgress] = useState("");
  const [progressReturn, setProgressReturn] = useState<
    "workout" | "detail" | "history"
  >("history");
  const [discard, setDiscard] = useState(false);
  const [completion, setCompletion] = useState<WorkoutRecord | Activity | null>(
    null,
  );
  const [now, setNow] = useState(Date.now());
  const [syncWarning, setSyncWarning] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const busy = useRef(false);
  const pending = useRef(
    readLocal<Pending>(PENDING_KEY, { workouts: [], activities: [] }),
  );
  function store(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageWarning("");
      return true;
    } catch {
      setStorageWarning(
        "Device storage unavailable. Keep this page open until the workout syncs.",
      );
      return false;
    }
  }
  useEffect(() => {
    if (active) store(ACTIVE_KEY, active);
    else {
      try {
        localStorage.removeItem(ACTIVE_KEY);
      } catch {
        setStorageWarning("Could not clear device recovery data.");
      }
    }
  }, [active]);
  async function sync() {
    if (busy.current) return;
    busy.current = true;
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const remote = await loadHistory();
        const batch = {
          workouts: [...pending.current.workouts],
          activities: [...pending.current.activities],
        };
        const combined = merge(remote.history, batch);
        if (batch.workouts.length || batch.activities.length) {
          try {
            await saveHistory(combined, remote.revision);
          } catch (e) {
            if ((e as { conflict?: boolean }).conflict) continue;
            throw e;
          }
          pending.current = {
            workouts: pending.current.workouts.filter(
              (w) => !batch.workouts.some((x) => x.id === w.id),
            ),
            activities: pending.current.activities.filter(
              (a) => !batch.activities.some((x) => x.id === a.id),
            ),
          };
          store(PENDING_KEY, pending.current);
        }
        setHistory(merge(combined, pending.current));
        setLoaded(true);
        setSyncWarning("");
        return;
      }
      throw new Error(
        "History is changing on another device. Retrying shortly.",
      );
    } catch (e) {
      setSyncWarning(
        e instanceof TypeError
          ? "Server unavailable. Your local workout is safe."
          : (e as Error).message,
      );
      setLoaded(true);
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    void sync();
    const refresh = () => {
      void sync();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    const retry = window.setInterval(refresh, 15000);
    return () => {
      clearInterval(retry);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, active?.exerciseIndex, active?.phase]);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);
  function finish(record: WorkoutRecord | Activity) {
    if ("exercises" in record) pending.current.workouts.push(record);
    else pending.current.activities.push(record);
    store(PENDING_KEY, pending.current);
    setHistory((h) => merge(h, pending.current));
    setCompletion(record);
    setActive(null);
    setPage("complete");
    void sync();
  }
  function beginExercises() {
    setActive((a) => {
      if (!a) return a;
      const stamp = Date.now();
      return {
        ...a,
        phase: "exercise",
        exerciseStartedAt: stamp,
        setStartedAt: stamp,
        restStartedAt: null,
      };
    });
  }
  function pause() {
    if (!active) return;
    if (active.phase === "warmup") {
      beginExercises();
      return;
    }
    const workout = definitions.find((w) => w.id === active.workoutId)!;
    if (workout.type !== "strength") return;
    const stamp = Date.now();
    if (active.phase === "transition") {
      const results = active.results.map((result, index) =>
        index === active.results.length - 1
          ? {
              ...result,
              durationSeconds: elapsed(active.exerciseStartedAt, stamp),
            }
          : result,
      );
      if (active.exerciseIndex + 1 === workout.exercises!.length) {
        finish({
          id: active.id,
          date: active.date,
          workoutId: active.workoutId,
          durationSeconds: elapsed(active.startedAt, stamp),
          exercises: results,
        });
        return;
      }
      const next = exercises.find(
        (e) => e.id === workout.exercises![active.exerciseIndex + 1],
      )!;
      const last = latest(history, next.id);
      setActive({
        ...active,
        phase: "exercise",
        exerciseIndex: active.exerciseIndex + 1,
        results,
        setReps: [],
        weight: last?.weight ?? last?.position ?? 0,
        positionDirection: last?.positionDirection ?? "DOWN",
        reps: Math.round(last?.averageReps ?? (next.id === "plank" ? 45 : 10)),
        exerciseStartedAt: stamp,
        setStartedAt: stamp,
        restStartedAt: null,
      });
      return;
    }
    if (active.restStartedAt !== null) {
      setActive({ ...active, restStartedAt: null, setStartedAt: stamp });
      return;
    }
    const exercise = exercises.find(
      (e) => e.id === workout.exercises![active.exerciseIndex],
    )!;
    const reps = [...active.setReps, active.reps];
    if (reps.length < exercise.sets) {
      setActive({ ...active, setReps: reps, restStartedAt: stamp });
      return;
    }
    const result: Result = {
      exerciseId: exercise.id,
      ...(exercise.loadType === "position"
        ? {
            position: active.weight,
            positionDirection: active.positionDirection,
          }
        : { weight: active.weight }),
      averageReps:
        Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 100) / 100,
      durationSeconds: elapsed(active.exerciseStartedAt, stamp),
    };
    const results = [...active.results, result];
    setActive({
      ...active,
      phase: "transition",
      results,
      setReps: [],
      restStartedAt: stamp,
    });
  }

  useEffect(() => {
    if (
      page !== "workout" ||
      !active ||
      (active.phase !== "warmup" &&
        definitions.find((w) => w.id === active.workoutId)?.type !== "strength")
    )
      return;
    function key(event: KeyboardEvent) {
      if (
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.isContentEditable || target?.closest("textarea,select"))
        return;
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.code === "Space"
      ) {
        event.preventDefault();
        pause();
        return;
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [page, active, history]);
  const w =
    definitions.find((w) => w.id === active?.workoutId) ?? definitions[0];
  const e = active
    ? exercises.find(
        (e) =>
          e.id ===
          definitions.find((w) => w.id === active.workoutId)?.exercises?.[
            active.exerciseIndex
          ],
      )
    : undefined;
  const workoutExercises = (w.exercises ?? [])
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter((exercise) => exercise !== undefined);
  const totalSets = workoutExercises.reduce(
    (sum, exercise) => sum + exercise.sets,
    0,
  );
  const completedSets = active
    ? workoutExercises
        .slice(0, active.exerciseIndex)
        .reduce((sum, exercise) => sum + exercise.sets, 0) +
      (active.phase === "transition" ? (e?.sets ?? 0) : active.setReps.length)
    : 0;
  const workoutProgress = totalSets
    ? Math.floor((completedSets / totalSets) * 100)
    : 0;
  const nextDefinition = active
    ? exercises.find(
        (exercise) => exercise.id === w.exercises?.[active.exerciseIndex + 1],
      )
    : undefined;
  const nextResult = nextDefinition
    ? latest(history, nextDefinition.id)
    : undefined;
  const nextLoad = nextResult?.weight ?? nextResult?.position;
  const nextExercise = nextDefinition
    ? {
        name: nextDefinition.name,
        load:
          nextLoad === undefined
            ? nextDefinition.loadType === "position"
              ? "Choose machine position"
              : "Choose starting weight"
            : nextDefinition.loadType === "position"
              ? `POS ${nextLoad} ${nextResult?.positionDirection ?? "DOWN"}`
              : `${nextLoad} KG`,
      }
    : undefined;
  function showProgress(id: string, back: "workout" | "detail" | "history") {
    setProgress(id);
    setProgressReturn(back);
    setPage("progress");
  }
  return (
    <main className={`app page-${page}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")}>
          GYM LAB
        </button>
        <button
          className="nav"
          onClick={() => {
            setPage(page === "history" ? "home" : "history");
            void sync();
          }}
        >
          {page === "history" ? "TODAY" : "HISTORY"} <span>↗</span>
        </button>
      </header>
      {(syncWarning || storageWarning) && (
        <div className="sync-warning" role="status">
          {storageWarning || syncWarning}
          <button onClick={() => void sync()}>RETRY SYNC ↻</button>
        </div>
      )}
      {page === "home" &&
        (active ? (
          <section className="hero recovery-home">
            <p className="eyebrow">WORKOUT IN PROGRESS</p>
            <h1>{workoutName(active.workoutId)}</h1>
            <p className="muted">Your workout is saved on this device.</p>
            {discard ? (
              <>
                <p className="muted">Discard this unfinished workout?</p>
                <button
                  className="primary"
                  onClick={() => {
                    setActive(null);
                    setDiscard(false);
                  }}
                >
                  DISCARD & START NEW <span>→</span>
                </button>
                <button className="secondary" onClick={() => setDiscard(false)}>
                  KEEP WORKOUT
                </button>
              </>
            ) : (
              <>
                <button className="primary" onClick={() => setPage("workout")}>
                  CONTINUE <span>→</span>
                </button>
                <button className="secondary" onClick={() => setDiscard(true)}>
                  START NEW
                </button>
              </>
            )}
          </section>
        ) : (
          <Home
            loaded={loaded}
            onStart={(id) => {
              setActive(initialActive(id, history));
              setPage("workout");
            }}
          />
        ))}
      {page === "workout" &&
        active &&
        (active.phase === "warmup" ? (
          <WarmUp
            active={active}
            name={workoutName(active.workoutId)}
            firstExercise={e?.name ?? exerciseName(active.activityId ?? "")}
            now={now}
            onReady={beginExercises}
          />
        ) : e ? (
          <WorkoutExercise
            active={active}
            exercise={e}
            progress={workoutProgress}
            nextExercise={nextExercise}
            total={w.exercises!.length}
            now={now}
            onChange={setActive}
            onPause={pause}
          />
        ) : (
          <section className="cardio-session">
            <p className="eyebrow">CARDIO SESSION</p>
            <h1>{w.name}</h1>
            <label className="eyebrow" htmlFor="activity">
              ACTIVITY
            </label>
            <select
              id="activity"
              value={active.activityId}
              onChange={(ev) =>
                setActive({ ...active, activityId: ev.target.value })
              }
            >
              {w.activities!.map((id) => (
                <option key={id} value={id}>
                  {exerciseName(id)}
                </option>
              ))}
            </select>
            <div className="cardio-time">
              {time(elapsed(active.exerciseStartedAt, now))}
            </div>
            <span className="eyebrow">ELAPSED TIME</span>
            <button
              className="primary"
              onClick={() =>
                finish({
                  id: active.id,
                  date: active.date,
                  workoutId: active.workoutId,
                  activityId: active.activityId!,
                  durationSeconds: elapsed(active.exerciseStartedAt),
                })
              }
            >
              FINISH ACTIVITY <span>→</span>
            </button>
          </section>
        ))}
      {page === "complete" && completion && (
        <section className="completion">
          <p className="eyebrow">WORKOUT COMPLETE · 100% DONE</p>
          <h1>{workoutName(completion.workoutId)}</h1>
          <div className="completion-time">
            {time(completion.durationSeconds)}
          </div>
          <p className="eyebrow">
            {"exercises" in completion
              ? "EXERCISES COMPLETE"
              : exerciseName(completion.activityId)}
          </p>
          <p className="muted">
            {pending.current.workouts.length ||
            pending.current.activities.length
              ? "Saved on this device. Waiting to sync."
              : "Saved to your workout history."}
          </p>
          <button className="primary" onClick={() => setPage("home")}>
            DONE <span>→</span>
          </button>
        </section>
      )}
      {page === "history" && (
        <HistoryPage
          history={history}
          loaded={loaded}
          onWorkout={(record) => {
            setDetail(record);
            setPage("detail");
          }}
        />
      )}
      {page === "detail" && detail && (
        <section className="history">
          <button className="back" onClick={() => setPage("history")}>
            ← HISTORY
          </button>
          <p className="eyebrow">
            {dateLabel(detail.date)} {detail.date.slice(0, 4)}
          </p>
          <h1 className="detail-title">{workoutName(detail.workoutId)}</h1>
          <div className="detail-meta">
            <span>{detail.exercises.length} EXERCISES</span>
            <span>
              {time(detail.durationSeconds)}
              {detail.durationSeconds === null
                ? " · DURATION NOT RECORDED"
                : ""}
            </span>
          </div>
          {detail.exercises.map((r, i) => (
            <button
              key={i}
              className="result-row"
              onClick={() => showProgress(r.exerciseId, "detail")}
            >
              <span>
                <span className="eyebrow">{exerciseName(r.exerciseId)}</span>
                <strong>{resultLabel(r)}</strong>
                <small>
                  {r.sets ? `${r.sets} SETS · ` : ""}
                  {time(r.durationSeconds)}
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
        </section>
      )}
      {page === "progress" && (
        <section className="history">
          <button className="back" onClick={() => setPage(progressReturn)}>
            ← BACK
          </button>
          <p className="eyebrow">EXERCISE PROGRESSION</p>
          <h1 className="detail-title">{exerciseName(progress)}</h1>
          <Progression history={history} exerciseId={progress} />
        </section>
      )}
    </main>
  );
}
