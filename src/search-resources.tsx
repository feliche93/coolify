import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, fetchProjectEnvironments, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import {
  Project,
  buildEnvLookup,
  buildEnvNameMap,
  buildEnvNameToIdsMap,
  buildEnvToProjectMap,
  toId,
} from "./api/filters";
import WithValidToken from "./pages/with-valid-token";

type Application = {
  id?: number | string;
  uuid?: string;
  name?: string;
  fqdn?: string;
  git_repository?: string;
  git_branch?: string;
  environment_id?: number | string;
};

type Service = {
  id?: number | string;
  uuid?: string;
  name?: string;
  description?: string;
  environment_id?: number | string;
  service_type?: string;
};

type Database = {
  id?: number | string;
  uuid?: string;
  name?: string;
  description?: string;
  environment_id?: number | string;
  db_type?: string;
};

type ResourceType = "application" | "service" | "database";

type ResourceItem = {
  id: string;
  type: ResourceType;
  name: string;
  subtitle?: string;
  environmentId?: string;
  repo?: string;
  kind?: string;
  url?: string;
};

function getPrimaryUrl(app: Application): string | undefined {
  if (!app.fqdn) return undefined;
  const raw = app.fqdn.split(",")[0]?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function buildResources(apps: Application[], services: Service[], databases: Database[]): ResourceItem[] {
  const appItems: ResourceItem[] = apps.map((app) => ({
    id: String(app.id ?? app.uuid ?? app.name ?? "app"),
    type: "application",
    name: app.name ?? "Unnamed Application",
    subtitle: [app.git_branch, getPrimaryUrl(app)].filter(Boolean).join(" • "),
    environmentId: String(app.environment_id ?? ""),
    repo: app.git_repository,
    url: getPrimaryUrl(app),
  }));

  const serviceItems: ResourceItem[] = services.map((service) => ({
    id: String(service.id ?? service.uuid ?? service.name ?? "service"),
    type: "service",
    name: service.name ?? "Unnamed Service",
    subtitle: service.description,
    environmentId: String(service.environment_id ?? ""),
    kind: service.service_type,
  }));

  const databaseItems: ResourceItem[] = databases.map((database) => ({
    id: String(database.id ?? database.uuid ?? database.name ?? "db"),
    type: "database",
    name: database.name ?? "Unnamed Database",
    subtitle: database.description,
    environmentId: String(database.environment_id ?? ""),
    kind: database.db_type,
  }));

  return [...appItems, ...serviceItems, ...databaseItems];
}

function applyFilter(
  items: ResourceItem[],
  filterValue: string,
  envToProjectMap: Map<string, string>,
  envNameToIds: Map<string, Set<string>>,
): ResourceItem[] {
  if (filterValue === "all") return items;
  if (filterValue.startsWith("project:")) {
    const projectId = filterValue.replace("project:", "");
    return items.filter((item) => {
      const envId = item.environmentId ?? "";
      return envToProjectMap.get(envId) === projectId;
    });
  }
  if (filterValue.startsWith("env:")) {
    const envName = filterValue.replace("env:", "");
    const envIds = envNameToIds.get(envName);
    if (!envIds) return [];
    return items.filter((item) => envIds.has(item.environmentId ?? ""));
  }
  if (filterValue.startsWith("type:")) {
    const type = filterValue.replace("type:", "") as ResourceType;
    return items.filter((item) => item.type === type);
  }
  return items;
}

function ResourcesList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [filterValue, setFilterValue] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(
    async () => requestJson<Project[]>("/projects", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  const { data: environments, isLoading: isLoadingEnvironments } = useCachedPromise(
    async () => fetchProjectEnvironments(projects ?? [], { baseUrl, token }),
    [projects?.length ?? 0],
    { keepPreviousData: true },
  );

  const envToProjectMap = useMemo(() => buildEnvToProjectMap(environments ?? []), [environments]);
  const envNameMap = useMemo(() => buildEnvNameMap(environments ?? []), [environments]);
  const envLookup = useMemo(() => buildEnvLookup(environments ?? []), [environments]);
  const envNameToIds = useMemo(() => buildEnvNameToIdsMap(environments ?? []), [environments]);

  const { data: applications, isLoading: isLoadingApplications } = useCachedPromise(
    async () => requestJson<Application[]>("/applications", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );
  const { data: services, isLoading: isLoadingServices } = useCachedPromise(
    async () => requestJson<Service[]>("/services", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );
  const { data: databases, isLoading: isLoadingDatabases } = useCachedPromise(
    async () => requestJson<Database[]>("/databases", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  const resources = useMemo(
    () => buildResources(applications ?? [], services ?? [], databases ?? []),
    [applications, databases, services],
  );

  const filteredResources = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    const withFilter = applyFilter(resources, filterValue, envToProjectMap, envNameToIds);
    if (!lower) return withFilter;
    return withFilter.filter((item) => {
      const haystack = [item.name, item.subtitle, item.repo, item.kind, item.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [envNameToIds, envToProjectMap, filterValue, resources, searchText]);

  const groupedResources = useMemo(() => {
    const entries = filteredResources.map((item) => {
      const envId = item.environmentId ?? "";
      const envInfo = envLookup.get(envId);
      const projectName = envInfo?.projectName ?? "Unassigned";
      const envName = envNameMap.get(envId) ?? "Unknown";
      return { item, projectName, envName };
    });

    entries.sort((a, b) => {
      const projectCompare = a.projectName.localeCompare(b.projectName);
      if (projectCompare !== 0) return projectCompare;
      const envCompare = a.envName.localeCompare(b.envName);
      if (envCompare !== 0) return envCompare;
      const typeCompare = typeOrder(a.item.type) - typeOrder(b.item.type);
      if (typeCompare !== 0) return typeCompare;
      return a.item.name.localeCompare(b.item.name);
    });

    const groups = new Map<string, { projectName: string; items: typeof entries }>();
    for (const entry of entries) {
      const key = entry.projectName;
      if (!groups.has(key)) {
        groups.set(key, { projectName: entry.projectName, items: [] });
      }
      groups.get(key)?.items.push(entry);
    }
    return Array.from(groups.values());
  }, [envLookup, envNameMap, filteredResources]);

  return (
    <List
      isLoading={
        isLoadingProjects || isLoadingEnvironments || isLoadingApplications || isLoadingServices || isLoadingDatabases
      }
      navigationTitle="Results"
      searchBarPlaceholder="Search Resources..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" onChange={setFilterValue}>
          <List.Dropdown.Item key="all" title="All Resources" value="all" />
          {projects && projects.length > 0 ? (
            <List.Dropdown.Section title="Projects">
              {projects.map((project) => {
                const projectId = toId(project.id ?? project.uuid);
                if (!projectId) return null;
                return (
                  <List.Dropdown.Item
                    key={`project-${projectId}`}
                    title={project.name ?? "Unnamed Project"}
                    value={`project:${projectId}`}
                  />
                );
              })}
            </List.Dropdown.Section>
          ) : null}
          {envNameToIds.size > 0 ? (
            <List.Dropdown.Section title="Environments">
              {Array.from(envNameToIds.keys()).map((name) => (
                <List.Dropdown.Item key={`env-${name}`} title={name} value={`env:${name}`} />
              ))}
            </List.Dropdown.Section>
          ) : null}
          <List.Dropdown.Section title="Types">
            <List.Dropdown.Item title="Applications" value="type:application" />
            <List.Dropdown.Item title="Services" value="type:service" />
            <List.Dropdown.Item title="Databases" value="type:database" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {groupedResources.map((group) => (
        <List.Section key={group.projectName} title={group.projectName}>
          {group.items.map(({ item, envName }) => {
            const envId = item.environmentId ?? "";
            const envInfo = envLookup.get(envId);
            const projectUuid = clientSafe(envInfo?.projectUuid);
            const envUuid = clientSafe(envInfo?.uuid);
            const environmentUrl =
              projectUuid && envUuid ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}` : instanceUrl;

            const accessories = [
              item.type
                ? {
                    tag: {
                      value: capitalize(item.type),
                      color: typeColor(item.type),
                    },
                  }
                : null,
              envName
                ? {
                    tag: {
                      value: envName,
                      color: envColor(envName),
                    },
                  }
                : null,
              item.kind ? { text: item.kind } : null,
            ].filter(Boolean) as { text?: string; tag?: { value: string; color: string } }[];

            return (
              <List.Item
                key={`${item.type}-${item.id}`}
                title={item.name}
                subtitle={item.subtitle}
                icon={typeIcon(item.type)}
                accessories={accessories}
                actions={
                  <ActionPanel>
                    {item.url ? <Action.OpenInBrowser title="Open Application" url={item.url} /> : null}
                    <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} />
                    <Action.CopyToClipboard title="Copy Name" content={item.name} />
                    {item.repo ? <Action.CopyToClipboard title="Copy Repository URL" content={item.repo} /> : null}
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}
      {!filteredResources?.length && <List.EmptyView icon={Icon.MagnifyingGlass} title="No resources found" />}
    </List>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clientSafe(value?: string) {
  return value ?? "";
}

function typeIcon(type: ResourceType) {
  switch (type) {
    case "application":
      return Icon.AppWindow;
    case "service":
      return Icon.Terminal;
    case "database":
      return Icon.HardDrive;
    default:
      return Icon.Dot;
  }
}

function envColor(name: string) {
  const value = name.toLowerCase();
  if (value.includes("prod")) return "green";
  if (value.includes("preview")) return "yellow";
  if (value.includes("stag")) return "orange";
  if (value.includes("dev")) return "blue";
  return "gray";
}

function typeOrder(type: ResourceType) {
  switch (type) {
    case "application":
      return 1;
    case "service":
      return 2;
    case "database":
      return 3;
    default:
      return 99;
  }
}

function typeColor(type: ResourceType) {
  switch (type) {
    case "application":
      return "blue";
    case "service":
      return "orange";
    case "database":
      return "green";
    default:
      return "gray";
  }
}

export default function Command() {
  return (
    <WithValidToken>
      <ResourcesList />
    </WithValidToken>
  );
}
