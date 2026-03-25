-- =============================================
-- Sports Club Scheduler — Full Database Setup v2
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. User Accounts (login identity)
create table if not exists user_accounts (
  id            uuid default gen_random_uuid() primary key,
  user_id       text unique not null,
  nickname      text not null,
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- 2. Clubs
create table if not exists clubs (
  id             uuid default gen_random_uuid() primary key,
  name           text not null,
  select_password  text not null,
  admin_password text not null,
  admin_email    text,
  created_at     timestamptz default now()
);

-- 3. Players (global registry — name not unique globally, unique per club via club_members)
create table if not exists players (
  id              uuid default gen_random_uuid() primary key,
  name            text not null,
  gender          text default 'Male',
  rating          float default 1.0,
  club_ratings    jsonb default '{}',
  wins            int default 0,
  losses          int default 0,
  sessions        jsonb default '[]',
  registered_date date default current_date,
  created_at      timestamptz default now()
);

-- 4. Club Members (links players to clubs)
create table if not exists club_members (
  id         uuid default gen_random_uuid() primary key,
  club_id    uuid references clubs(id) on delete cascade,
  player_id  uuid references players(id) on delete cascade,
  joined_at  timestamptz default now(),
  is_active  boolean default true,
  unique(club_id, player_id)
);

-- 5. Club Join Requests (viewer requests to join a club)
create table if not exists club_join_requests (
  id              uuid default gen_random_uuid() primary key,
  club_id         uuid references clubs(id) on delete cascade,
  user_account_id uuid references user_accounts(id) on delete cascade,
  status          text default 'pending',  -- 'pending' | 'accepted' | 'rejected'
  requested_at    timestamptz default now(),
  reviewed_at     timestamptz,
  unique(club_id, user_account_id)
);

-- 6. Live Sessions
create table if not exists live_sessions (
  id         uuid default gen_random_uuid() primary key,
  club_id    uuid references clubs(id) on delete cascade,
  date       text not null,
  rounds     jsonb default '[]',
  matches    jsonb default '[]',
  started_by text,
  status     text default 'active',
  updated_at timestamptz default now()
);

-- =============================================
-- Row Level Security (allow all for now)
-- =============================================
alter table user_accounts      enable row level security;
alter table clubs               enable row level security;
alter table players             enable row level security;
alter table club_members        enable row level security;
alter table club_join_requests  enable row level security;
alter table live_sessions       enable row level security;

drop policy if exists "allow_all" on user_accounts;
drop policy if exists "allow_all" on clubs;
drop policy if exists "allow_all" on players;
drop policy if exists "allow_all" on club_members;
drop policy if exists "allow_all" on club_join_requests;
drop policy if exists "allow_all" on live_sessions;

create policy "allow_all" on user_accounts      for all using (true) with check (true);
create policy "allow_all" on clubs              for all using (true) with check (true);
create policy "allow_all" on players            for all using (true) with check (true);
create policy "allow_all" on club_members       for all using (true) with check (true);
create policy "allow_all" on club_join_requests for all using (true) with check (true);
create policy "allow_all" on live_sessions      for all using (true) with check (true);
