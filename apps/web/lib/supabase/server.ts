import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Elevated server key (Supabase's current name is SUPABASE_SECRET_KEY;
// SUPABASE_SERVICE_ROLE_KEY is the legacy name) — same resolution the
// pipeline uses. Server-only; never exposed to the browser.
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

type CookieToSet = { name: string; value: string; options: CookieOptionsWithName };

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore when
          // middleware is refreshing the session.
        }
      },
    },
  });
};

/**
 * Server-only service-role client for reading the SHARED intelligence layer —
 * the ontology, Silver aggregates and Gold marts. These carry no per-tenant
 * data, but their RLS is `authenticated`-only (written for the eventual Clerk
 * multi-tenant model). Until real auth exists, the web tier is anonymous, so
 * an anon read matches no policy and returns zero rows — which silently
 * degrades every dashboard to demo. Reading shared data with the service key
 * (which bypasses RLS) is the correct interim path: the key stays server-side,
 * and the strict policies remain intact for when authenticated reads arrive.
 *
 * NEVER use this for tenant-scoped tables (organisations, users, aprm_reports,
 * decision_records) — those must stay on the cookie/anon client above so RLS
 * enforces isolation. Returns null when the service key isn't configured, so
 * callers degrade to demo rather than throwing.
 */
export const createServiceClient = () => {
  if (!supabaseUrl || !serviceKey) return null;
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
