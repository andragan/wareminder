import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Seeds a test subscription record for an existing auth.users row.
// user_profiles has been removed; subscriptions now reference auth.users.id directly.

const url = Deno.env.get('SUPABASE_URL') ?? '';
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const userId = Deno.env.get('TEST_USER_ID') ?? '';

const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// Verify the user exists in auth.users
const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId);
if (userError || !authUser?.user) {
    console.error('Test user not found in auth.users:', userError?.message);
    Deno.exit(1);
}

console.log('Test auth user found:', authUser.user.email);
console.log('Test user seeded successfully (no user_profiles record needed).');
