-- Enable commonly used Supabase / PostgreSQL extensions for local development.
-- Runs after Supabase role/JWT init scripts (98/99-*).
-- Idempotent: safe on fresh init; re-run manually after `docker compose down -v`.

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Default-enabled extensions (Supabase cloud defaults)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_graphql;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS hypopg;

-- Opt-in extensions (enabled here for local parity with production options)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA extensions;

-- pg_jieba: not loadable on supabase/postgres (Alpine/Nix). Use pgroonga for Chinese FTS.
-- CREATE EXTENSION IF NOT EXISTS pg_jieba;
