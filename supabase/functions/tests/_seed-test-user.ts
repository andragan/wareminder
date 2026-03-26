import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const userId = Deno.env.get('TEST_USER_ID') ?? '';
const email = Deno.env.get('TEST_USER_EMAIL') ?? '';

const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { error } = await admin.from('user_profiles').upsert({
    id: userId,
    email: email,
    plan_type: 'free',
});

if (error) {
    console.error('Failed to seed test user profile:', error.message);
    Deno.exit(1);
}

console.log('Test user profile seeded successfully.');
