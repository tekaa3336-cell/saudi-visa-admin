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
