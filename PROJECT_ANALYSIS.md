# Project Analysis: YouTube Video Download Automation

## Overview

A **production-ready, scalable YouTube video downloading system** built with Node.js. It uses a queue-based architecture (Redis/BullMQ), PostgreSQL for metadata and metrics, and optional rotating proxies for resilience and rate-limit avoidance.

## Core Value Proposition

- **Automation**: Queue single videos, entire channels, or bulk URLs via REST API.
- **Scalability**: Horizontal scaling via multiple workers; single Redis queue.
- **Reliability**: Retries, proxy rotation on failure, sticky IP per task, success-rate tracking.
- **Observability**: Metrics (success rate, speed, failures), proxy stats, health checks.

## Architecture Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Input | Express, BullMQ | REST API, task queue (video/channel/bulk) |
| Queue | Redis, BullMQ | Job queue, retries, concurrency |
| Proxy | Custom manager + PostgreSQL | Rotating proxies, sticky IP, success/failure tracking |
| Metadata | yt-dlp, Playwright (fallback) | Title, duration, thumbnail extraction |
| Download | yt-dlp-wrap, Node.js | MP4 download with progress, proxy support |
| Storage | PostgreSQL, local filesystem | Metadata (URL, title, status, proxy, speed), video files |
| Monitoring | Pino, custom metrics | Logs, success rate, download speed, snapshots |
| Scheduler | Node.js setInterval | Re-queue failed jobs, record metrics snapshots |

## Key Flows

1. **Submit task**: `POST /api/v1/tasks/video` → validate URL → enqueue to Redis → insert/update row in PostgreSQL (pending).
2. **Process task**: Worker picks job → assign sticky proxy → fetch metadata (yt-dlp or Playwright) → download via yt-dlp → update row (completed/failed), record proxy success/failure.
3. **Retry**: On failure, BullMQ retries with backoff; proxy can rotate on retry. Scheduler re-queues failed downloads after cooldown.

## File Structure (Source)

- `src/config/` — Environment and app config.
- `src/input/` — REST API (Express) and Redis queue (BullMQ).
- `src/proxy/` — Proxy list, sticky assignment, rotation on failure, PostgreSQL stats.
- `src/metadata/` — yt-dlp JSON dump; Playwright fallback for metadata.
- `src/download/` — yt-dlp download engine, per-job output dir, metrics.
- `src/storage/` — PostgreSQL client, schema, migrations, local file paths.
- `src/monitoring/` — Pino logger, in-memory metrics, DB snapshots.
- `src/scheduler/` — Periodic retry of failed jobs, metrics snapshot.
- `src/workers/` — BullMQ worker: video + channel jobs, DB updates.

## Dependencies (Production)

- **bullmq**, **ioredis** — Job queue and Redis.
- **express** — REST API.
- **pg** — PostgreSQL.
- **yt-dlp-wrap** — yt-dlp wrapper for download and metadata.
- **playwright** — Metadata fallback (browser).
- **dotenv**, **pino**, **pino-pretty**, **uuid** — Config, logging, IDs.

## Security & Compliance Notes

- No YouTube ToS or copyright advice is implied; operators are responsible for compliance.
- Proxy credentials live in `.env`; never commit `.env`.
- API has no built-in auth; put it behind a reverse proxy and add auth in production.

## Possible Extensions

- Authentication (API keys, JWT).
- Webhook or callback on job completion.
- Preferred format/quality options per task.
- Rate limiting per IP or API key.
