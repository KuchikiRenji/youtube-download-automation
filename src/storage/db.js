import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}

export async function insertDownload(record) {
  const {
    id,
    url,
    sourceType,
    title,
    status,
    proxyUsed,
    downloadStartedAt,
    downloadCompletedAt,
    errorMessage,
    retryCount,
    filePath,
    fileSizeBytes,
    downloadSpeedBytesPerSec,
  } = record;
  const res = await query(
    `INSERT INTO downloads (
      id, url, source_type, title, status, proxy_used,
      download_started_at, download_completed_at, error_message, retry_count,
      file_path, file_size_bytes, download_speed_bytes_per_sec, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
    ON CONFLICT (id) DO NOTHING
    RETURNING id`,
    [
      id,
      url,
      sourceType,
      title ?? null,
      status,
      proxyUsed ?? null,
      downloadStartedAt ?? null,
      downloadCompletedAt ?? null,
      errorMessage ?? null,
      retryCount ?? 0,
      filePath ?? null,
      fileSizeBytes ?? null,
      downloadSpeedBytesPerSec ?? null,
    ]
  );
  return res.rows[0];
}

export async function updateDownload(id, updates) {
  const allowed = [
    "title",
    "status",
    "proxy_used",
    "download_started_at",
    "download_completed_at",
    "error_message",
    "retry_count",
    "file_path",
    "file_size_bytes",
    "download_speed_bytes_per_sec",
  ];
  const setClauses = [];
  const values = [];
  let i = 1;
  for (const [key, value] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (allowed.includes(col)) {
      setClauses.push(`${col} = $${i}`);
      values.push(value);
      i++;
    }
  }
  if (setClauses.length === 0) return null;
  setClauses.push("updated_at = NOW()");
  values.push(id);
  const res = await query(
    `UPDATE downloads SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  return res.rows[0];
}

export async function getDownloadById(id) {
  const res = await query("SELECT * FROM downloads WHERE id = $1", [id]);
  return res.rows[0];
}

export async function getDownloadByUrl(url) {
  const res = await query(
    "SELECT * FROM downloads WHERE url = $1 AND status != 'failed' ORDER BY updated_at DESC LIMIT 1",
    [url]
  );
  return res.rows[0];
}

export async function getFailedDownloadsOlderThan(ms) {
  const res = await query(
    `SELECT * FROM downloads
     WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '1 millisecond' * $1
     ORDER BY updated_at ASC`,
    [ms]
  );
  return res.rows;
}

export async function getMetrics() {
  const res = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') AS total_completed,
      COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
      COUNT(*) FILTER (WHERE status IN ('pending', 'downloading')) AS pending_count,
      AVG(download_speed_bytes_per_sec) FILTER (WHERE status = 'completed') AS avg_download_speed
    FROM downloads
  `);
  return res.rows[0];
}

export default { getPool, query, insertDownload, updateDownload, getDownloadById, getDownloadByUrl, getFailedDownloadsOlderThan, getMetrics };
