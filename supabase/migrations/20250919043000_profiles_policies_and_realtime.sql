-- Enable RLS and policies for public.profiles; add to realtime publication
alter table if exists public.profiles enable row level security;
alter table if exists public.profiles force row level security;

-- Clean existing policies (idempotent)
drop policy if exists "profiles_select_hierarchy" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

-- Hierarchical SELECT
create policy "profiles_select_hierarchy"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin'
    )
    or (
      exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'gerente')
      and manager_id = auth.uid()
    )
    or (
      exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'promotor')
      and promoter_id = auth.uid()
    )
  );

-- Updates: self
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin updates any
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin'))
  with check (exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin'));

-- Realtime
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when others then null; -- idempotent
    end;
  end if;
end $$;

-- Clients RLS (basic ownership + hierarchy)
alter table if exists public.clients enable row level security;
alter table if exists public.clients force row level security;

drop policy if exists "clients_select_hierarchy" on public.clients;
drop policy if exists "clients_insert_owner" on public.clients;
drop policy if exists "clients_update_hierarchy" on public.clients;
drop policy if exists "clients_delete_hierarchy" on public.clients;

-- SELECT: owner sees own; admin sees all; gerente/promotor see asesores bajo su jerarquía
create policy "clients_select_hierarchy"
  on public.clients for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
    or exists (
      select 1
      from public.profiles me
      join public.profiles u on u.id = public.clients.owner_id
      where me.id = auth.uid()
        and (
          (me.role = 'gerente' and u.manager_id = me.id)
          or (me.role = 'promotor' and u.promoter_id = me.id)
        )
    )
  );

-- INSERT: owner can create with owner_id = auth.uid(); admin can create any (optional)
create policy "clients_insert_owner"
  on public.clients for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
  );

-- UPDATE: owner and hierarchy (gerente/promotor/admin) on rows they can see
create policy "clients_update_hierarchy"
  on public.clients for update
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
    or exists (
      select 1
      from public.profiles me
      join public.profiles u on u.id = public.clients.owner_id
      where me.id = auth.uid()
        and (
          (me.role = 'gerente' and u.manager_id = me.id)
          or (me.role = 'promotor' and u.promoter_id = me.id)
        )
    )
  );

-- DELETE: same as update
create policy "clients_delete_hierarchy"
  on public.clients for delete
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin')
    or exists (
      select 1
      from public.profiles me
      join public.profiles u on u.id = public.clients.owner_id
      where me.id = auth.uid()
        and (
          (me.role = 'gerente' and u.manager_id = me.id)
          or (me.role = 'promotor' and u.promoter_id = me.id)
        )
    )
  );

-- Realtime for clients (optional)
do $$ begin
  perform 1 from pg_publication where pubname = 'supabase_realtime';
  if found then
    begin
      alter publication supabase_realtime add table public.clients;
    exception when others then null;
    end;
  end if;
end $$;
