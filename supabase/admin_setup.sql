-- Run in Supabase SQL editor. Adjust column names if your `applications` table differs.
alter table applications
  add column if not exists admin_notes text,
  add column if not exists user_feedback text,
  add column if not exists visa_pdf_url text,
  add column if not exists reviewed_at timestamptz;

-- Admin-only access by JWT email (the anon key stays safe in the browser)
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('tekaa3336@gmail.com')
$$;

create policy "admin read applications"   on applications for select using (public.is_admin());
create policy "admin update applications" on applications for update using (public.is_admin());

-- Realtime
alter publication supabase_realtime add table applications;

-- Storage: private bucket for final visa PDFs
insert into storage.buckets (id, name, public) values ('visa-documents', 'visa-documents', false)
on conflict do nothing;
create policy "admin manage visa pdfs" on storage.objects for all
  using (bucket_id = 'visa-documents' and public.is_admin())
  with check (bucket_id = 'visa-documents' and public.is_admin());
-- Also allow admin to read the user bucket that holds passports/photos (default name: documents):
create policy "admin read user documents" on storage.objects for select
  using (bucket_id = 'documents' and public.is_admin());
-- Create the admin login: Dashboard → Authentication → Add user (password, auto-confirm). No OTP involved.

-- v2: private notes log (jsonb array, synced via realtime) + notification timestamp
alter table applications
  add column if not exists admin_notes_log jsonb not null default '[]'::jsonb,
  add column if not exists notified_at timestamptz;
-- Reminder: the user app must read `status`, `user_feedback` and `visa_pdf_url` to show updates.
-- Never expose `admin_notes_log` to users (it is only reachable by admin under the policies above, but
-- exclude it from any user-facing select or view).

-- v3: full CRUD + settings (run once)
create policy "admin insert applications" on applications for insert with check (public.is_admin());
create policy "admin delete applications" on applications for delete using (public.is_admin());

create table if not exists admin_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);
alter table admin_settings enable row level security;
create policy "admin all settings" on admin_settings for all using (public.is_admin()) with check (public.is_admin());
-- Optional: let the user app read fees / intake status (it contains no secrets, but you may prefer a view with only `fees` and `ops`):
-- create policy "public read settings" on admin_settings for select using (true);
-- Note: manual "New application" inserts fail if your table has NOT NULL columns I don't set (e.g. user_id).

-- v4: related applicant data (names, passports) must be readable by the admin too
grant select, insert, update, delete on public.applicants to authenticated;
drop policy if exists "admin read applicants"   on public.applicants;
drop policy if exists "admin update applicants" on public.applicants;
drop policy if exists "admin insert applicants" on public.applicants;
drop policy if exists "admin delete applicants" on public.applicants;
create policy "admin read applicants"   on public.applicants for select to authenticated using (public.is_admin());
create policy "admin update applicants" on public.applicants for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin insert applicants" on public.applicants for insert to authenticated with check (public.is_admin());
create policy "admin delete applicants" on public.applicants for delete to authenticated using (public.is_admin());

-- v5: documents, services and storage files readable by the admin
grant select on public.documents to authenticated;
drop policy if exists "admin read documents" on public.documents;
create policy "admin read documents" on public.documents for select to authenticated using (public.is_admin());

do $$ begin
  if to_regclass('public.services') is not null then
    execute 'grant select on public.services to authenticated';
    execute 'drop policy if exists "admin read services" on public.services';
    execute 'create policy "admin read services" on public.services for select to authenticated using (public.is_admin())';
  end if;
end $$;

-- lets the dashboard create signed URLs for files in ANY bucket (passports, photos)
drop policy if exists "admin read all storage files" on storage.objects;
create policy "admin read all storage files" on storage.objects for select to authenticated using (public.is_admin());

-- v6: live updates when the applicant row arrives after the application (safe to re-run)
do $$ begin
  begin alter publication supabase_realtime add table public.applicants;
  exception when duplicate_object then null; end;
end $$;

-- v7: applicant contact fallback via the account that created the application (applications.user_id)
create or replace function public.admin_user_contacts(uids uuid[])
returns table (id uuid, email text, phone text)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query select u.id, u.email::text, u.phone::text from auth.users u where u.id = any(uids);
end $$;
revoke all on function public.admin_user_contacts(uuid[]) from public, anon;
grant execute on function public.admin_user_contacts(uuid[]) to authenticated;

do $$ begin
  if to_regclass('public.profiles') is not null then
    execute 'grant select on public.profiles to authenticated';
    execute 'drop policy if exists "admin read profiles" on public.profiles';
    execute 'create policy "admin read profiles" on public.profiles for select to authenticated using (public.is_admin())';
  end if;
end $$;

-- v8: let the admin list storage buckets so the dashboard can find the right one automatically
do $$ begin
  begin
    drop policy if exists "admin list buckets" on storage.buckets;
    create policy "admin list buckets" on storage.buckets for select to authenticated using (public.is_admin());
  exception when others then raise notice 'could not create buckets policy: %', sqlerrm;
  end;
end $$;

-- Diagnostics (run separately): which bucket really holds the files?
-- select id, name, public from storage.buckets;
-- select bucket_id, name from storage.objects where name like '50c9cfcb-45b0-4201-9a60-1a4ad0c2395c/%' limit 10;

-- v9: services management (see also supabase/services_management.sql)
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
