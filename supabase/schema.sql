
-- CUCUTA EMPLEOS - BASE DE DATOS SUPABASE

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'candidate' check (role in ('candidate','employer','admin')),
  company_name text,
  phone text,
  city text,
  professional_title text,
  bio text,
  cv_url text,
  cv_storage_path text,
  skills text,
  education text,
  experience text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company_name text not null,
  city text not null,
  area text not null,
  contract_type text,
  work_mode text,
  description text not null,
  salary text,
  contact_email text,
  is_confidential boolean not null default false,
  status text not null default 'published' check (status in ('draft','published','paused','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','reviewing','interview','contactable','kept_in_file','hired','rejected')),
  cover_letter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cv_viewed_at timestamptz,
  employer_note text,
  unique(job_id,candidate_id)
);

create index if not exists jobs_employer_idx on public.jobs(employer_id, created_at desc);
create index if not exists jobs_status_created_idx on public.jobs(status, created_at desc);
create index if not exists jobs_city_area_idx on public.jobs(city, area);
create index if not exists applications_candidate_idx on public.applications(candidate_id, created_at desc);
create index if not exists applications_job_idx on public.applications(job_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, email, role, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    case when new.raw_user_meta_data->>'role' = 'employer' then 'employer' else 'candidate' end,
    nullif(new.raw_user_meta_data->>'company_name','')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql set search_path = ''
as $
begin
  if new.role is distinct from old.role then
    raise exception 'El rol de usuario no puede modificarse desde el perfil.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
before update on public.profiles
for each row execute procedure public.prevent_profile_role_escalation();
revoke all on function public.prevent_profile_role_escalation() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "profiles_select_self_or_employer_public" on public.profiles
for select to authenticated using (id = (select auth.uid()));

create policy "profiles_insert_self" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));

create policy "profiles_update_self" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "profiles_employer_read_applicants" on public.profiles
for select to authenticated using (
  exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.candidate_id = profiles.id
      and j.employer_id = (select auth.uid())
  )
);

create policy "jobs_public_read" on public.jobs
for select to anon, authenticated using (status = 'published' or employer_id = auth.uid());

create policy "jobs_employer_insert" on public.jobs
for insert to authenticated with check (
  employer_id = auth.uid() and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('employer','admin')
  )
);

create policy "jobs_employer_update" on public.jobs
for update to authenticated using (employer_id = auth.uid()) with check (employer_id = auth.uid());

create policy "jobs_employer_delete" on public.jobs
for delete to authenticated using (employer_id = auth.uid());

create policy "applications_candidate_or_owner_read" on public.applications
for select to authenticated using (
  candidate_id = auth.uid() or exists (
    select 1 from public.jobs j where j.id = job_id and j.employer_id = auth.uid()
  )
);

create policy "applications_candidate_insert" on public.applications
for insert to authenticated with check (
  candidate_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'candidate')
  and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'published')
);

create policy "applications_employer_update" on public.applications
for update to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_id and j.employer_id = auth.uid())
) with check (
  exists (select 1 from public.jobs j where j.id = job_id and j.employer_id = auth.uid())
);

-- Hoja de vida privada: bucket y políticas de acceso por propietario/postulación.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('candidate-cvs','candidate-cvs',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Candidates upload own CV" on storage.objects;
create policy "Candidates upload own CV" on storage.objects for insert to authenticated
with check (bucket_id='candidate-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text and storage.extension(name) in ('pdf','doc','docx'));

drop policy if exists "Candidates update own CV" on storage.objects;
create policy "Candidates update own CV" on storage.objects for update to authenticated
using (bucket_id='candidate-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='candidate-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text and storage.extension(name) in ('pdf','doc','docx'));

drop policy if exists "Candidates delete own CV" on storage.objects;
create policy "Candidates delete own CV" on storage.objects for delete to authenticated
using (bucket_id='candidate-cvs' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "Candidates and hiring employers read CV" on storage.objects;
create policy "Candidates and hiring employers read CV" on storage.objects for select to authenticated
using (bucket_id='candidate-cvs' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or exists (
    select 1 from public.applications a join public.jobs j on j.id=a.job_id
    where a.candidate_id::text=(storage.foldername(name))[1] and j.employer_id=(select auth.uid())
  )
));
