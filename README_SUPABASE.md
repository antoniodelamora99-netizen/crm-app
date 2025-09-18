Supabase setup (email-first, hierarchical)

1) Env vars (Vercel/Local)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE (server only, do NOT expose)
- ADMIN_BOOTSTRAP_TOKEN (random long secret to seed the first admin)

2) Database SQL (run in Supabase SQL editor)
- Run supabase/sql/handle_new_user.sql
- Run supabase/sql/policies_profiles.sql

Notes:
- handle_new_user() inserts/upserts into public.profiles with { id, email, display_name, role }.
- Policies enable hierarchical visibility: self, admin (all), gerente (manager_id), promotor (promoter_id). Updates: self or admin.

3) Bootstrap first admin (one-time)
- Deploy with ADMIN_BOOTSTRAP_TOKEN set.
- POST /api/admin/bootstrap with headers: Authorization: Bearer <ADMIN_BOOTSTRAP_TOKEN>
  Body: { "email": "admin@example.com", "password": "<min 6>", "name": "Admin" }
- On success, sign in with that email/password and create more users from /users (admin modal).

4) Status and health
- /status shows session/profile info.
- /api/health returns presence of envs.

5) Optional
- Backfill existing profiles: ensure email/display_name not null.
- Add similar RLS to other tables (clients, policies, activities) using owner_id or manager/promoter references.
