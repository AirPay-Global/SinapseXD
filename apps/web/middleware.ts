import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Refreshes the session cookie on every request so Server Components always
  // see a valid session. supabase is null when Supabase isn't configured —
  // skip the refresh and let the app render on demo data instead of 500ing.
  if (supabase) {
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
