export type Preferences = {
  apiUrl?: string;
  apiToken?: string;
};

export const DEFAULT_BASE_URL = "https://app.coolify.io/api/v1";

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

export function getInstanceUrl(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v1$/, "");
}

export async function requestJson<T>(
  path: string,
  {
    baseUrl,
    token,
    method,
    body,
    signal,
  }: {
    baseUrl: string;
    token: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  },
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Coolify API error: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchProjectEnvironments(
  projects: { id?: number | string; uuid?: string; name?: string }[],
  {
    baseUrl,
    token,
    signal,
  }: {
    baseUrl: string;
    token: string;
    signal?: AbortSignal;
  },
): Promise<
  {
    id?: number | string;
    uuid?: string;
    name?: string;
    projectId?: string;
    projectName?: string;
    projectUuid?: string;
  }[]
> {
  const requests = projects
    .map((project) => {
      const projectUuid = project.uuid ?? "";
      if (!projectUuid) return null;
      return requestJson<{ id?: number | string; uuid?: string; name?: string }[]>(
        `/projects/${projectUuid}/environments`,
        { baseUrl, token, signal },
      ).then((envs) =>
        envs.map((env) => ({
          ...env,
          projectId: project.id ? String(project.id) : project.uuid,
          projectName: project.name ?? "Unnamed Project",
          projectUuid: project.uuid ?? undefined,
        })),
      );
    })
    .filter(Boolean) as Promise<
    {
      id?: number | string;
      uuid?: string;
      name?: string;
      projectId?: string;
      projectName?: string;
    }[]
  >[];

  if (requests.length === 0) return [];

  const results = await Promise.all(requests);
  return results.flat();
}
