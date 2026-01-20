import { Action, ActionPanel, Color, Icon, List, Toast, getPreferenceValues, showToast } from "@raycast/api";
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
import EnvironmentVariablesList from "./components/environment-variables";
import { buildConsoleLogsUrl, LogsSubmenu } from "./components/logs-actions";
import { ResourceDetails } from "./components/resource-details";
import { RedeploySubmenu } from "./components/redeploy-actions";
import DeleteResourceForm from "./components/delete-resource";
import { Application, Database, ResourceItem, ResourceType, Service, buildResources } from "./lib/resources";
import WithValidToken from "./pages/with-valid-token";

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
    async (projectList: Project[]) => fetchProjectEnvironments(projectList, { baseUrl, token }),
    [projects ?? []],
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
            const resourceUrl = resolveResourceUrl({
              instanceUrl,
              projectUuid,
              environmentUuid: envUuid,
              resourceUuid: item.uuid,
              type: item.type,
            });
            const consoleLogsUrl =
              item.type === "application"
                ? buildConsoleLogsUrl({
                    instanceUrl,
                    projectUuid,
                    environmentUuid: envUuid,
                    applicationUuid: item.uuid,
                  })
                : undefined;
            const canViewEnvVars = item.type === "application" || item.type === "service";

            const accessories = [
              envName
                ? {
                    tag: {
                      value: envName,
                      color: envColor(envName),
                    },
                  }
                : null,
              item.type
                ? {
                    tag: {
                      value: capitalize(item.type),
                      color: typeColor(item.type),
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
                detail={
                  <ResourceDetails
                    info={{
                      title: item.name,
                      type: capitalize(item.type),
                      projectName: envInfo?.projectName,
                      environmentName: envName,
                      kind: item.kind,
                      uuid: item.uuid,
                      url: item.url,
                      coolifyUrl: resourceUrl,
                      environmentUrl,
                      repoUrl: item.repo,
                    }}
                  />
                }
                actions={
                  <ActionPanel>
                    {resourceUrl ? (
                      <Action.OpenInBrowser title="Open in Coolify" url={resourceUrl} icon={Icon.Globe} />
                    ) : null}
                    {item.url ? (
                      <Action.OpenInBrowser title="Open Application" url={item.url} icon={Icon.Link} />
                    ) : null}
                    <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} icon={Icon.Globe} />
                    <ActionPanel.Section>
                      {canViewEnvVars && item.uuid ? (
                        <Action.Push
                          title="View Environment Variables"
                          icon={Icon.Terminal}
                          target={
                            <EnvironmentVariablesList
                              baseUrl={baseUrl}
                              token={token}
                              resource={{
                                type: item.type === "service" ? "service" : "application",
                                uuid: String(item.uuid),
                                name: item.name,
                              }}
                            />
                          }
                        />
                      ) : null}
                      {item.type === "application" && item.uuid ? (
                        <LogsSubmenu
                          baseUrl={baseUrl}
                          token={token}
                          applicationUuid={String(item.uuid)}
                          consoleLogsUrl={consoleLogsUrl}
                        />
                      ) : null}
                      {item.uuid ? <RedeploySubmenu baseUrl={baseUrl} token={token} uuid={String(item.uuid)} /> : null}
                    </ActionPanel.Section>
                    {item.uuid ? (
                      <ActionPanel.Section title="Lifecycle">
                        <Action
                          icon={{ source: Icon.Play, tintColor: Color.Green }}
                          title="Start"
                          onAction={async () => {
                            try {
                              await requestJson(`/${resourceTypeEndpoint(item.type)}s/${item.uuid}/start`, {
                                baseUrl,
                                token,
                              });
                              await showToast({ style: Toast.Style.Success, title: "Start triggered" });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: "Failed to start",
                                message: error instanceof Error ? error.message : String(error),
                              });
                            }
                          }}
                        />
                        <Action
                          icon={{ source: Icon.Stop, tintColor: Color.Red }}
                          title="Stop"
                          onAction={async () => {
                            try {
                              await requestJson(`/${resourceTypeEndpoint(item.type)}s/${item.uuid}/stop`, {
                                baseUrl,
                                token,
                              });
                              await showToast({ style: Toast.Style.Success, title: "Stop triggered" });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: "Failed to stop",
                                message: error instanceof Error ? error.message : String(error),
                              });
                            }
                          }}
                        />
                        <Action
                          icon={{ source: Icon.Redo, tintColor: Color.Orange }}
                          title="Restart"
                          onAction={async () => {
                            try {
                              await requestJson(`/${resourceTypeEndpoint(item.type)}s/${item.uuid}/restart`, {
                                baseUrl,
                                token,
                              });
                              await showToast({ style: Toast.Style.Success, title: "Restart triggered" });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: "Failed to restart",
                                message: error instanceof Error ? error.message : String(error),
                              });
                            }
                          }}
                        />
                        <Action.Push
                          icon={{ source: Icon.Trash, tintColor: Color.Red }}
                          title="Delete"
                          target={
                            <DeleteResourceForm
                              baseUrl={baseUrl}
                              token={token}
                              resourceType={resourceTypeEndpoint(item.type)}
                              uuid={String(item.uuid)}
                            />
                          }
                        />
                      </ActionPanel.Section>
                    ) : null}
                    <ActionPanel.Section>
                      <Action.CopyToClipboard title="Copy Name" content={item.name} />
                      {item.url ? <Action.CopyToClipboard title="Copy URL" content={item.url} /> : null}
                      {resourceUrl ? <Action.CopyToClipboard title="Copy Coolify URL" content={resourceUrl} /> : null}
                      <Action.CopyToClipboard title="Copy Environment URL" content={environmentUrl} />
                      {item.uuid ? <Action.CopyToClipboard title="Copy UUID" content={item.uuid} /> : null}
                      {item.repo ? <Action.CopyToClipboard title="Copy Repository URL" content={item.repo} /> : null}
                    </ActionPanel.Section>
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      ))}
      {!filteredResources?.length && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No resources found"
          description="Check API token and permissions."
        />
      )}
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

function resolveResourceUrl({
  instanceUrl,
  projectUuid,
  environmentUuid,
  resourceUuid,
  type,
}: {
  instanceUrl: string;
  projectUuid?: string;
  environmentUuid?: string;
  resourceUuid?: string;
  type: ResourceType;
}) {
  if (!projectUuid || !environmentUuid || !resourceUuid) return undefined;
  const base = instanceUrl.replace(/\/+$/, "");
  return `${base}/project/${projectUuid}/environment/${environmentUuid}/${type}/${resourceUuid}`;
}

// buildConsoleLogsUrl, LogsSubmenu, and redeploy actions are shared in components

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

function resourceTypeEndpoint(type: ResourceType) {
  switch (type) {
    case "application":
      return "application";
    case "service":
      return "service";
    case "database":
      return "database";
    default:
      return "application";
  }
}

export default function Command() {
  return (
    <WithValidToken>
      <ResourcesList />
    </WithValidToken>
  );
}
