#!/usr/bin/env node
/**
 * Check that Redis and PostgreSQL are reachable with current .env.
 * Usage: npm run doctor
 */
import "dotenv/config";
import { createConnection } from "net";
import pg from "pg";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/yt_downloads";

function parseUrl(url, defaultPort) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || "localhost",
      port: parseInt(u.port || String(defaultPort), 10),
    };
  } catch {
    return { host: "localhost", port: defaultPort };
  }
}

function waitPort(host, port, label) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 3000);
    const socket = createConnection(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {});
  });
}

async function checkPg() {
  try {
    const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 });
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return true;
  } catch (e) {
    console.error("PostgreSQL:", e.message);
    return false;
  }
}

async function main() {
  console.log("Environment check\n");
  console.log("REDIS_URL     ", REDIS_URL);
  console.log("DATABASE_URL  ", DATABASE_URL.replace(/:[^:@]+@/, ":****@"));

  const redis = parseUrl(REDIS_URL, 6379);
  const redisOk = await waitPort(redis.host, redis.port, "Redis");
  console.log(redisOk ? "Redis          OK" : "Redis          FAIL (not reachable)");

  const pgOk = await checkPg();
  console.log(pgOk ? "PostgreSQL     OK" : "PostgreSQL     FAIL (check DATABASE_URL in .env)");

  if (redisOk && pgOk) {
    console.log("\nAll good. Run: npm run api & npm run worker & npm run smoke-test");
    process.exit(0);
  }
  console.log("\nFix the failing services, then run: npm run setup");
  process.exit(1);
}

main();
