-- Minimal auth.uid() stub for RLS integration tests on Postgres without full Supabase Auth.
-- Safe to run repeatedly. Real Supabase stacks already ship auth.uid().

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
