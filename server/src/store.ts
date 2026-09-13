import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
export type History = {
  workouts: Record<string, unknown>[];
  activities?: Record<string, unknown>[];
  dailyTotals?: Record<string, unknown>;
};
export function validate(value: unknown): asserts value is History {
  const h = value as History;
  const num = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  const duration = (n: unknown) => n === null || num(n);
  const date = (s: unknown) =>
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s));
  if (
    !h ||
    !Array.isArray(h.workouts) ||
    !h.workouts.every(
      (w) =>
        w &&
        date(w.date) &&
        typeof w.workoutId === "string" &&
        duration(w.durationSeconds) &&
        Array.isArray(w.exercises) &&
        w.exercises.every(
          (e: any) =>
            e &&
            typeof e.exerciseId === "string" &&
            num(e.averageReps) &&
            duration(e.durationSeconds) &&
            (e.weight === undefined || num(e.weight)) &&
            (e.position === undefined || num(e.position)),
        ),
    )
  )
    throw new Error("Invalid workout history");
  if (
    h.activities !== undefined &&
    (!Array.isArray(h.activities) ||
      !h.activities.every(
        (a) =>
          a &&
          date(a.date) &&
          typeof a.activityId === "string" &&
          num(a.durationSeconds),
      ))
  )
    throw new Error("Invalid activities");
}
export const revision = (h: History) =>
  '"' + createHash("sha256").update(JSON.stringify(h)).digest("hex") + '"';
export function makeStore(path: string) {
  let queue = Promise.resolve();
  async function read() {
    const h = JSON.parse(await readFile(path, "utf8"));
    validate(h);
    return h;
  }
  async function save(h: History, expected: string | undefined) {
    const operation = queue.then(async () => {
      validate(h);
      const previous = await read();
      if (expected !== revision(previous))
        throw Object.assign(new Error("History changed. Reload and retry."), {
          status: 409,
        });
      // A multiset check also protects identical historical records from being removed.
      for (const key of ["workouts", "activities"] as const) {
        const counts = new Map<string, number>();
        for (const item of h[key] ?? []) {
          const s = JSON.stringify(item);
          counts.set(s, (counts.get(s) ?? 0) + 1);
        }
        for (const item of previous[key] ?? []) {
          const s = JSON.stringify(item);
          const count = counts.get(s) ?? 0;
          if (!count)
            throw Object.assign(
              new Error("Previous history must be preserved."),
              { status: 409 },
            );
          counts.set(s, count - 1);
        }
      }
      await mkdir(dirname(path), { recursive: true });
      const temp = path + "." + randomUUID() + ".tmp";
      await writeFile(temp, JSON.stringify(h) + "\n");
      await rename(temp, path);
      return h;
    });
    queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
  return { read, save };
}
