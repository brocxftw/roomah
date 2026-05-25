"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm() {
  const supabase = createSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function verifyActiveSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    if (!token) {
      throw new Error("No active session was returned after sign-in.");
    }

    await apiFetch("/auth/sync-user", token, { method: "POST" });
    const { data } = await supabase.auth.refreshSession();
    await apiFetch("/users/me", data.session?.access_token ?? token);
  }

  async function handlePasswordAuth(mode: "sign-in" | "sign-up") {
    setIsSubmitting(true);
    setMessage(null);

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setIsSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    try {
      await verifyActiveSession();
    } catch (sessionError) {
      await supabase.auth.signOut();
      const message =
        sessionError instanceof Error ? sessionError.message : String(sessionError);
      if (message.toLowerCase().includes("deactivated")) {
        window.location.href = "/?reason=deactivated";
        return;
      }
      setIsSubmitting(false);
      setMessage(message);
      return;
    }

    window.location.href = "/app";
  }

  async function handleGoogleAuth() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <input
        className="rounded-full border px-4 py-3 text-sm"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        className="rounded-full border px-4 py-3 text-sm"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-full bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => {
            void handlePasswordAuth("sign-in");
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          className="rounded-full border px-6 py-3 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => {
            void handlePasswordAuth("sign-up");
          }}
        >
          Create account
        </button>
      </div>
      <button
        type="button"
        className="rounded-full border px-6 py-3 text-sm font-medium transition hover:bg-zinc-50"
        onClick={() => {
          void handleGoogleAuth();
        }}
      >
        Continue with Google
      </button>
      {searchParams.get("reason") === "deactivated" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          This account has been deactivated. Contact your manager for access.
        </p>
      ) : null}
      {message ? <p className="text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
