import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const userId = Deno.env.get('TEST_USER_ID') ?? '';

const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const { data, error } = await admin.from('user_profiles').select('*').eq('id', userId);
console.log('user_profiles row:', data);
console.log('error:', error);
