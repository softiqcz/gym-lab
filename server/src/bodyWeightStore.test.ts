import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeBodyWeightStore, validateReading } from './bodyWeightStore.js';
test('body weight seeds once, serializes appends and deduplicates retries without losing history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'body-weight-'));
  try {
    const path = join(dir, 'data/body-weight.json'), seed = join(dir, 'seed.json');
    const first = { id: 'import', date: '2026-09-07', kg: 80.7 };
    await writeFile(seed, JSON.stringify([first]));
    const store = makeBodyWeightStore(path, seed);
    assert.deepEqual(await store.read(), [first]);
    const a = { id: 'a', date: '2026-09-13', kg: 80.1 }, b = { id: 'b', date: '2026-09-14', kg: 79.9 };
    await Promise.all([store.append(a), store.append(b), store.append(a)]);
    assert.deepEqual(await store.read(), [first, a, b]);
    await assert.rejects(store.append({ ...a, kg: 90 }), /already exists/);
    await writeFile(seed, '[]');
    assert.deepEqual(await makeBodyWeightStore(path, seed).read(), [first, a, b]);
    assert.throws(() => validateReading({ ...a, kg: -1 }));
    assert.throws(() => validateReading({ ...a, date: '2026-02-30' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
