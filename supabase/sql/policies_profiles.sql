-- RLS policies for public.profiles with hierarchical visibility
-- Assumes columns: id (uuid, PK, = auth.users.id), email, display_name, role, manager_id, promoter_id

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Clean existing policies (safe to re-run)
drop policy if exists "profiles_select_hierarchy" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

-- Hierarchical SELECT
create policy "profiles_select_hierarchy"
  on public.profiles for select
  to authenticated
  using (
    -- Self can see self
    id = auth.uid()
    -- Admins see everyone
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    -- Gerentes see rows they manage
    or (
      exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'gerente')
      and manager_id = auth.uid()
    )
    -- Promotores see rows they promote
    or (
      exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'promotor')
      and promoter_id = auth.uid()
    )
  );

-- Updates: users can update only their own row
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can update any row
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );
