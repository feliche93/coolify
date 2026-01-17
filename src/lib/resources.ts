export type Application = {
  id?: number | string;
  uuid?: string;
  name?: string;
  fqdn?: string;
  git_repository?: string;
  git_branch?: string;
  environment_id?: number | string;
  environment_uuid?: string;
  status?: string;
  deployment_status?: string;
  last_deployment_status?: string;
};

export type Service = {
  id?: number | string;
  uuid?: string;
  name?: string;
  description?: string;
  environment_id?: number | string;
  environment_uuid?: string;
  service_type?: string;
};

export type Database = {
  id?: number | string;
  uuid?: string;
  name?: string;
  description?: string;
  environment_id?: number | string;
  environment_uuid?: string;
  db_type?: string;
};

export type ResourceType = "application" | "service" | "database";

export type ResourceItem = {
  id: string;
  uuid?: string;
  type: ResourceType;
  name: string;
  subtitle?: string;
  environmentId?: string;
  repo?: string;
  kind?: string;
  url?: string;
  status?: string;
};

export function getPrimaryUrl(app: Application): string | undefined {
  if (!app.fqdn) return undefined;
  const raw = app.fqdn.split(",")[0]?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

export function buildResources(apps: Application[], services: Service[], databases: Database[]): ResourceItem[] {
  const appItems: ResourceItem[] = apps.map((app) => ({
    id: String(app.id ?? app.uuid ?? app.name ?? "app"),
    uuid: app.uuid ? String(app.uuid) : undefined,
    type: "application",
    name: app.name ?? "Unnamed Application",
    subtitle: [app.git_branch, getPrimaryUrl(app)].filter(Boolean).join(" • "),
    environmentId: String(app.environment_id ?? app.environment_uuid ?? ""),
    repo: app.git_repository,
    url: getPrimaryUrl(app),
    status: app.status ?? app.deployment_status ?? app.last_deployment_status,
  }));

  const serviceItems: ResourceItem[] = services.map((service) => ({
    id: String(service.id ?? service.uuid ?? service.name ?? "service"),
    uuid: service.uuid ? String(service.uuid) : undefined,
    type: "service",
    name: service.name ?? "Unnamed Service",
    subtitle: service.description,
    environmentId: String(service.environment_id ?? service.environment_uuid ?? ""),
    kind: service.service_type,
  }));

  const databaseItems: ResourceItem[] = databases.map((database) => ({
    id: String(database.id ?? database.uuid ?? database.name ?? "db"),
    uuid: database.uuid ? String(database.uuid) : undefined,
    type: "database",
    name: database.name ?? "Unnamed Database",
    subtitle: database.description,
    environmentId: String(database.environment_id ?? database.environment_uuid ?? ""),
    kind: database.db_type,
  }));

  return [...appItems, ...serviceItems, ...databaseItems];
}
