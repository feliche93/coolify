import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, fetchProjectEnvironments, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import { Project, buildEnvLookup, buildEnvNameToIdsMap, buildEnvToProjectMap, toId } from "./api/filters";
import { RedeploySubmenu } from "./components/redeploy-actions";
import { ResourceDetails } from "./components/resource-details";
import WithValidToken from "./pages/with-valid-token";

type Database = {
  id?: number | string;
  uuid?: string;
  name?: string;
  description?: string;
  environment_id?: number | string;
  environment_uuid?: string;
  db_type?: string;
};

function resolveResourceUrl({
  instanceUrl,
  projectUuid,
  environmentUuid,
  resourceUuid,
}: {
  instanceUrl: string;
  projectUuid?: string;
  environmentUuid?: string;
  resourceUuid?: string;
}) {
  if (!projectUuid || !environmentUuid || !resourceUuid) return undefined;
  const base = instanceUrl.replace(/\/+$/, "");
  return `${base}/project/${projectUuid}/environment/${environmentUuid}/database/${resourceUuid}`;
}

// redeploy actions are shared in components

function envColor(name: string) {
  const value = name.toLowerCase();
  if (value.includes("prod")) return Color.Green;
  if (value.includes("preview")) return Color.Yellow;
  if (value.includes("stag")) return Color.Orange;
  if (value.includes("dev")) return Color.Blue;
  return Color.SecondaryText;
}

function applyFilter(
  items: Database[],
  filterValue: string,
  envToProjectMap: Map<string, string>,
  envNameToIds: Map<string, Set<string>>,
): Database[] {
  if (filterValue === "all") return items;
  if (filterValue.startsWith("env:")) {
    const envName = filterValue.replace("env:", "");
    const envIds = envNameToIds.get(envName);
    if (!envIds) return [];
    return items.filter((item) => envIds.has(String(item.environment_id ?? "")));
  }
  if (filterValue.startsWith("project:")) {
    const projectId = filterValue.replace("project:", "");
    return items.filter((item) => {
      const envId = String(item.environment_id ?? "");
      return envToProjectMap.get(envId) === projectId;
    });
  }
  return items;
}

function DatabasesList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [filterValue, setFilterValue] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: projects, isLoading: isLoadingProjects } = useCachedPromise(
    async () => {
      return requestJson<Project[]>("/projects", { baseUrl, token });
    },
    [],
    { keepPreviousData: true },
  );

  const { data: environments, isLoading: isLoadingEnvironments } = useCachedPromise(
    async () => {
      return fetchProjectEnvironments(projects ?? [], { baseUrl, token });
    },
    [projects?.length ?? 0],
    { keepPreviousData: true },
  );
  const envToProjectMap = useMemo(() => buildEnvToProjectMap(environments ?? []), [environments]);
  const envLookup = useMemo(() => buildEnvLookup(environments ?? []), [environments]);
  const envNameToIds = useMemo(() => buildEnvNameToIdsMap(environments ?? []), [environments]);

  const { data: databases, isLoading: isLoadingDatabases } = useCachedPromise(
    async () => {
      return requestJson<Database[]>("/databases", { baseUrl, token });
    },
    [],
    { keepPreviousData: true },
  );

  const filteredDatabases = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    const withFilter = applyFilter(databases ?? [], filterValue, envToProjectMap, envNameToIds);
    if (!lower) return withFilter;
    return withFilter.filter((database) => {
      const haystack = [database.name, database.description, database.db_type, database.uuid]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [databases, envNameToIds, envToProjectMap, filterValue, searchText]);

  return (
    <List
      isLoading={isLoadingProjects || isLoadingEnvironments || isLoadingDatabases}
      searchBarPlaceholder="Search Databases..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" onChange={setFilterValue}>
          <List.Dropdown.Item key="all" title="All Databases" value="all" />
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
        </List.Dropdown>
      }
    >
      {(filteredDatabases ?? []).map((database) => {
        const title = database.name ?? "Unnamed Database";
        const envId = String(database.environment_id ?? database.environment_uuid ?? "");
        const envInfo = envLookup.get(envId);
        const projectName = envInfo?.projectName ?? "";
        const environmentName = envInfo?.name ?? "";
        const projectUuid = envInfo?.projectUuid;
        const envUuid = envInfo?.uuid;
        const environmentUrl =
          projectUuid && envUuid ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}` : instanceUrl;
        const resourceUrl = resolveResourceUrl({
          instanceUrl,
          projectUuid,
          environmentUuid: envUuid,
          resourceUuid: database.uuid ? String(database.uuid) : undefined,
        });
        const accessories = [
          environmentName
            ? {
                tag: {
                  value: environmentName,
                  color: envColor(environmentName),
                },
              }
            : null,
          {
            tag: {
              value: "Database",
              color: Color.Green,
            },
          },
          database.db_type ? { text: database.db_type } : null,
          projectName ? { text: projectName } : null,
        ].filter(Boolean) as { text?: string; tag?: { value: string; color: Color } }[];

        return (
          <List.Item
            key={String(database.id ?? database.uuid ?? title)}
            title={title}
            subtitle={database.description}
            accessories={accessories}
            detail={
              <ResourceDetails
                info={{
                  title,
                  type: "Database",
                  description: database.description,
                  projectName,
                  environmentName,
                  kind: database.db_type,
                  uuid: database.uuid ? String(database.uuid) : undefined,
                  coolifyUrl: resourceUrl,
                  environmentUrl,
                }}
              />
            }
            actions={
              <ActionPanel>
                {resourceUrl ? (
                  <Action.OpenInBrowser title="Open in Coolify" url={resourceUrl} icon={Icon.Globe} />
                ) : null}
                <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} icon={Icon.Globe} />
                <ActionPanel.Section>
                  {database.uuid ? (
                    <RedeploySubmenu baseUrl={baseUrl} token={token} uuid={String(database.uuid)} />
                  ) : null}
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy Database Name" content={title} />
                  {resourceUrl ? <Action.CopyToClipboard title="Copy Coolify URL" content={resourceUrl} /> : null}
                  <Action.CopyToClipboard title="Copy Environment URL" content={environmentUrl} />
                  {database.uuid ? <Action.CopyToClipboard title="Copy Database UUID" content={database.uuid} /> : null}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoadingDatabases && (filteredDatabases ?? []).length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No databases found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <DatabasesList />
    </WithValidToken>
  );
}
