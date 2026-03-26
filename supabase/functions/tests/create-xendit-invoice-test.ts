/**
 * Integration tests for create-xendit-invoice Edge Function
 *
 * Tests run against the deployed function at:
 *   https://aykadvxcqhmertfxgpet.supabase.co/functions/v1/create-xendit-invoice
 *
 * Configuration: supabase/functions/tests/.env.test
 * Run: npm run test:functions
 *
 * Test groups:
 *   1. Auth-free — no credentials needed (CORS, bad method, missing auth)
 *   2. Authenticated — need TEST_USER_EMAIL + TEST_USER_PASSWORD  
 *   3. Happy path — also needs TEST_USER_ID + SUPABASE_SERVICE_ROLE_KEY
 */

import { assertEquals, assertExists } from 'jsr:@std/assert@1';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SECRET_KEY = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const TEST_USER_EMAIL = Deno.env.get('TEST_USER_EMAIL') ?? '';
const TEST_USER_PASSWORD = Deno.env.get('TEST_USER_PASSWORD') ?? '';
const TEST_USER_ID = Deno.env.get('TEST_USER_ID') ?? '';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-xendit-invoice`;

/** Auth options suitable for test environments */
const CLIENT_OPTIONS = {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Admin client that bypasses RLS — only used for test cleanup */
function makeAdminClient(): SupabaseClient {
    return createClient(SUPABASE_URL, SECRET_KEY, CLIENT_OPTIONS);
}

/** Signs in as the test user and returns a valid JWT access token */
async function getTestUserJwt(): Promise<string> {
    const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, CLIENT_OPTIONS);
    const { data, error } = await client.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
    });
    if (error || !data.session) {
        throw new Error(`Test user sign-in failed: ${error?.message ?? 'no session returned'}`);
    }
    return data.session.access_token;
}

/**
 * Build headers for calling a Supabase Edge Function.
 * Supabase gateway requires both apikey and Authorization headers.
 */
function makeHeaders(jwt?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'apikey': PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
    };
    if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
    }
    return headers;
}

/** Remove rows created by the function during a test run */
async function cleanupInvoice(invoiceId: string): Promise<void> {
    const admin = makeAdminClient();
    await admin.from('subscriptions').delete().eq('xendit_invoice_id', invoiceId);
    await admin.from('subscription_events').delete().eq('event_data->>invoice_id', invoiceId);
}

// ─── Group 1: Auth-free tests ─────────────────────────────────────────────────

Deno.test('OPTIONS returns 204 with CORS headers', async () => {
    const res = await fetch(FUNCTION_URL, { method: 'OPTIONS' });
    assertEquals(res.status, 204);
    assertExists(res.headers.get('access-control-allow-origin'));
    await res.body?.cancel();
});

Deno.test('POST without Authorization header returns 401', async () => {
    // Omit Authorization header but include apikey — gateway should still reject
    const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'any' }),
    });
    assertEquals(res.status, 401);
    await res.body?.cancel();
});

// ─── Group 2: Authenticated tests ────────────────────────────────────────────

Deno.test('POST without user_id returns 400', async () => {
    const jwt = await getTestUserJwt();
    const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: makeHeaders(jwt),
        body: JSON.stringify({}),
    });
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, 'Missing user_id in request body');
});

Deno.test('POST with nonexistent user_id returns 404', async () => {
    const jwt = await getTestUserJwt();
    const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: makeHeaders(jwt),
        // All-zeros UUID is guaranteed not to exist
        body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000000' }),
    });
    assertEquals(res.status, 404);
    const body = await res.json();
    assertEquals(body.error, 'User profile not found');
});

// ─── Group 3: Happy path ──────────────────────────────────────────────────────

Deno.test('POST with valid user returns 200 with invoiceUrl and invoiceId', async () => {
    if (!TEST_USER_ID) {
        console.warn('Skipping: TEST_USER_ID not set in .env.test');
        return;
    }
    if (!SECRET_KEY) {
        console.warn('Skipping: SUPABASE_SECRET_KEY not set (needed for cleanup)');
        return;
    }

    const jwt = await getTestUserJwt();
    let invoiceId: string | undefined;

    try {
        const res = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: makeHeaders(jwt),
            body: JSON.stringify({ user_id: TEST_USER_ID }),
        });

        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.invoiceUrl, 'invoiceUrl should be present');
        assertExists(body.invoiceId, 'invoiceId should be present');
        assertExists(body.externalId, 'externalId should be present');
        assertEquals(body.trialDays, 14);

        invoiceId = body.invoiceId;
    } finally {
        if (invoiceId) {
            await cleanupInvoice(invoiceId);
        }
    }
});
