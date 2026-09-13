import type { History } from "../types";
export async function loadHistory() {
  const r = await fetch("/api/workouts", { cache: "no-store" });
  if (!r.ok) throw new Error("Server unavailable. Your local workout is safe.");
  return {
    history: (await r.json()) as History,
    revision: r.headers.get("ETag") ?? "",
  };
}
export async function saveHistory(history: History, revision: string) {
  const r = await fetch("/api/workouts", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "If-Match": revision },
    body: JSON.stringify(history),
  });
  if (!r.ok)
    throw Object.assign(
      new Error(
        "Could not sync. Your completed workout is saved on this device.",
      ),
      { conflict: r.status === 409 },
    );
  return (await r.json()) as History;
}
