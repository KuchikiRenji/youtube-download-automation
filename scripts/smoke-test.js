#!/usr/bin/env node
/**
 * Smoke test: requires API (and optionally worker) running.
 * Usage: npm run smoke-test   (after npm run api + npm run worker)
 */
const BASE = process.env.API_BASE || "http://localhost:3001";

async function main() {
  console.log("Smoke test → %s\n", BASE);

  let health;
  try {
    health = await fetch(BASE + "/health");
  } catch (e) {
    console.error("FAIL: cannot reach API:", e.message);
    console.error("Start the API first: npm run api");
    process.exit(1);
  }
  if (!health.ok) {
    console.error("FAIL: /health returned", health.status);
    process.exit(1);
  }
  console.log("OK /health");

  try {
    const r = await fetch(BASE + "/api/v1/metrics");
    if (r.ok) console.log("OK /api/v1/metrics");
  } catch {
    console.log("SKIP /api/v1/metrics");
  }

  let taskRes;
  try {
    taskRes = await fetch(BASE + "/api/v1/tasks/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    });
  } catch (e) {
    console.error("FAIL: POST task:", e.message);
    process.exit(1);
  }
  if (taskRes.status !== 202) {
    console.error("FAIL: POST /api/v1/tasks/video returned", taskRes.status, await taskRes.text());
    process.exit(1);
  }
  const data = await taskRes.json();
  const taskId = data.taskId;
  if (!taskId) {
    console.error("FAIL: no taskId in response");
    process.exit(1);
  }
  console.log("OK POST /api/v1/tasks/video → taskId:", taskId);

  try {
    const r = await fetch(BASE + "/api/v1/tasks/" + taskId);
    if (r.ok) console.log("OK GET /api/v1/tasks/" + taskId);
  } catch {
    console.log("SKIP GET task");
  }

  console.log("\nSmoke test passed. Worker will process the task; check GET /api/v1/tasks/" + taskId + " for status.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
