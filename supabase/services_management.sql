-- Services management: full admin read/write on public.services + the columns the dashboard edits.
-- Safe to run more than once. Requires public.is_admin() (defined in admin_setup.sql / fix_admin_access.sql).

-- 1) Add any missing column (is_available is the important one for the user app). A column is only added when
--    none of its usual names already exists, so an existing name_en / is_active etc. is reused, never duplicated.
do $$
declare
  spec jsonb := '[
    {"cols":["name","name_en","title","label"],            "add":"name text"},
    {"cols":["code","slug","key","category","type"],       "add":"code text"},
    {"cols":["description","description_en","details"],    "add":"description text"},
    {"cols":["service_fee"],                               "add":"service_fee numeric(10,2) not null default 0"},
    {"cols":["government_fee","gov_fee"],                  "add":"government_fee numeric(10,2) not null default 0"},
    {"cols":["total_cost","total","price"],                "add":"total_cost numeric(10,2) not null default 0"},
    {"cols":["is_available","available","is_active","active"], "add":"is_available boolean not null default true"}
  ]'::jsonb;
  item jsonb;
begin
  if to_regclass('public.services') is null then raise exception 'public.services does not exist'; end if;
  for item in select * from jsonb_array_elements(spec) loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'services'
        and column_name in (select jsonb_array_elements_text(item -> 'cols'))
    ) then
      execute format('alter table public.services add column %s', item ->> 'add');
    end if;
  end loop;
end $$;

-- 2) Permissions: admins can read, create, update and delete services
grant select, insert, update, delete on public.services to authenticated;
alter table public.services enable row level security;

drop policy if exists "admin read services"   on public.services;
drop policy if exists "admin insert services" on public.services;
drop policy if exists "admin update services" on public.services;
drop policy if exists "admin delete services" on public.services;
create policy "admin read services"   on public.services for select to authenticated using (public.is_admin());
create policy "admin insert services" on public.services for insert to authenticated with check (public.is_admin());
create policy "admin update services" on public.services for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete services" on public.services for delete to authenticated using (public.is_admin());

-- 3) Live refresh in the dashboard (ignore if already added)
do $$ begin
  begin alter publication supabase_realtime add table public.services;
  exception when duplicate_object then null; end;
end $$;

-- 4) Optional, for the user app: let everyone read services (it can then filter on is_available).
--    Only run this if your user app does not already have a read policy on services.
-- create policy "public read services" on public.services for select to anon, authenticated using (true);
