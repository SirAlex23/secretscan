import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listUserRepos } from "@/lib/github";
import { decryptToken } from "@/lib/crypto";
import { connectRepo } from "../actions";
import Link from "next/link";

export default async function ConnectPage() {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return <p className="p-10 text-sm">No autenticado.</p>;
  }

  const supabase = createServerSupabaseClient();

  const { data: tokenRow } = await supabase
    .from("user_provider_tokens")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  const { data: connected } = await supabase
    .from("connected_repos")
    .select("full_name")
    .eq("user_id", user.id);

  const connectedNames = new Set((connected ?? []).map((r) => r.full_name));

  const repos = tokenRow
    ? await listUserRepos(decryptToken(tokenRow.access_token))
    : [];

  return (
    <div className="min-h-screen px-10 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="font-mono text-xs uppercase text-muted-foreground">
            Configuración
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold">
            Conectar repositorios
          </h1>
        </div>
        <Link href="/" className="text-sm underline">
          Volver al índice
        </Link>
      </div>

      <div className="max-w-2xl space-y-2">
        {!tokenRow && (
          <p className="text-sm text-muted-foreground">
            No se encontró tu token de GitHub. Cierra sesión y vuelve a
            conectarte con GitHub.
          </p>
        )}
        {tokenRow && repos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No se encontraron repositorios en tu cuenta de GitHub.
          </p>
        )}

        {repos.map((repo) => {
          const isConnected = connectedNames.has(repo.fullName);
          return (
            <div
              key={repo.id}
              className="flex items-center justify-between border border-border px-4 py-3"
            >
              <div>
                <p className="font-mono text-sm">{repo.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {repo.private ? "Privado" : "Público"} · rama{" "}
                  {repo.defaultBranch}
                </p>
              </div>

              {isConnected ? (
                <span className="text-xs text-muted-foreground">
                  Conectado
                </span>
              ) : (
                <form action={connectRepo}>
                  <input
                    type="hidden"
                    name="repoFullName"
                    value={repo.fullName}
                  />
                  <input
                    type="hidden"
                    name="defaultBranch"
                    value={repo.defaultBranch}
                  />
                  <button className="border border-border px-3 py-1 text-xs">
                    Conectar
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}