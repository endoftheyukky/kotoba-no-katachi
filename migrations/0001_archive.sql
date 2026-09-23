-- The anonymous archive of pages written on ことばのかたち.
--
-- One row in `generations` for each poem someone newly wrote (typed words, or
-- an example chosen). Nothing about the request is kept: no IP address, no
-- user agent, no location, no account. The two ids are random UUIDs the
-- browser keeps for itself (localStorage / sessionStorage); they tell browser
-- profiles and visits apart, not people.
--
-- Applied with `wrangler d1 migrations apply` (npm run db:migrate:local /
-- db:migrate:remote); later changes go in new numbered files, never here.

CREATE TABLE generations (
  id                TEXT PRIMARY KEY,          -- event id, random UUID made by the server
  created_at        INTEGER NOT NULL,          -- the server's clock, ms since 1970 (UTC): the archive's time
  client_created_at INTEGER,                   -- the browser's clock, ms; kept only when within 7 days of the server's
  visitor_id        TEXT NOT NULL,             -- random UUID from this browser's localStorage
  session_id        TEXT NOT NULL,             -- random UUID from this tab's sessionStorage
  title             TEXT NOT NULL,             -- the words, as the page normalized them
  reading           TEXT NOT NULL DEFAULT '',  -- the reading given in brackets, or ''
  source            TEXT NOT NULL CHECK (source IN ('manual', 'example')),
  generator_version TEXT NOT NULL,             -- 'v2c' (published) or 'v1' (?v=1)
  output_hash       TEXT NOT NULL              -- SHA-256 of the canonical snapshot, computed by the server
);

CREATE INDEX generations_by_time    ON generations (created_at, id);
CREATE INDEX generations_by_visitor ON generations (visitor_id, created_at);
CREATE INDEX generations_by_session ON generations (session_id, created_at);

-- the page as it was drawn: canonical SVG, checked against the renderer's
-- vocabulary, gzip-compressed. Apart from its row, so lists never read it.
CREATE TABLE snapshots (
  generation_id TEXT PRIMARY KEY REFERENCES generations (id) ON DELETE CASCADE,
  svg_gz        BLOB NOT NULL,
  bytes         INTEGER NOT NULL                -- uncompressed length, characters
);

-- one row per browser profile and per visit, kept up to date at each record
CREATE TABLE visitors (
  id          TEXT PRIMARY KEY,
  first_at    INTEGER NOT NULL,
  last_at     INTEGER NOT NULL,
  generations INTEGER NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  visitor_id  TEXT NOT NULL,
  first_at    INTEGER NOT NULL,
  last_at     INTEGER NOT NULL,
  generations INTEGER NOT NULL
);

CREATE INDEX sessions_by_visitor ON sessions (visitor_id, first_at);

-- totals, so that showing them reads three rows; also day:<YYYY-MM-DD> counts for the daily cap
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT INTO counters (name, value) VALUES ('generations', 0), ('visitors', 0), ('sessions', 0);

-- wrong admin passwords, for everyone together (no address is kept)
CREATE TABLE admin_throttle (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  window_start INTEGER NOT NULL,
  failures     INTEGER NOT NULL
);
