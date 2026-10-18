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
