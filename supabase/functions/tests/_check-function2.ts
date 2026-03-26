import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const key = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const email = Deno.env.get('TEST_USER_EMAIL') ?? '';
const password = Deno.env.get('TEST_USER_PASSWORD') ?? '';

const fnUrl = `${url}/functions/v1/create-xendit-invoice`;

// Try 1: secret key as Bearer (bypasses user JWT verification)
console.log('--- Test 1: secret key as Bearer ---');
const r1 = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'apikey': secretKey, 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
});
console.log('Status:', r1.status, await r1.text());

// Try 2: publishable key as Bearer (anon call)
console.log('--- Test 2: publishable key as Bearer ---');
const r2 = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
});
console.log('Status:', r2.status, await r2.text());

// Try 3: user JWT — decode header/payload to check format
console.log('--- Test 3: user JWT ---');
const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError || !data.session) {
    console.error('Sign-in failed:', signInError?.message);
} else {
    const jwt = data.session.access_token;
    const [hdr, payload] = jwt.split('.');
    console.log('JWT header:', JSON.parse(atob(hdr)));
    const p = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    console.log('JWT claims:', { iss: p.iss, aud: p.aud, role: p.role, sub: p.sub });
    const r3 = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    console.log('Status:', r3.status, await r3.text());
}
