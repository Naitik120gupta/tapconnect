-- ============================================================
-- tap.connect — Supabase Schema
-- Run this entire file in your Supabase SQL editor
-- ============================================================

-- PROFILES table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  company text not null,
  bio text,
  tags text[] default '{}',
  intent text default 'networking',  -- networking | hiring | fundraising | cofounder | partnerships
  linkedin_url text,
  twitter_url text,
  avatar_color text default '#e8c547',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TAP ROOMS — the 6-digit code rooms
create table if not exists tap_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,           -- 6-digit code e.g. "482931"
  creator_id uuid references profiles(id) on delete cascade,
  joiner_id uuid references profiles(id) on delete cascade,
  event_id uuid,                        -- optional event context
  status text default 'waiting',        -- waiting | matched | expired
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '10 minutes')
);

-- CONNECTIONS table
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references profiles(id) on delete cascade,
  user_b uuid references profiles(id) on delete cascade,
  room_id uuid references tap_rooms(id),
  ai_insight text,                      -- "Why you'll click" AI text
  note_a text,                          -- private note from user_a
  note_b text,                          -- private note from user_b
  created_at timestamptz default now(),
  unique(user_a, user_b)
);

-- EVENTS table (for organizers)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_id uuid references profiles(id),
  event_date date,
  location text,
  attendee_count int default 0,
  tap_count int default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table tap_rooms enable row level security;
alter table connections enable row level security;
alter table events enable row level security;

-- Profiles: anyone can read, only owner can write
create policy "profiles_read_all"  on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- Tap rooms: creator can insert, participants can read/update
create policy "rooms_insert" on tap_rooms for insert with check (auth.uid() = creator_id);
create policy "rooms_read"   on tap_rooms for select using (
  auth.uid() = creator_id or auth.uid() = joiner_id or status = 'waiting'
);
create policy "rooms_update" on tap_rooms for update using (
  auth.uid() = creator_id or auth.uid() = joiner_id
);

-- Connections: users can see their own connections
create policy "connections_read" on connections for select using (
  auth.uid() = user_a or auth.uid() = user_b
);
create policy "connections_insert" on connections for insert with check (
  auth.uid() = user_a or auth.uid() = user_b
);
create policy "connections_update" on connections for update using (
  auth.uid() = user_a or auth.uid() = user_b
);

-- ============================================================
-- REALTIME (enable for tap_rooms so both sides sync live)
-- ============================================================
-- Go to Supabase Dashboard → Database → Replication
-- Enable realtime for: tap_rooms, connections

-- ============================================================
-- HELPFUL FUNCTION: auto-generate unique 6-digit code
-- ============================================================
create or replace function generate_tap_code()
returns text language plpgsql as $$
declare
  code text;
  exists_check int;
begin
  loop
    code := lpad(floor(random() * 1000000)::text, 6, '0');
    select count(*) into exists_check from tap_rooms 
    where tap_rooms.code = code and status = 'waiting';
    exit when exists_check = 0;
  end loop;
  return code;
end;
$$;
