import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}
