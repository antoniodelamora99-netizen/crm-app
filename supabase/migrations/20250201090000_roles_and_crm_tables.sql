-- Migrate legacy local-first data model to managed Supabase tables with role hierarchy
-- Run after linking project: supabase db push or via SQL editor

set search_path = public;

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists "pgcrypto";

-- ============================================================================
-- Roles dictionary + assignment bridge (user_roles)
-- ============================================================================

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.roles (slug, name, description)
values
  ('promotor', 'Promotor', 'Promotor responsable de una red de gerentes y asesores'),
  ('gerente', 'Gerente', 'Gerente que supervisa asesores'),
  ('asesor', 'Asesor', 'Asesor que opera con clientes finales'),
  ('admin', 'Administrador', 'Control total de la plataforma')
on conflict (slug) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  primary key (user_id, role_id)
);

create index if not exists idx_user_roles_role on public.user_roles(role_id);

-- Profiles: add active_role_id pointer (nullable until assignment) + constraints
alter table public.profiles
  add column if not exists active_role_id uuid references public.roles(id);

alter table public.profiles
  add column if not exists created_at timestamptz not null default now();

create index if not exists idx_profiles_active_role on public.profiles(active_role_id);
create index if not exists idx_profiles_manager on public.profiles(manager_id);
create index if not exists idx_profiles_promoter on public.profiles(promoter_id);

-- Helper functions for RLS (security definer to access user_roles)
create or replace function public.has_role(role_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.slug = role_slug
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') = role_slug
  );
$$;

create or replace function public.can_access_owner(target_owner uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    target_owner = auth.uid()
    or public.has_role('admin')
    or (
      public.has_role('promotor')
      and exists (
        select 1
        from public.profiles child
        where child.id = target_owner
          and child.promoter_id = auth.uid()
      )
    )
    or (
      public.has_role('gerente')
      and exists (
        select 1
        from public.profiles child
        where child.id = target_owner
          and child.manager_id = auth.uid()
      )
    );
$$;

-- ============================================================================
-- RLS policies for roles / user_roles / profiles
-- ============================================================================

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists roles_read_all on public.roles;
create policy roles_read_all
  on public.roles
  for select
  to authenticated
  using (true);

drop policy if exists user_roles_read_self on public.user_roles;
create policy user_roles_read_self
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));

drop policy if exists user_roles_manage_admin on public.user_roles;
create policy user_roles_manage_admin
  on public.user_roles
  for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- Profiles select/update using hierarchical access (legacy compatible)
drop policy if exists profiles_select_hierarchy on public.profiles;
create policy profiles_select_hierarchy
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.has_role('admin')
    or (public.has_role('promotor') and promoter_id = auth.uid())
    or (public.has_role('gerente') and manager_id = auth.uid())
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ============================================================================
-- CRM domain tables (clients, policies, activities, goals, medical, kb)
-- ============================================================================

create table if not exists public.clients (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  apellido_paterno text,
  apellido_materno text,
  telefono text,
  email text,
  fecha_nacimiento date,
  sexo text check (sexo in ('Masculino','Femenino','Otro') or sexo is null),
  estado_civil text,
  estado_residencia text,
  ocupacion text,
  empresa text,
  ingreso_hogar numeric,
  dependientes integer,
  fumador boolean,
  fuente text,
  estatus text,
  referido_por_id text,
  ultimo_contacto date,
  notas text,
  anf_realizado boolean,
  anf_fecha date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contactado boolean not null default false,
  contactado_fecha timestamptz,
  pipeline text,
  constraint chk_clients_estatus check (estatus in ('Prospecto','Interesado','Cliente','Inactivo','Referido','No interesado') or estatus is null)
);

create index if not exists idx_clients_owner on public.clients(owner_id);

create table if not exists public.policies (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  cliente_id text not null references public.clients(id) on delete cascade,
  plan text not null,
  numero_poliza text,
  estado text,
  suma_asegurada numeric,
  prima_mensual numeric,
  fecha_ingreso date,
  fecha_examen_medico date,
  forma_pago text,
  fecha_pago date,
  fecha_entrega date,
  comision_estimada numeric,
  participa_mdrt boolean,
  participa_convencion boolean,
  participa_reconocimiento boolean,
  necesidades_futuras text,
  proximo_seguimiento date,
  pdf_url text,
  moneda text,
  msi boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_policies_estado check (estado in ('Vigente','Propuesta','Rechazada','En proceso') or estado is null),
  constraint chk_policies_forma_pago check (forma_pago in ('Mensual','Trimestral','Semestral','Anual') or forma_pago is null)
);

create index if not exists idx_policies_owner on public.policies(owner_id);
create index if not exists idx_policies_cliente on public.policies(cliente_id);

create table if not exists public.activities (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  cliente_id text references public.clients(id) on delete set null,
  tipo text not null,
  fecha_hora timestamptz not null,
  fecha_hora_fin timestamptz,
  lugar text,
  notas text,
  realizada boolean,
  genero_cierre boolean,
  obtuvo_referidos boolean,
  reagendada boolean,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_activities_tipo check (tipo in ('Llamada','Cita Inicial','Cita Cierre','Entrega','Seguimiento'))
);

create index if not exists idx_activities_owner on public.activities(owner_id);
create index if not exists idx_activities_cliente on public.activities(cliente_id);

create table if not exists public.goals (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  mes text not null,
  meta_mensual numeric,
  meta_anual numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_goals_tipo check (tipo in ('Ingreso mensual','Pólizas mensuales','Citas semanales','Referidos'))
);

create index if not exists idx_goals_owner on public.goals(owner_id);
create index if not exists idx_goals_mes on public.goals(mes);

create table if not exists public.medical_forms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid not null references public.clients(id) on delete cascade,
  fecha date not null,
  enfermedades text,
  hospitalizacion text,
  medicamentos text,
  cirugias text,
  antecedentes text,
  otros text,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medical_forms_owner on public.medical_forms(owner_id);
create index if not exists idx_medical_forms_cliente on public.medical_forms(cliente_id);

create table if not exists public.kb_sections (
  id text primary key,
  owner_id uuid references auth.users (id) on delete set null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_files (
  id text primary key,
  section_id text not null references public.kb_sections(id) on delete cascade,
  owner_id uuid references auth.users (id) on delete set null,
  name text not null,
  size bigint,
  mime_type text,
  storage_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_kb_files_section on public.kb_files(section_id);

-- ============================================================================
-- Common RLS policies for CRM tables using can_access_owner()
-- ============================================================================

alter table public.clients enable row level security;
alter table public.clients force row level security;

drop policy if exists clients_select_access on public.clients;
create policy clients_select_access
  on public.clients for select to authenticated
  using (public.can_access_owner(owner_id));

drop policy if exists clients_insert_owner on public.clients;
create policy clients_insert_owner
  on public.clients for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role('admin'));

drop policy if exists clients_update_access on public.clients;
create policy clients_update_access
  on public.clients for update to authenticated
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));

drop policy if exists clients_delete_access on public.clients;
create policy clients_delete_access
  on public.clients for delete to authenticated
  using (public.can_access_owner(owner_id));

-- Policies
alter table public.policies enable row level security;
alter table public.policies force row level security;

drop policy if exists policies_select_access on public.policies;
create policy policies_select_access
  on public.policies for select to authenticated
  using (public.can_access_owner(owner_id));

drop policy if exists policies_insert_owner on public.policies;
create policy policies_insert_owner
  on public.policies for insert to authenticated
  with check (
    owner_id = auth.uid()
    or public.has_role('admin')
    or (public.has_role('promotor') and public.can_access_owner(owner_id))
  );

drop policy if exists policies_update_access on public.policies;
create policy policies_update_access
  on public.policies for update to authenticated
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));

drop policy if exists policies_delete_access on public.policies;
create policy policies_delete_access
  on public.policies for delete to authenticated
  using (public.can_access_owner(owner_id));

-- Activities
alter table public.activities enable row level security;
alter table public.activities force row level security;

drop policy if exists activities_select_access on public.activities;
create policy activities_select_access
  on public.activities for select to authenticated
  using (public.can_access_owner(owner_id));

drop policy if exists activities_insert_owner on public.activities;
create policy activities_insert_owner
  on public.activities for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role('admin'));

drop policy if exists activities_update_access on public.activities;
create policy activities_update_access
  on public.activities for update to authenticated
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));

drop policy if exists activities_delete_access on public.activities;
create policy activities_delete_access
  on public.activities for delete to authenticated
  using (public.can_access_owner(owner_id));

-- Goals
alter table public.goals enable row level security;
alter table public.goals force row level security;

drop policy if exists goals_select_access on public.goals;
create policy goals_select_access
  on public.goals for select to authenticated
  using (public.can_access_owner(owner_id));

drop policy if exists goals_insert_owner on public.goals;
create policy goals_insert_owner
  on public.goals for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role('admin'));

drop policy if exists goals_update_access on public.goals;
create policy goals_update_access
  on public.goals for update to authenticated
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));

drop policy if exists goals_delete_access on public.goals;
create policy goals_delete_access
  on public.goals for delete to authenticated
  using (public.can_access_owner(owner_id));

-- Medical forms
alter table public.medical_forms enable row level security;
alter table public.medical_forms force row level security;

drop policy if exists medical_forms_select_access on public.medical_forms;
create policy medical_forms_select_access
  on public.medical_forms for select to authenticated
  using (public.can_access_owner(owner_id));

drop policy if exists medical_forms_insert_owner on public.medical_forms;
create policy medical_forms_insert_owner
  on public.medical_forms for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role('admin'));

drop policy if exists medical_forms_update_access on public.medical_forms;
create policy medical_forms_update_access
  on public.medical_forms for update to authenticated
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));

drop policy if exists medical_forms_delete_access on public.medical_forms;
create policy medical_forms_delete_access
  on public.medical_forms for delete to authenticated
  using (public.can_access_owner(owner_id));

-- KB sections/files (read within hierarchy, owners manage)
alter table public.kb_sections enable row level security;
alter table public.kb_sections force row level security;

drop policy if exists kb_sections_select_access on public.kb_sections;
create policy kb_sections_select_access
  on public.kb_sections for select to authenticated
  using (owner_id is null or public.can_access_owner(owner_id));

drop policy if exists kb_sections_modify_owner on public.kb_sections;
create policy kb_sections_modify_owner
  on public.kb_sections for all to authenticated
  using (owner_id is null or owner_id = auth.uid() or public.has_role('admin'))
  with check (owner_id is null or owner_id = auth.uid() or public.has_role('admin'));

alter table public.kb_files enable row level security;
alter table public.kb_files force row level security;

drop policy if exists kb_files_select_access on public.kb_files;
create policy kb_files_select_access
  on public.kb_files for select to authenticated
  using (owner_id is null or public.can_access_owner(owner_id));

drop policy if exists kb_files_modify_owner on public.kb_files;
create policy kb_files_modify_owner
  on public.kb_files for all to authenticated
  using (owner_id is null or owner_id = auth.uid() or public.has_role('admin'))
  with check (owner_id is null or owner_id = auth.uid() or public.has_role('admin'));

-- ============================================================================
-- Trigger helpers to maintain updated_at timestamps
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clients_touch on public.clients;
create trigger trg_clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_policies_touch on public.policies;
create trigger trg_policies_touch before update on public.policies
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_activities_touch on public.activities;
create trigger trg_activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_goals_touch on public.goals;
create trigger trg_goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_medical_forms_touch on public.medical_forms;
create trigger trg_medical_forms_touch before update on public.medical_forms
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_kb_sections_touch on public.kb_sections;
create trigger trg_kb_sections_touch before update on public.kb_sections
  for each row execute function public.touch_updated_at();

-- kb_files has no updated_at column; skip trigger

-- ============================================================================
-- Publication for realtime (profiles + clients + activities etc.)
-- ============================================================================

do $$
begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin
      alter publication supabase_realtime add table public.profiles;
      alter publication supabase_realtime add table public.clients;
      alter publication supabase_realtime add table public.policies;
      alter publication supabase_realtime add table public.activities;
      alter publication supabase_realtime add table public.goals;
    exception when others then null;
    end;
  end if;
end $$;
