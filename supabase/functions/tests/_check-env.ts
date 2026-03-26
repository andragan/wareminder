console.log('SUPABASE_URL:', Deno.env.get('SUPABASE_URL'));
console.log('PUBLISHABLE_KEY set:', !!Deno.env.get('SUPABASE_PUBLISHABLE_KEY'));
console.log('SECRET_KEY set:', !!Deno.env.get('SUPABASE_SECRET_KEY'));
console.log('TEST_USER_EMAIL set:', !!Deno.env.get('TEST_USER_EMAIL'));
console.log('TEST_USER_ID set:', !!Deno.env.get('TEST_USER_ID'));
