#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

function expectEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`[seed-promotor] Missing environment variable: ${name}`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const url = expectEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!serviceKey) {
    console.error('[seed-promotor] Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE) env');
    process.exit(1);
  }

  const email = process.env.SEED_PROMOTOR_EMAIL || 'promotor.demo@example.com';
  const password = process.env.SEED_PROMOTOR_PASSWORD || 'Promotor123!';
  const fullName = process.env.SEED_PROMOTOR_NAME || 'Promotor Demo';
  const shouldConfirmEmail = (process.env.SEED_PROMOTOR_CONFIRM_EMAIL || 'false').toLowerCase() === 'true';

  console.log(`[seed-promotor] Target URL: ${url}`);
  console.log(`[seed-promotor] User email: ${email}`);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rolesRes = await supabase
    .from('roles')
    .select('id, slug')
    .eq('slug', 'promotor')
    .maybeSingle();

  if (rolesRes.error) {
    console.error('[seed-promotor] Failed to read roles table:', rolesRes.error.message);
    process.exit(1);
  }
  if (!rolesRes.data) {
    console.error("[seed-promotor] Role 'promotor' not found. Run the SQL migrations first.");
    process.exit(1);
  }

  const roleId = rolesRes.data.id;

  const existingAuth = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (existingAuth.error) {
    console.error('[seed-promotor] Unable to list users:', existingAuth.error.message);
    process.exit(1);
  }
  const already = existingAuth.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (already) {
    console.log('[seed-promotor] User already exists in auth.users. Skipping creation.');
  }

  let userId = already?.id || null;
  if (!userId) {
    const createRes = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: shouldConfirmEmail,
      user_metadata: { display_name: fullName },
    });
    if (createRes.error) {
      console.error('[seed-promotor] Failed to create auth user:', createRes.error.message);
      process.exit(1);
    }
    userId = createRes.data.user?.id || null;
  }

  if (!userId) {
    console.error('[seed-promotor] No user id returned after creation.');
    process.exit(1);
  }

  const profilePayload = {
    id: userId,
    email,
    display_name: fullName,
    active_role_id: roleId,
    manager_id: null,
    promoter_id: null,
  };

  const profileRes = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('id')
    .maybeSingle();

  if (profileRes.error) {
    console.error('[seed-promotor] Failed to upsert profile:', profileRes.error.message);
    process.exit(1);
  }

  const linkRes = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id,role_id' })
    .select('user_id')
    .maybeSingle();

  if (linkRes.error) {
    console.error('[seed-promotor] Failed to upsert user_roles:', linkRes.error.message);
    process.exit(1);
  }

  console.log('[seed-promotor] ✅ Promotor user ready:', userId);
}

main().catch((err) => {
  console.error('[seed-promotor] Unexpected error:', err);
  process.exit(1);
});
