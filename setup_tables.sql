-- =============================================
-- Sports Club Scheduler — Database Setup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. User Accounts
create table user_accounts (
  id            uuid default gen_random_uuid() primary key,
  user_id       text unique not null,
  nickname      text not null,
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- 2. Clubs
create table clubs (
  id             uuid default gen_random_uuid() primary key,
  name           text not null,
  user_password  text not null,
  admin_password text not null,
  admin_email    text,
  created_at     timestamptz default now()
);

-- 3. Club Join Requests
create table club_join_requests (
  id              uuid default gen_random_uuid() primary key,
  club_id         uuid references clubs(id) on delete cascade,
  user_account_id uuid references user_accounts(id) on delete cascade,
  status          text default 'pending',
  requested_at    timestamptz default now(),
  reviewed_at     timestamptz,
  unique(club_id, user_account_id)
);

-- 4. Club Members
create table club_members (
  id              uuid default gen_random_uuid() primary key,
  club_id         uuid references clubs(id) on delete cascade,
  user_account_id uuid references user_accounts(id) on delete cascade,
  joined_at       timestamptz default now(),
  is_active       boolean default true,
  unique(club_id, user_account_id)
);

-- 5. Players
create table players (
  id              uuid default gen_random_uuid() primary key,
  user_account_id uuid references user_accounts(id) on delete set null,
  club_id         uuid references clubs(id) on delete cascade,
  nickname        text not null,
  gender          text default 'Male',
  rating          float default 1.0,
  club_rating     float default 1.0,
  wins            int default 0,
  losses          int default 0,
  sessions        jsonb default '[]',
  created_at      timestamptz default now()
);

-- 6. Live Sessions
create table live_sessions (
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
-- Row Level Security
-- =============================================
alter table user_accounts      enable row level security;
alter table clubs               enable row level security;
alter table club_join_requests  enable row level security;
alter table club_members        enable row level security;
alter table players             enable row level security;
alter table live_sessions       enable row level security;

create policy "allow_all" on user_accounts      for all using (true) with check (true);
create policy "allow_all" on clubs              for all using (true) with check (true);
create policy "allow_all" on club_join_requests for all using (true) with check (true);
create policy "allow_all" on club_members       for all using (true) with check (true);
create policy "allow_all" on players            for all using (true) with check (true);
create policy "allow_all" on live_sessions      for all using (true) with check (true);
