import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeStore, revision, validate } from "./store.js";
const record = {
  id: "one",
  date: "2026-09-13",
  workoutId: "back-biceps",
  durationSeconds: 120,
  exercises: [
    {
      exerciseId: "lat-pulldown",
      position: 4,
      averageReps: 10.4,
      durationSeconds: 120,
    },
  ],
};
test("atomic append preserves history and rejects stale or destructive saves", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bodybuilding-test-"));
  try {
    const path = join(dir, "workouts.json");
    const original = { workouts: [record], activities: [] };
    await writeFile(path, JSON.stringify(original));
    const store = makeStore(path);
    const next = { ...original, workouts: [record, { ...record, id: "two" }] };
    const outcomes = await Promise.allSettled([
      store.save(next, revision(original)),
      store.save(
        { ...original, workouts: [record, { ...record, id: "three" }] },
        revision(original),
      ),
    ]);
    assert.equal(outcomes[0].status, "fulfilled");
    assert.equal(outcomes[1].status, "rejected");
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), next);
    await assert.rejects(store.save(original, revision(next)), /preserved/);
    assert.deepEqual(await store.read(), next);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("malformed input is rejected and unknown imported durations remain valid", () => {
  validate({
    workouts: [
      {
        ...record,
        durationSeconds: null,
        exercises: [{ ...record.exercises[0], durationSeconds: null, sets: 5 }],
      },
    ],
  });
  assert.throws(() =>
    validate({
      workouts: [
        { ...record, exercises: [{ ...record.exercises[0], averageReps: -1 }] },
      ],
    }),
  );
  assert.throws(() =>
    validate({
      workouts: [],
      activities: [{ date: "bad", activityId: "running", durationSeconds: 10 }],
    }),
  );
});
