"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginButton() {
  const supabase = createBrowserSupabaseClient();

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "repo",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      onClick={handleLogin}
      className="border border-border bg-foreground px-4 py-2 text-sm text-background"
    >
      Conectar con GitHub
    </button>
  );
}