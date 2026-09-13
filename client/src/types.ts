export type Result = {
  exerciseId: string;
  weight?: number;
  position?: number;
  positionDirection?: string;
  averageReps: number;
  durationSeconds: number | null;
  sets?: number;
};
export type WorkoutRecord = {
  id?: string;
  date: string;
  workoutId: string;
  durationSeconds: number | null;
  exercises: Result[];
};
export type Activity = {
  id: string;
  date: string;
  workoutId: string;
  activityId: string;
  durationSeconds: number;
};
export type History = {
  workouts: WorkoutRecord[];
  activities?: Activity[];
  dailyTotals?: Record<string, unknown>;
};
export type Active = {
  phase?: "warmup" | "exercise" | "transition";
  id: string;
  date: string;
  workoutId: string;
  exerciseIndex: number;
  weight: number;
  positionDirection: string;
  reps: number;
  setReps: number[];
  results: Result[];
  startedAt: number;
  exerciseStartedAt: number;
  setStartedAt: number;
  restStartedAt: number | null;
  activityId?: string;
};
export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const elapsed = (start: number, now = Date.now()) =>
  Math.max(0, Math.floor((now - start) / 1000));
export function time(n: number | null) {
  if (n === null) return "—";
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
