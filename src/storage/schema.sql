-- Downloads table: URL, title, status, proxy, timestamps
CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('video', 'channel')),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'completed', 'failed')),
  proxy_used TEXT,
  download_started_at TIMESTAMPTZ,
  download_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  file_path TEXT,
  file_size_bytes BIGINT,
  download_speed_bytes_per_sec NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_url ON downloads(url);
CREATE INDEX IF NOT EXISTS idx_downloads_url_status ON downloads(url, status);

-- Proxy stats for success rate tracking
CREATE TABLE IF NOT EXISTS proxy_stats (
  id SERIAL PRIMARY KEY,
  proxy_key TEXT NOT NULL,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  UNIQUE(proxy_key)
);

CREATE INDEX IF NOT EXISTS idx_proxy_stats_success_rate ON proxy_stats(proxy_key);

-- Metrics snapshot (optional, for monitoring history)
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id SERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_completed INT NOT NULL DEFAULT 0,
  total_failed INT NOT NULL DEFAULT 0,
  avg_download_speed_bytes_per_sec NUMERIC,
  pending_count INT NOT NULL DEFAULT 0
);
