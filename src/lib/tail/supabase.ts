import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the TAIL Sports data model (schema `tail`, project
 * 250dogs). The publishable key is safe to ship to the browser — row access is
 * governed by RLS: reference/run tables are public-read, and run tables are
 * insert-only so published predictions stay immutable (PRD SEC-002).
 */
const SUPABASE_URL = "https://vrosdznqpvypjbcwocje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dw0U9uGi2szNlQQdIMr4cA_S6TsYt5Z";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "tail" },
  auth: { persistSession: false },
});
