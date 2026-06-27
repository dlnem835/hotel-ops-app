import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // Safari/iOS can hang forever on the default Web Locks auth mutex.
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  }
);