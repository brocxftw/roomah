create extension if not exists pgcrypto;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
