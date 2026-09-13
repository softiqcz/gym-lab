import express from "express";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { makeStore, revision } from "./store.js";
const app = express();
const root = fileURLToPath(new URL("../", import.meta.url));
const store = makeStore(
  process.env.DATA_FILE ?? resolve(root, "data/workouts.json"),
);
app.use(express.json({ limit: "5mb" }));
app.get("/api/health", async (_req, res) => {
  try {
    await store.read();
    res.json({ status: "ok" });
  } catch {
    res
      .status(503)
      .json({
        error: "Workout history is unreadable. Check the server data file.",
      });
  }
});
app.get("/api/workouts", async (_req, res) => {
  try {
    const h = await store.read();
    res.set("ETag", revision(h)).set("Cache-Control", "no-store").json(h);
  } catch {
    res
      .status(500)
      .json({
        error: "Could not read workout history. The file has not been changed.",
      });
  }
});
app.put("/api/workouts", async (req, res) => {
  try {
    const h = await store.save(req.body, req.header("If-Match"));
    res.set("ETag", revision(h)).json(h);
  } catch (e) {
    res.status((e as any).status ?? 400).json({ error: (e as Error).message });
  }
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Unknown API endpoint" }),
);
app.use(express.static(resolve(root, "../dist")));
app.get("/{*path}", (_req, res) =>
  res.sendFile(resolve(root, "../dist/index.html")),
);
app.use((error: any, _req: any, res: any, _next: any) =>
  res.status(400).json({ error: error.message ?? "Invalid request" }),
);
app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log("Workout server: http://localhost:" + (process.env.PORT ?? 3001)),
);
