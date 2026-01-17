import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, fetchProjectEnvironments, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import {
  Project,
  buildEnvLookup,
  buildEnvNameToIdsMap,
  buildEnvNameMap,
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
  status?: string;
  deployment_status?: string;
  last_deployment_status?: string;
};

function getPrimaryUrl(app: Application): string | undefined {
  if (!app.fqdn) return undefined;
  const raw = app.fqdn.split(",")[0]?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function statusTag(app: Application) {
  const raw = (app.status ?? app.deployment_status ?? app.last_deployment_status ?? "").toLowerCase();
  if (!raw) return null;
  if (raw.includes("fail") || raw.includes("error")) {
    return { value: "failed", color: Color.Red };
  }
  if (raw.includes("running") || raw.includes("ready") || raw.includes("success")) {
    return { value: "ready", color: Color.Green };
  }
  if (raw.includes("queue") || raw.includes("pending") || raw.includes("building")) {
    return { value: "queued", color: Color.Yellow };
  }
  return { value: raw, color: Color.SecondaryText };
}

function applyFilter(
  items: Application[],
  filterValue: string,
  envToProjectMap: Map<string, string>,
  hasEnvMapping: boolean,
  envNameToIds: Map<string, Set<string>>,
): Application[] {
  if (filterValue === "all") return items;
  if (filterValue.startsWith("env:")) {
    const envName = filterValue.replace("env:", "");
    const envIds = envNameToIds.get(envName);
    if (!envIds) return [];
    return items.filter((item) => envIds.has(String(item.environment_id ?? "")));
  }
  if (filterValue.startsWith("project:")) {
    if (!hasEnvMapping) return items;
    const projectId = filterValue.replace("project:", "");
    return items.filter((item) => {
      const envId = String(item.environment_id ?? "");
      return envToProjectMap.get(envId) === projectId;
    });
  }
  return items;
}

function ApplicationsList() {
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
  const hasEnvMapping = envToProjectMap.size > 0;

  const { data: applications, isLoading: isLoadingApplications } = useCachedPromise(
    async () => requestJson<Application[]>("/applications", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  const filteredApplications = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    const withFilter = applyFilter(applications ?? [], filterValue, envToProjectMap, hasEnvMapping, envNameToIds);
    if (!lower) return withFilter;
    return withFilter.filter((app) => {
      const haystack = [app.name, app.git_repository, app.git_branch, app.fqdn, app.uuid]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [applications, envNameToIds, envToProjectMap, filterValue, hasEnvMapping, searchText]);

  return (
    <List
      isLoading={isLoadingProjects || isLoadingEnvironments || isLoadingApplications}
      navigationTitle="Results"
      searchBarPlaceholder="Search Applications..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" onChange={setFilterValue}>
          <List.Dropdown.Item key="all" title="All Applications" value="all" />
          {projects && projects.length > 0 && hasEnvMapping ? (
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
      {(filteredApplications ?? []).map((app) => {
        const url = getPrimaryUrl(app);
        const title = app.name ?? "Unnamed Application";
        const subtitleParts = [app.git_branch, url].filter(Boolean);
        const accessoryTitle = app.git_repository ?? app.uuid ?? "";
        const envId = String(app.environment_id ?? "");
        const environmentName = envNameMap.get(envId) ?? "";
        const envInfo = envLookup.get(envId);
        const projectUuid = envInfo?.projectUuid;
        const envUuid = envInfo?.uuid;
        const environmentUrl =
          projectUuid && envUuid ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}` : instanceUrl;
        const status = statusTag(app);
        const accessories = [
          status
            ? {
                tag: {
                  value: status.value,
                  color: status.color,
                },
              }
            : null,
          environmentName ? { text: environmentName } : null,
          accessoryTitle ? { text: accessoryTitle } : null,
        ].filter(Boolean) as { text?: string; tag?: { value: string; color: Color } }[];

        return (
          <List.Item
            key={String(app.id ?? app.uuid ?? title)}
            title={title}
            subtitle={subtitleParts.join(" • ")}
            accessories={accessories}
            actions={
              <ActionPanel>
                {url ? <Action.OpenInBrowser title="Open Application" url={url} /> : null}
                <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} />
                <Action.CopyToClipboard title="Copy Application Name" content={title} />
                {app.uuid ? <Action.CopyToClipboard title="Copy Application UUID" content={app.uuid} /> : null}
                {app.git_repository ? (
                  <Action.CopyToClipboard title="Copy Repository URL" content={app.git_repository} />
                ) : null}
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoadingApplications && (filteredApplications ?? []).length === 0 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No applications found" />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <ApplicationsList />
    </WithValidToken>
  );
}
