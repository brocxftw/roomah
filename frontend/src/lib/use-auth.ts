"use client";

import { useCallback, useMemo } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useAuth() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const getToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return data.session?.access_token ?? null;
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, [supabase]);

  return { getToken, signOut, supabase };
}
