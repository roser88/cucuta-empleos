
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
  data_consent_at timestamptz,
  data_consent_version text,
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
  insert into public.profiles(id, full_name, email, role, company_name, data_consent_at, data_consent_version)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.email,''),
    case when new.raw_user_meta_data->>'role' = 'employer' then 'employer' else 'candidate' end,
    nullif(new.raw_user_meta_data->>'company_name',''),
    case when new.raw_user_meta_data->>'data_consent' = 'true' then now() else null end,
    case when new.raw_user_meta_data->>'data_consent' = 'true' then coalesce(new.raw_user_meta_data->>'data_consent_version','2026-11-15') else null end
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
as $$
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

create or replace function public.current_user_is_candidate()
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'candidate'
  );
$;
revoke all on function public.current_user_is_candidate() from public,anon;
grant execute on function public.current_user_is_candidate() to authenticated;

drop policy if exists applications_candidate_insert on public.applications;
create policy applications_candidate_insert on public.applications
for insert to authenticated with check (
  candidate_id = (select auth.uid())
  and (select public.current_user_is_candidate())
  and exists (select 1 from public.jobs j where j.id = applications.job_id and j.status = 'published')
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

-- Notificaciones internas para empresas y candidatos.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  related_job_id uuid references public.jobs(id) on delete set null,
  related_application_id uuid references public.applications(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create or replace function public.notify_job_application()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare employer uuid; job_title text;
begin
 select j.employer_id,j.title into employer,job_title from public.jobs j where j.id=new.job_id;
 if employer is not null then
  insert into public.notifications(user_id,title,message,related_job_id,related_application_id)
  values(employer,'Nueva postulación','Una persona se postuló a: '||coalesce(job_title,'tu vacante'),new.job_id,new.id);
 end if;
 return new;
end;
$$;
drop trigger if exists notify_employer_new_application on public.applications;
create trigger notify_employer_new_application after insert on public.applications for each row execute procedure public.notify_job_application();
revoke all on function public.notify_job_application() from public,anon,authenticated;

create or replace function public.notify_candidate_application_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare job_title text;
begin
 if new.status is distinct from old.status then
  select j.title into job_title from public.jobs j where j.id=new.job_id;
  insert into public.notifications(user_id,title,message,related_job_id,related_application_id)
  values(new.candidate_id,'Actualización de postulación','Tu postulación a "'||coalesce(job_title,'una vacante')||'" cambió a: '||new.status,new.job_id,new.id);
 end if;
 return new;
end;
$$;
drop trigger if exists notify_candidate_status_change on public.applications;
create trigger notify_candidate_status_change after update of status on public.applications for each row execute procedure public.notify_candidate_application_status();
revoke all on function public.notify_candidate_application_status() from public,anon,authenticated;

-- Impide que una empresa cambie el candidato o la vacante de una postulación.
create or replace function public.prevent_application_identity_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.job_id is distinct from old.job_id or new.candidate_id is distinct from old.candidate_id then
    raise exception 'No se puede cambiar la vacante ni el candidato de una postulación existente.';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_application_identity_change on public.applications;
create trigger prevent_application_identity_change before update on public.applications
for each row execute procedure public.prevent_application_identity_change();
revoke all on function public.prevent_application_identity_change() from public,anon,authenticated;


-- Registro histórico de consultas de hojas de vida y preferencias de correo.
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_cv_viewed boolean not null default true,
  email_application_status boolean not null default true,
  email_new_application boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_read_own on public.notification_preferences;
create policy notification_preferences_read_own on public.notification_preferences for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select,insert,update on public.notification_preferences to authenticated;

create table if not exists public.cv_view_events (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete cascade,
 job_id uuid not null references public.jobs(id) on delete cascade,
 candidate_id uuid not null references public.profiles(id) on delete cascade,
 employer_id uuid not null references public.profiles(id) on delete cascade,
 viewed_at timestamptz not null default now()
);
create index if not exists cv_view_events_candidate_viewed_idx on public.cv_view_events(candidate_id,viewed_at desc);
create index if not exists cv_view_events_application_idx on public.cv_view_events(application_id,viewed_at desc);
alter table public.cv_view_events enable row level security;
drop policy if exists cv_views_employer_insert_authorized on public.cv_view_events;
create policy cv_views_employer_insert_authorized on public.cv_view_events for insert to authenticated with check (
 employer_id=(select auth.uid()) and exists (
  select 1 from public.jobs j join public.applications a on a.job_id=j.id
  where j.id=cv_view_events.job_id and j.employer_id=(select auth.uid())
   and a.id=cv_view_events.application_id and a.candidate_id=cv_view_events.candidate_id
 )
);
drop policy if exists cv_views_candidate_read_own on public.cv_view_events;
create policy cv_views_candidate_read_own on public.cv_view_events for select to authenticated using (candidate_id=(select auth.uid()));
drop policy if exists cv_views_employer_read_own on public.cv_view_events;
create policy cv_views_employer_read_own on public.cv_view_events for select to authenticated using (employer_id=(select auth.uid()));
grant select,insert on public.cv_view_events to authenticated;

create or replace function public.sync_cv_view_timestamp()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 update public.applications set cv_viewed_at=new.viewed_at
 where id=new.application_id and (cv_viewed_at is null or new.viewed_at>cv_viewed_at);
 return new;
end;
$$;
drop trigger if exists sync_cv_view_timestamp on public.cv_view_events;
create trigger sync_cv_view_timestamp after insert on public.cv_view_events for each row execute procedure public.sync_cv_view_timestamp();
revoke all on function public.sync_cv_view_timestamp() from public,anon,authenticated;


-- Extensiones funcionales: privacidad y autorización, perfiles y reseñas públicas.
alter table public.profiles add column if not exists data_consent_at timestamptz;
alter table public.profiles add column if not exists data_consent_version text;
alter table public.applications add column if not exists data_consent boolean not null default false;
alter table public.applications add column if not exists data_consent_at timestamptz;
alter table public.applications add column if not exists data_consent_version text;
create table if not exists public.company_profiles (company_id uuid primary key references public.profiles(id) on delete cascade,public_name text not null,city text,description text,website text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.company_profiles enable row level security;
drop policy if exists company_profiles_public_read on public.company_profiles;
create policy company_profiles_public_read on public.company_profiles for select to anon,authenticated using(true);
drop policy if exists company_profiles_owner_insert on public.company_profiles;
create policy company_profiles_owner_insert on public.company_profiles for insert to authenticated with check(company_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in('employer','admin')));
drop policy if exists company_profiles_owner_update on public.company_profiles;
create policy company_profiles_owner_update on public.company_profiles for update to authenticated using(company_id=(select auth.uid())) with check(company_id=(select auth.uid()));
grant select on public.company_profiles to anon,authenticated;
grant insert,update on public.company_profiles to authenticated;
create table if not exists public.company_reviews(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.profiles(id) on delete cascade,candidate_id uuid not null references public.profiles(id) on delete cascade,rating smallint not null check(rating between 1 and 5),comment text not null check(char_length(comment) between 5 and 1200),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(company_id,candidate_id));
create index if not exists company_reviews_company_idx on public.company_reviews(company_id,created_at desc);
alter table public.company_reviews enable row level security;
drop policy if exists company_reviews_public_read on public.company_reviews;
create policy company_reviews_public_read on public.company_reviews for select to anon,authenticated using(true);
drop policy if exists company_reviews_candidate_insert on public.company_reviews;
create policy company_reviews_candidate_insert on public.company_reviews for insert to authenticated with check(candidate_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='candidate') and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.candidate_id=(select auth.uid()) and j.employer_id=company_reviews.company_id));
drop policy if exists company_reviews_candidate_update on public.company_reviews;
create policy company_reviews_candidate_update on public.company_reviews for update to authenticated using(candidate_id=(select auth.uid())) with check(candidate_id=(select auth.uid()));
grant select on public.company_reviews to anon,authenticated;
grant insert,update on public.company_reviews to authenticated;
drop policy if exists applications_candidate_insert on public.applications;
create policy applications_candidate_insert on public.applications for insert to authenticated with check(candidate_id=(select auth.uid()) and data_consent=true and data_consent_at is not null and data_consent_version='2026-11-15' and (select public.current_user_is_candidate()) and exists(select 1 from public.jobs j where j.id=applications.job_id and j.status='published'));
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.profiles(id,full_name,email,role,company_name,data_consent_at,data_consent_version)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),case when new.raw_user_meta_data->>'role'='employer' then 'employer' else 'candidate' end,nullif(new.raw_user_meta_data->>'company_name',''),nullif(new.raw_user_meta_data->>'data_consent_at','')::timestamptz,nullif(new.raw_user_meta_data->>'data_consent_version',''));
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create or replace function public.sync_company_public_profile()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.role in('employer','admin') then
  insert into public.company_profiles(company_id,public_name,city) values(new.id,coalesce(nullif(new.company_name,''),nullif(new.full_name,''),'Empresa'),new.city)
  on conflict(company_id) do update set public_name=excluded.public_name,city=excluded.city,updated_at=now();
 end if;return new;
end;
$$;
drop trigger if exists sync_company_public_profile on public.profiles;
create trigger sync_company_public_profile after insert or update of company_name,city,role on public.profiles for each row execute procedure public.sync_company_public_profile();
revoke all on function public.sync_company_public_profile() from public,anon,authenticated;
insert into public.company_profiles(company_id,public_name,city) select id,coalesce(nullif(company_name,''),nullif(full_name,''),'Empresa'),city from public.profiles where role in('employer','admin') on conflict(company_id) do update set public_name=excluded.public_name,city=excluded.city;

-- Refuerzo: la función de rol opera con permisos del usuario y la opinión no puede cambiar de autor/empresa.
create or replace function public.current_user_is_candidate()
returns boolean language sql stable security invoker set search_path=''
as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='candidate'); $$;
revoke all on function public.current_user_is_candidate() from public,anon;
grant execute on function public.current_user_is_candidate() to authenticated;
create or replace function public.prevent_company_review_identity_change()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.company_id is distinct from old.company_id or new.candidate_id is distinct from old.candidate_id then raise exception 'No se puede cambiar la empresa ni el autor de una opinión existente.'; end if;
 return new;
end;
$$;
drop trigger if exists prevent_company_review_identity_change on public.company_reviews;
create trigger prevent_company_review_identity_change before update on public.company_reviews for each row execute procedure public.prevent_company_review_identity_change();
revoke all on function public.prevent_company_review_identity_change() from public,anon,authenticated;


-- Protege la evidencia de autorización: no puede alterarse después de crear la postulación.
create or replace function public.prevent_application_consent_change()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.data_consent is distinct from old.data_consent or new.data_consent_at is distinct from old.data_consent_at or new.data_consent_version is distinct from old.data_consent_version then
  raise exception 'La evidencia de autorización de una postulación no puede modificarse.';
 end if;
 return new;
end;
$$;
drop trigger if exists prevent_application_consent_change on public.applications;
create trigger prevent_application_consent_change before update on public.applications for each row execute procedure public.prevent_application_consent_change();
revoke all on function public.prevent_application_consent_change() from public,anon,authenticated;


-- Registro de autorización con sello de tiempo del servidor y protección de integridad.
alter table public.profiles add column if not exists data_consent boolean not null default false;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if coalesce(new.raw_user_meta_data->>'data_consent','false') <> 'true' or coalesce(new.raw_user_meta_data->>'data_consent_version','') <> '2026-11-15' then raise exception 'Se requiere autorización expresa para crear la cuenta.'; end if;
 insert into public.profiles(id,full_name,email,role,company_name,data_consent,data_consent_at,data_consent_version)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),case when new.raw_user_meta_data->>'role'='employer' then 'employer' else 'candidate' end,nullif(new.raw_user_meta_data->>'company_name',''),true,now(),'2026-11-15');
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
create or replace function public.enforce_application_consent()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.data_consent is distinct from true or new.data_consent_version is distinct from '2026-11-15' then raise exception 'Se requiere autorización expresa para enviar la postulación.'; end if;
 new.data_consent_at:=now();return new;
end;
$$;
drop trigger if exists enforce_application_consent on public.applications;
create trigger enforce_application_consent before insert on public.applications for each row execute procedure public.enforce_application_consent();
revoke all on function public.enforce_application_consent() from public,anon,authenticated;
create or replace function public.prevent_profile_consent_change()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.data_consent is distinct from old.data_consent or new.data_consent_at is distinct from old.data_consent_at or new.data_consent_version is distinct from old.data_consent_version then raise exception 'La evidencia de autorización de la cuenta no puede modificarse.'; end if;
 return new;
end;
$$;
drop trigger if exists prevent_profile_consent_change on public.profiles;
create trigger prevent_profile_consent_change before update on public.profiles for each row execute procedure public.prevent_profile_consent_change();
revoke all on function public.prevent_profile_consent_change() from public,anon,authenticated;

-- Tablas del panel administrador.
create table if not exists public.site_banners(id uuid primary key default gen_random_uuid(),title text not null,subtitle text,image_path text,image_url text,target_url text,placement text not null default 'home' check(placement in('home','companies','jobs')),is_active boolean not null default true,sort_order integer not null default 0,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.site_announcements(id uuid primary key default gen_random_uuid(),title text not null,body text not null,kind text not null default 'info' check(kind in('info','success','warning')),is_active boolean not null default true,starts_at timestamptz,ends_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.site_error_reports(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,page_url text,description text not null,status text not null default 'open' check(status in('open','investigating','resolved','ignored')),admin_notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.site_banners enable row level security;alter table public.site_announcements enable row level security;alter table public.site_error_reports enable row level security;
create schema if not exists private;revoke all on schema private from public,anon,authenticated;grant usage on schema private to authenticated;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'); $$;
revoke all on function private.is_admin() from public,anon;grant execute on function private.is_admin() to authenticated;
create policy site_banners_public_read on public.site_banners for select to anon,authenticated using(is_active=true);
create policy site_banners_admin_all on public.site_banners for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy site_announcements_public_read on public.site_announcements for select to anon,authenticated using(is_active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()));
create policy site_announcements_admin_all on public.site_announcements for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy site_error_reports_user_insert on public.site_error_reports for insert to authenticated with check(user_id=(select auth.uid()));
create policy site_error_reports_admin_all on public.site_error_reports for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy profiles_admin_read on public.profiles for select to authenticated using(private.is_admin());
create policy jobs_admin_all on public.jobs for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy applications_admin_all on public.applications for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy company_reviews_admin_all on public.company_reviews for all to authenticated using(private.is_admin()) with check(private.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-assets','site-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml']) on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];
create policy site_assets_public_read on storage.objects for select to anon,authenticated using(bucket_id='site-assets');
create policy site_assets_admin_insert on storage.objects for insert to authenticated with check(bucket_id='site-assets' and private.is_admin());
create policy site_assets_admin_update on storage.objects for update to authenticated using(bucket_id='site-assets' and private.is_admin()) with check(bucket_id='site-assets' and private.is_admin());
create policy site_assets_admin_delete on storage.objects for delete to authenticated using(bucket_id='site-assets' and private.is_admin());

-- Panel de administración y rol inicial.
-- La promoción inicial se ejecutó como migración de base de datos sobre la cuenta ya existente.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'); $$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated;
create table if not exists public.site_banners(id uuid primary key default gen_random_uuid(),title text not null,subtitle text,image_path text,image_url text,target_url text,placement text not null default 'home' check(placement in('home','companies','jobs')),is_active boolean not null default true,sort_order integer not null default 0,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.site_announcements(id uuid primary key default gen_random_uuid(),title text not null,body text not null,kind text not null default 'info' check(kind in('info','success','warning')),is_active boolean not null default true,starts_at timestamptz,ends_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.site_error_reports(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,page_url text,description text not null,status text not null default 'open' check(status in('open','investigating','resolved','ignored')),admin_notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.site_banners enable row level security;alter table public.site_announcements enable row level security;alter table public.site_error_reports enable row level security;
drop policy if exists site_banners_public_read on public.site_banners;create policy site_banners_public_read on public.site_banners for select to anon,authenticated using(is_active=true);
drop policy if exists site_banners_admin_all on public.site_banners;create policy site_banners_admin_all on public.site_banners for all to authenticated using(private.is_admin()) with check(private.is_admin());
drop policy if exists site_announcements_public_read on public.site_announcements;create policy site_announcements_public_read on public.site_announcements for select to anon,authenticated using(is_active=true and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()));
drop policy if exists site_announcements_admin_all on public.site_announcements;create policy site_announcements_admin_all on public.site_announcements for all to authenticated using(private.is_admin()) with check(private.is_admin());
drop policy if exists site_error_reports_user_insert on public.site_error_reports;create policy site_error_reports_user_insert on public.site_error_reports for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists site_error_reports_admin_all on public.site_error_reports;create policy site_error_reports_admin_all on public.site_error_reports for all to authenticated using(private.is_admin()) with check(private.is_admin());
drop policy if exists profiles_admin_read on public.profiles;create policy profiles_admin_read on public.profiles for select to authenticated using(private.is_admin());
drop policy if exists jobs_admin_all on public.jobs;create policy jobs_admin_all on public.jobs for all to authenticated using(private.is_admin()) with check(private.is_admin());
drop policy if exists applications_admin_all on public.applications;create policy applications_admin_all on public.applications for all to authenticated using(private.is_admin()) with check(private.is_admin());
drop policy if exists company_reviews_admin_all on public.company_reviews;create policy company_reviews_admin_all on public.company_reviews for all to authenticated using(private.is_admin()) with check(private.is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-assets','site-assets',true,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists site_assets_public_read on storage.objects;create policy site_assets_public_read on storage.objects for select to anon,authenticated using(bucket_id='site-assets');
drop policy if exists site_assets_admin_insert on storage.objects;create policy site_assets_admin_insert on storage.objects for insert to authenticated with check(bucket_id='site-assets' and private.is_admin());
drop policy if exists site_assets_admin_update on storage.objects;create policy site_assets_admin_update on storage.objects for update to authenticated using(bucket_id='site-assets' and private.is_admin()) with check(bucket_id='site-assets' and private.is_admin());
drop policy if exists site_assets_admin_delete on storage.objects;create policy site_assets_admin_delete on storage.objects for delete to authenticated using(bucket_id='site-assets' and private.is_admin());
