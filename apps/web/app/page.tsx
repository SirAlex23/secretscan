import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { TrendChart } from "@/components/trend-chart";
import { LoginButton } from "@/components/login-button";
import { updateFindingStatus, logout, triggerManualScan, } from "./actions";
import Link from "next/link";

const severityLabel: Record<string, string> = {
  critical: "CRÍTICO",
  high: "ALTO",
  medium: "MEDIO",
  low: "BAJO",
};

const severityColor: Record<string, string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-resolved",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-semibold">SecretScan</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Conecta tu cuenta de GitHub para monitorizar tus repositorios en
          busca de secretos filtrados.
        </p>
        <LoginButton />
      </div>
    );
  }

  const { repo: repoIdParam } = await searchParams;
  const supabase = createServerSupabaseClient();

  const { data: repos } = await supabase
    .from("connected_repos")
    .select("id, full_name, provider")
    .order("created_at", { ascending: true });

  const repoCounts = await Promise.all(
    (repos ?? []).map(async (repo) => {
      const { count } = await supabase
        .from("findings")
        .select("id", { count: "exact", head: true })
        .eq("repo_id", repo.id)
        .eq("status", "open");
      return { repoId: repo.id, count: count ?? 0 };
    })
  );

  const selectedRepoId = repoIdParam ?? repos?.[0]?.id;
  const selectedRepo = repos?.find((r) => r.id === selectedRepoId);

  const { data: findings } = selectedRepoId
    ? await supabase
        .from("findings")
        .select(
          "id, secret_type, file_path, line_number, snippet_obfuscated, severity, status, confidence_score, created_at"
        )
        .eq("repo_id", selectedRepoId)
        .order("created_at", { ascending: false })
    : { data: [] };

  const trendMap = new Map<string, number>();
  for (const f of findings ?? []) {
    const day = new Date(f.created_at).toISOString().slice(0, 10);
    trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
  }
  const trendData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), count }));

  return (
    <div className="flex min-h-screen">
      <aside className="w-72 shrink-0 border-r border-border px-5 py-6">
        <h1 className="font-serif text-xl font-semibold tracking-tight">
          SecretScan
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Índice de casos</p>

        <nav className="mt-8 space-y-1">
          {(repos ?? []).map((repo) => {
            const openCount =
              repoCounts.find((c) => c.repoId === repo.id)?.count ?? 0;
            const active = repo.id === selectedRepoId;
            return (
              <Link
                key={repo.id}
                href={`/?repo=${repo.id}`}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted ${
                  active ? "bg-muted" : ""
                }`}
              >
                <span>{repo.full_name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  ·{openCount}
                </span>
              </Link>
            );
          })}
          {(!repos || repos.length === 0) && (
            <p className="px-3 text-xs text-muted-foreground">
              Sin repositorios conectados todavía.
            </p>
          )}
        </nav>

        <div className="mt-10 border-t border-border pt-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">
            {user.email}
          </p>
          <Link
  href="/connect"
  className="mt-4 block px-3 text-xs underline text-muted-foreground"
>
  Conectar repositorios
</Link>
          <form action={logout}>
            <button className="text-xs text-muted-foreground underline">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-10 py-8">
        <div className="mb-6 border-b border-border pb-4">
        {selectedRepoId && selectedRepo && (
  <form action={triggerManualScan} className="mb-6">
    <input type="hidden" name="repoId" value={selectedRepoId} />
    <input
      type="hidden"
      name="repoFullName"
      value={selectedRepo.full_name}
    />
    <button className="border border-border px-3 py-1.5 text-xs">
      Escanear ahora
    </button>
  </form>
)}
          <p className="font-mono text-xs uppercase text-muted-foreground">
            Repositorio
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">
            {selectedRepo?.full_name ?? "Sin selección"}
          </h2>
        </div>

        {trendData.length > 0 && (
          <div className="mb-8">
            <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">
              Tendencia de hallazgos
            </p>
            <TrendChart data={trendData} />
          </div>
        )}

        <div className="space-y-4">
          {(findings ?? []).map((finding) => (
            <div key={finding.id} className="border border-border p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {finding.file_path}:{finding.line_number}
                  </p>
                  <p className="font-mono text-sm">{finding.secret_type}</p>
                </div>
                <span
                  className={`stamp text-xs ${severityColor[finding.severity]}`}
                >
                  {severityLabel[finding.severity]}
                </span>
              </div>

              <div className="mb-3 flex items-center gap-4 text-sm">
                <span className="redaction-bar font-mono px-2 py-0.5">
                  {finding.snippet_obfuscated}
                </span>
                {finding.confidence_score !== null && (
                  <span className="text-muted-foreground">
                    Confianza: {Math.round(finding.confidence_score * 100)}%
                  </span>
                )}
              </div>

              <form action={updateFindingStatus} className="flex gap-2">
                <input type="hidden" name="findingId" value={finding.id} />
                {(
                  [
                    ["open", "Abierto"],
                    ["revoked", "Revocado"],
                    ["false_positive", "Falso positivo"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="submit"
                    name="status"
                    value={value}
                    className={`rounded border border-border px-3 py-1 text-xs ${
                      finding.status === value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </form>
            </div>
          ))}

          {selectedRepoId && (findings ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay hallazgos registrados para este repositorio.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}