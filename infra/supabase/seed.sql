-- Development seed placeholder for F48.
-- Do not put real emails, user ids, tokens, or customer data here.

insert into public.workspaces (name)
values ('PM Local Development')
on conflict do nothing;
