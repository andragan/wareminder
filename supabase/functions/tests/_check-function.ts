import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const email = Deno.env.get('TEST_USER_EMAIL') ?? '';
const password = Deno.env.get('TEST_USER_PASSWORD') ?? '';

const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// Sign in so the client holds a valid session
const { error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) {
    console.error('Sign-in failed:', signInError.message);
    Deno.exit(1);
}

// Invoke via the client library (handles all auth headers automatically)
const { data, error } = await client.functions.invoke('create-xendit-invoice', {
    body: {},
});

console.log('Error:', error);
console.log('Data:', data);

