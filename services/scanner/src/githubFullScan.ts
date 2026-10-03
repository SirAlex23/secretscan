import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export interface RepoFile {
  filePath: string;
  content: string;
}

const IGNORED_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.next\//,
  /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|pdf|zip|lock)$/i,
];

const MAX_FILE_SIZE_BYTES = 300_000; // evitamos archivos enormes (bundles, etc.)

function shouldSkip(path: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(path));
}

export async function getAllFilesContent(
  repoFullName: string,
  commitSha: string
): Promise<RepoFile[]> {
  const [owner, repo] = repoFullName.split("/");

  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commitSha,
    recursive: "true",
  });

  const files: RepoFile[] = [];

  for (const entry of tree.tree) {
    if (
      entry.type !== "blob" ||
      !entry.path ||
      !entry.sha ||
      shouldSkip(entry.path) ||
      (entry.size ?? 0) > MAX_FILE_SIZE_BYTES
    ) {
      continue;
    }

    try {
      const { data: blob } = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: entry.sha,
      });

      // Los blobs binarios no vienen en base64 "limpio" de texto; si falla el decode, se ignora
      const content = Buffer.from(blob.content, "base64").toString("utf-8");
      if (content.includes("\u0000")) continue; 

      files.push({ filePath: entry.path, content });
    } catch {
      continue; // blob inaccesible o demasiado grande, se salta sin romper el escaneo
    }
  }

  return files;
}