-- Short-lived allowances for what cannot rest on the browser's own ids: how
-- many records one connection may send to the archive, and how many admin
-- passwords may be tried (server/limits.ts).
--
-- A key is <purpose>:<window>:<mark>. The mark is an HMAC of the connecting
-- address (an IPv6 address as its /64) and the window, made with SESSION_SECRET
-- and cut to 16 bytes: the address itself is never written, and the same
-- address gives an unrelated mark in the next window. A row is deleted once its window is over (at the
-- first archive record of each UTC day, and at each admin login).
--
-- Each allowance is taken with one statement (INSERT … ON CONFLICT DO UPDATE
-- … WHERE … RETURNING), so requests arriving together cannot share the last one.

CREATE TABLE limits (
  key         TEXT PRIMARY KEY,
  hits        INTEGER NOT NULL,            -- taken in the window
  burst_start INTEGER NOT NULL DEFAULT 0,  -- a shorter window inside it (0 when unused)
  burst_hits  INTEGER NOT NULL DEFAULT 0,  -- taken in the shorter window
  expires     INTEGER NOT NULL             -- ms since 1970: when the row may be deleted
) WITHOUT ROWID;

-- admin_throttle (0001) is not read or written: server/limits.ts uses this table.
-- It is left in place so that the site keeps working between this migration and the next deploy.
