"use client";

import { createClient } from "@supabase/supabase-js";

const realtimeUrl =
  process.env.NEXT_PUBLIC_SUPABASE_DATA_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const realtimeAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_DATA_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabasePlanningRealtime =
  realtimeUrl && realtimeAnonKey
    ? createClient(realtimeUrl, realtimeAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;
