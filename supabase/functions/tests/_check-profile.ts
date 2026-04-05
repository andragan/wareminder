import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Checks user state from auth.users and subscriptions.
// user_profiles has been removed; identity is anchored to auth.users.

const url = Deno.env.get('SUPABASE_URL') ?? '';
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const userId = Deno.env.get('TEST_USER_ID') ?? '';

const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId);
console.log('auth.users row:', authUser?.user);
console.log('auth.users error:', userError);

const { data: subscription, error: subError } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId);
console.log('subscriptions row:', subscription);
console.log('subscriptions error:', subError);
