// Quick test: call the function with full body and print response text
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const email = Deno.env.get('TEST_USER_EMAIL') ?? '';
const password = Deno.env.get('TEST_USER_PASSWORD') ?? '';
const userId = Deno.env.get('TEST_USER_ID') ?? '';

const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError || !data.session) { console.error('sign-in failed'); Deno.exit(1); }

const jwt = data.session.access_token;
const res = await fetch(`${url}/functions/v1/create-xendit-invoice`, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
});
console.log('Status:', res.status);
console.log('Body:', await res.text());
