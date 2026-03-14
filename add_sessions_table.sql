-- ============================================================
--  Add sessions table for storing last 3 sessions per club
--  Run in: Supabase Dashboard → SQL Editor → New Query
--  Multiple live sessions allowed per club (different halls)
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     text NOT NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  started_by  text,
  status      text NOT NULL DEFAULT 'live',
  rounds_data jsonb DEFAULT '[]',
  players     jsonb DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read"  ON sessions;
DROP POLICY IF EXISTS "anon_write" ON sessions;
CREATE POLICY "anon_read"  ON sessions FOR SELECT USING (true);
CREATE POLICY "anon_write" ON sessions FOR ALL    USING (true);
