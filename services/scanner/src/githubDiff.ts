import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export interface ChangedFile {
  filePath: string;
  addedContent: string;
}

export async function getChangedFilesContent(
  repoFullName: string,
  commitSha: string
): Promise<ChangedFile[]> {
  const [owner, repo] = repoFullName.split("/");

  // Obtenemos el commit y sus archivos modificados
  const { data: commitData } = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: commitSha,
  });

  const changedFiles: ChangedFile[] = [];

  for (const file of commitData.files ?? []) {
    // Ignoramos archivos eliminados (no hay nada que escanear)
    if (file.status === "removed") continue;

    // El "patch" trae solo las líneas del diff con prefijo +/-
    // Extraemos solo las líneas AÑADIDAS (empiezan por "+", pero no "+++")
    if (!file.patch) continue;

    const addedLines = file.patch
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1)) // quitamos el prefijo "+"
      .join("\n");

    if (addedLines.trim().length > 0) {
      changedFiles.push({
        filePath: file.filename,
        addedContent: addedLines,
      });
    }
  }

  return changedFiles;
}