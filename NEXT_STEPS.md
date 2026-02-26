# Next steps to run the app

Right now **Redis** and **PostgreSQL** are not reachable with the default `.env`. Do one of the following.

## Option 1: Use Docker (easiest)

Install Docker, then start Redis + Postgres and migrate:

```bash
# Install Docker (Ubuntu; one-time, needs sudo)
sudo apt update && sudo apt install -y docker.io
sudo usermod -aG docker $USER
# Log out and back in (or new terminal), then:

cd /home/dev/Downloads/automation
npm run setup
```

Then in **separate terminals**:

```bash
npm run api          # listens on http://localhost:3001
npm run worker
API_BASE=http://localhost:3001 npm run smoke-test
```

## Option 2: Use system Redis + PostgreSQL

If PostgreSQL is already running (e.g. system service), set the correct URL in `.env`:

```bash
# Edit .env and set DATABASE_URL to your real connection string, e.g.:
# DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/yt_downloads
```

Install and start Redis:

```bash
sudo apt install -y redis-server
sudo systemctl start redis
```

Create the DB and run migration:

```bash
# Create database (adjust user if needed)
psql -U postgres -c "CREATE DATABASE yt_downloads;"
npm run migrate
```

Then run the app:

```bash
npm run api    # terminal 1
npm run worker # terminal 2
npm run smoke-test
```

## Check environment

Anytime, run:

```bash
npm run doctor
```

It will report whether Redis and PostgreSQL are reachable with your current `.env`.
