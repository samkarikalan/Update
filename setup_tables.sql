-- ============================================================
--  BRR App — Supabase Table Setup
--  Run in: Supabase Dashboard → SQL Editor → New Query
--  Safe to run multiple times (uses IF NOT EXISTS + ADD COLUMN IF NOT EXISTS)
-- ============================================================


-- ── 1. CLUBS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  select_password  text,
  admin_password   text,
  registered_date  date DEFAULT CURRENT_DATE
);


-- ── 2. PLAYERS ───────────────────────────────────────────────
-- club_ratings: jsonb map of { "club_id": rating_value }
-- sessions:     jsonb array of { date, wins, losses, rating, matches[] }
-- is_playing / session_id / session_started_at: slot tracking (Update 3)
CREATE TABLE IF NOT EXISTS players (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL UNIQUE,
  gender              text DEFAULT 'Male',
  rating              numeric DEFAULT 1.0,
  registered_date     date DEFAULT CURRENT_DATE,
  club_ratings        jsonb DEFAULT '{}',
  sessions            jsonb DEFAULT '[]',
  wins                int DEFAULT 0,
  losses              int DEFAULT 0,
  is_playing          boolean DEFAULT false,
  session_id          text DEFAULT null,
  session_started_at  timestamptz DEFAULT null
);


-- ── 3. CLUB MEMBERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid REFERENCES clubs(id) ON DELETE CASCADE,
  player_id  uuid REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (club_id, player_id)
);


-- ── 4. LIVE SESSIONS ─────────────────────────────────────────
-- Temporary real-time data written after each round via syncLiveSession().
-- Flushed to players.sessions on End Session, then deleted.
-- Dashboard reads this for the "Live Now" section.
-- Upserted on conflict (player_name, club_id, date).
CREATE TABLE IF NOT EXISTS live_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name  text NOT NULL,
  club_id      uuid REFERENCES clubs(id) ON DELETE CASCADE,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  wins         int DEFAULT 0,
  losses       int DEFAULT 0,
  rating       numeric DEFAULT 1.0,
  matches      jsonb DEFAULT '[]',
  started_by   text,
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (player_name, club_id, date)
);


-- ── 5. PLAYER SESSIONS ───────────────────────────────────────
-- Historical archive per player. date is stored as text (YYYY-MM-DD).
-- Written by savePlayerSession(), read by getPlayerSessions().
CREATE TABLE IF NOT EXISTS player_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name  text NOT NULL,
  date         text NOT NULL,
  wins         int DEFAULT 0,
  losses       int DEFAULT 0,
  rating       numeric DEFAULT 1.0,
  UNIQUE (player_name, date)
);


-- ============================================================
--  ADD MISSING COLUMNS TO EXISTING TABLES
--  Safe if tables already exist from a previous setup
-- ============================================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS sessions           jsonb DEFAULT '[]';
ALTER TABLE players ADD COLUMN IF NOT EXISTS club_ratings       jsonb DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS wins               int DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS losses             int DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_playing         boolean DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS session_id         text DEFAULT null;
ALTER TABLE players ADD COLUMN IF NOT EXISTS session_started_at timestamptz DEFAULT null;


-- ============================================================
--  ROW LEVEL SECURITY
--  App uses anon key — needs full read/write on all tables
-- ============================================================

ALTER TABLE clubs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (safe to re-run)
DROP POLICY IF EXISTS "anon_read"  ON clubs;
DROP POLICY IF EXISTS "anon_write" ON clubs;
DROP POLICY IF EXISTS "anon_read"  ON players;
DROP POLICY IF EXISTS "anon_write" ON players;
DROP POLICY IF EXISTS "anon_read"  ON club_members;
DROP POLICY IF EXISTS "anon_write" ON club_members;
DROP POLICY IF EXISTS "anon_read"  ON live_sessions;
DROP POLICY IF EXISTS "anon_write" ON live_sessions;
DROP POLICY IF EXISTS "anon_read"  ON player_sessions;
DROP POLICY IF EXISTS "anon_write" ON player_sessions;

CREATE POLICY "anon_read"  ON clubs           FOR SELECT USING (true);
CREATE POLICY "anon_write" ON clubs           FOR ALL    USING (true);
CREATE POLICY "anon_read"  ON players         FOR SELECT USING (true);
CREATE POLICY "anon_write" ON players         FOR ALL    USING (true);
CREATE POLICY "anon_read"  ON club_members    FOR SELECT USING (true);
CREATE POLICY "anon_write" ON club_members    FOR ALL    USING (true);
CREATE POLICY "anon_read"  ON live_sessions   FOR SELECT USING (true);
CREATE POLICY "anon_write" ON live_sessions   FOR ALL    USING (true);
CREATE POLICY "anon_read"  ON player_sessions FOR SELECT USING (true);
CREATE POLICY "anon_write" ON player_sessions FOR ALL    USING (true);


-- ============================================================
--  DONE
-- ============================================================
