-- Table grants for RLS integration tests after PM migrations create roles/tables.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on all tables in schema public to anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant insert, update, delete on all tables in schema public to service_role;
  end if;
end $$;
