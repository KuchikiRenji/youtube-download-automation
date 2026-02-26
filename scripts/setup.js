#!/usr/bin/env node
/**
 * Setup: start Docker services (if available), wait, run migrate.
 * Usage: node scripts/setup.js   or  npm run setup
 */
import { spawn } from "child_process";
import { createConnection } from "net";
import { setTimeout as sleep } from "timers/promises";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/yt_downloads";

function tryDockerComposeUp() {
  return new Promise((resolve) => {
    const child = spawn("docker", ["compose", "up", "-d"], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

function waitForPort(host, port, maxWaitMs = 25000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function tryConnect() {
      if (Date.now() - start > maxWaitMs) {
        resolve(false);
        return;
      }
      const socket = createConnection(port, host, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => setTimeout(tryConnect, 800));
    }
    tryConnect();
  });
}

function parseHostPort(url, defaultPort) {
  try {
    const u = new URL(url);
    return { host: u.hostname || "localhost", port: parseInt(u.port || String(defaultPort), 10) };
  } catch {
    return { host: "localhost", port: defaultPort };
  }
}

async function main() {
  console.log("Setup: YouTube download automation\n");

  const dockerOk = await tryDockerComposeUp();
  if (dockerOk) {
    console.log("Docker Compose started. Waiting for Redis and PostgreSQL...");
    await sleep(5000);
  } else {
    console.log("Docker Compose not used. Ensure Redis and PostgreSQL are running.\n");
  }

  const redis = parseHostPort(REDIS_URL, 6379);
  const pg = parseHostPort(DATABASE_URL, 5432);

  console.log("Waiting for Redis at %s:%s...", redis.host, redis.port);
  const redisUp = await waitForPort(redis.host, redis.port);
  if (!redisUp) {
    console.error("Redis not reachable. Start Redis or run: docker compose up -d");
    process.exit(1);
  }
  console.log("Redis is up.");

  console.log("Waiting for PostgreSQL at %s:%s...", pg.host, pg.port);
  const pgUp = await waitForPort(pg.host, pg.port);
  if (!pgUp) {
    console.error("PostgreSQL not reachable. Start Postgres or run: docker compose up -d");
    process.exit(1);
  }
  console.log("PostgreSQL is up.");

  console.log("Running database migration...");
  const migrate = spawn("node", ["src/storage/migrate.js"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL, REDIS_URL },
    stdio: "inherit",
  });
  const code = await new Promise((resolve) => migrate.on("close", resolve));
  if (code !== 0) {
    console.error("Migration failed. Check DATABASE_URL in .env (user/password).");
    process.exit(1);
  }
  console.log("\nSetup complete. Next:");
  console.log("  Terminal 1: npm run api");
  console.log("  Terminal 2: npm run worker");
  console.log("  Terminal 3: npm run smoke-test");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
