-- Admin read access for every table the dashboard joins. Safe to run more than once.
-- NOTE: policies use public.is_admin(), NOT "using (true)": regular applicants are also `authenticated`,
-- and a blanket policy would let any signed-in user read everyone's passports.

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('tekaa3336@gmail.com')
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

do $$
declare t text;
begin
  foreach t in array array['applications', 'applicants', 'documents', 'services'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on public.%I to authenticated', t);
      execute format('drop policy if exists "admin read %s" on public.%I', t, t);
      execute format('create policy "admin read %s" on public.%I for select to authenticated using (public.is_admin())', t, t);
    end if;
  end loop;
end $$;

drop policy if exists "admin read all storage files" on storage.objects;
create policy "admin read all storage files" on storage.objects for select to authenticated using (public.is_admin());

-- Simulate the admin login (does not change anything). Each count should match the totals in the table editor.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"tekaa3336@gmail.com","role":"authenticated"}', true);
select 'applications' as tbl, count(*) from public.applications
union all select 'applicants', count(*) from public.applicants
union all select 'documents', count(*) from public.documents;
rollback;
