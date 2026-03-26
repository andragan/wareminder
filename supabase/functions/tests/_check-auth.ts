import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const email = Deno.env.get('TEST_USER_EMAIL') ?? '';
const password = Deno.env.get('TEST_USER_PASSWORD') ?? '';

const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { data, error } = await client.auth.signInWithPassword({ email, password });
if (error) {
    console.error('Sign-in FAILED:', error.message);
    Deno.exit(1);
}
console.log('Sign-in OK, JWT length:', data.session?.access_token?.length);
console.log('User ID:', data.session?.user?.id);
