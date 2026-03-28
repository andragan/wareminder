---
applyTo: "**"
---
# Supabase Project Context

- Project ID: `aykadvxcqhmertfxgpet`
- Deploy edge functions: `supabase functions deploy <function-name> --project-ref aykadvxcqhmertfxgpet`
- Must pass `--project-ref` explicitly — CLI does not auto-select the project
- Uses **newer Supabase key format**: `sb_publishable_...` and `sb_secret_...` — NOT the traditional `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` JWT-style keys
- When advising on local edge function env vars, reference `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`, not the old names
