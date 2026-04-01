create table if not exists profiles (
  user_id uuid primary key,
  email text not null unique,
  full_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
