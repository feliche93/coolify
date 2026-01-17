export type Environment = {
  id?: number | string;
  uuid?: string;
  name?: string;
  project_id?: number | string;
  project_uuid?: string;
};

export type Project = {
  id?: number | string;
  uuid?: string;
  name?: string;
  environments?: Environment[];
};

export type ProjectEnvironment = Environment & {
  projectId?: string;
  projectName?: string;
  projectUuid?: string;
};

export function toId(value?: number | string): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function flattenEnvironments(projects: Project[]): ProjectEnvironment[] {
  const items: ProjectEnvironment[] = [];

  for (const project of projects) {
    const projectId = toId(project.id ?? project.uuid);
    const projectUuid = project.uuid ? String(project.uuid) : undefined;
    const projectName = project.name ?? "Unnamed Project";
    for (const environment of project.environments ?? []) {
      items.push({
        ...environment,
        projectId: projectId ?? toId(environment.project_id ?? environment.project_uuid) ?? undefined,
        projectName,
        projectUuid,
      });
    }
  }

  return items;
}

export function buildEnvToProjectMap(envs: ProjectEnvironment[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const env of envs) {
    const envId = toId(env.id ?? env.uuid);
    const projectId = toId(env.projectId ?? env.project_uuid ?? env.project_id);
    if (envId && projectId) {
      map.set(envId, projectId);
    }
  }
  return map;
}

export function buildEnvNameMap(envs: ProjectEnvironment[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const env of envs) {
    const envId = toId(env.id ?? env.uuid);
    if (envId) {
      map.set(envId, env.name ?? "Unnamed Environment");
    }
  }
  return map;
}

export function buildEnvLookup(envs: ProjectEnvironment[]): Map<string, ProjectEnvironment> {
  const map = new Map<string, ProjectEnvironment>();
  for (const env of envs) {
    const envId = toId(env.id ?? env.uuid);
    if (envId) {
      map.set(envId, env);
    }
  }
  return map;
}

export function buildEnvNameToIdsMap(envs: ProjectEnvironment[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const env of envs) {
    const envId = toId(env.id ?? env.uuid);
    if (!envId) continue;
    const name = env.name ?? "Unnamed Environment";
    const set = map.get(name) ?? new Set<string>();
    set.add(envId);
    map.set(name, set);
  }
  return map;
}
