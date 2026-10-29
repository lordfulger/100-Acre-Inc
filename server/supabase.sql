-- Cloud saves for 100 Acre Inc. Paste into Supabase → SQL Editor → Run.
-- One row per Google account. Only the game server (with the secret key) can
-- read or write it: row level security is on and there are no public policies.
create table if not exists saves (
  google_sub text primary key,
  email text,
  data jsonb not null,
  all_time double precision,
  updated_at timestamptz not null default now()
);

alter table saves enable row level security;
