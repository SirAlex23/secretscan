import { Octokit } from "octokit";

export function createGithubClient(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export interface GithubRepo {
  id: number;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export async function listUserRepos(
  accessToken: string
): Promise<GithubRepo[]> {
  const octokit = createGithubClient(accessToken);

  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100, sort: "updated" }
  );

  return repos.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    private: r.private,
  }));
}