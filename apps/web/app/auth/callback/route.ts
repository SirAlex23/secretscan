import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerAuthClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data.session?.provider_token && data.user) {
      const adminClient = createServerSupabaseClient();
      await adminClient.from("user_provider_tokens").upsert({
        user_id: data.user.id,
        provider: "github",
        access_token: encryptToken(data.session.provider_token),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return NextResponse.redirect(`${origin}/`);
}