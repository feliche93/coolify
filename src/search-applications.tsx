import { Action, ActionPanel, Color, Icon, List, Toast, getPreferenceValues, showToast } from "@raycast/api";
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
import ApplicationDeploymentsList from "./components/application-deployments";
import DeleteResourceForm from "./components/delete-resource";
import { buildConsoleLogsUrl, LogsSubmenu } from "./components/logs-actions";
import JsonDetail from "./components/json-detail";
import { ResourceDetails } from "./components/resource-details";
import { RedeploySubmenu } from "./components/redeploy-actions";
import EnvironmentVariablesList from "./components/environment-variables";
import WithValidToken from "./pages/with-valid-token";

type Application = {
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

function getPrimaryUrl(app: Application): string | undefined {
  if (!app.fqdn) return undefined;
  const raw = app.fqdn.split(",")[0]?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

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
  return `${base}/project/${projectUuid}/environment/${environmentUuid}/application/${resourceUuid}`;
}

// buildConsoleLogsUrl and redeploy/logs actions are shared in components

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

function envColor(name: string) {
  const value = name.toLowerCase();
  if (value.includes("prod")) return Color.Green;
  if (value.includes("preview")) return Color.Yellow;
  if (value.includes("stag")) return Color.Orange;
  if (value.includes("dev")) return Color.Blue;
  return Color.SecondaryText;
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
    async (projectList: Project[]) => fetchProjectEnvironments(projectList, { baseUrl, token }),
    [projects ?? []],
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
        const envId = String(app.environment_id ?? app.environment_uuid ?? "");
        const environmentName = envNameMap.get(envId) ?? "";
        const envInfo = envLookup.get(envId);
        const projectUuid = envInfo?.projectUuid;
        const envUuid = envInfo?.uuid;
        const environmentUrl =
          projectUuid && envUuid ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}` : instanceUrl;
        const resourceUrl = resolveResourceUrl({
          instanceUrl,
          projectUuid,
          environmentUuid: envUuid,
          resourceUuid: app.uuid ? String(app.uuid) : undefined,
        });
        const consoleLogsUrl = buildConsoleLogsUrl({
          instanceUrl,
          projectUuid,
          environmentUuid: envUuid,
          applicationUuid: app.uuid ? String(app.uuid) : undefined,
        });
        const status = statusTag(app);
        const envTag = environmentName
          ? {
              tag: {
                value: environmentName,
                color: envColor(environmentName),
              },
            }
          : null;
        const accessories = [
          status
            ? {
                tag: {
                  value: status.value,
                  color: status.color,
                },
              }
            : null,
          envTag,
          accessoryTitle ? { text: accessoryTitle } : null,
        ].filter(Boolean) as { text?: string; tag?: { value: string; color: Color } }[];

        return (
          <List.Item
            key={String(app.id ?? app.uuid ?? title)}
            title={title}
            subtitle={subtitleParts.join(" • ")}
            accessories={accessories}
            detail={
              <ResourceDetails
                info={{
                  title,
                  type: "Application",
                  status: app.status ?? app.deployment_status ?? app.last_deployment_status,
                  projectName: envInfo?.projectName,
                  environmentName,
                  branch: app.git_branch,
                  uuid: app.uuid ? String(app.uuid) : undefined,
                  url,
                  coolifyUrl: resourceUrl,
                  environmentUrl,
                  repoUrl: app.git_repository,
                }}
              />
            }
            actions={
              <ActionPanel>
                {resourceUrl ? (
                  <Action.OpenInBrowser title="Open in Coolify" url={resourceUrl} icon={Icon.Globe} />
                ) : null}
                {url ? <Action.OpenInBrowser title="Open Application" url={url} icon={Icon.Link} /> : null}
                <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} icon={Icon.Globe} />
                <ActionPanel.Section>
                  {app.uuid ? (
                    <Action.Push
                      title="View Environment Variables"
                      icon={Icon.Terminal}
                      target={
                        <EnvironmentVariablesList
                          baseUrl={baseUrl}
                          token={token}
                          resource={{ type: "application", uuid: String(app.uuid), name: title }}
                        />
                      }
                    />
                  ) : null}
                  {app.uuid ? (
                    <Action.Push
                      title="View Deployments"
                      icon={Icon.List}
                      target={
                        <ApplicationDeploymentsList
                          baseUrl={baseUrl}
                          token={token}
                          applicationUuid={String(app.uuid)}
                          applicationName={title}
                          instanceUrl={instanceUrl}
                        />
                      }
                    />
                  ) : null}
                  {app.uuid ? (
                    <LogsSubmenu
                      baseUrl={baseUrl}
                      token={token}
                      applicationUuid={String(app.uuid)}
                      consoleLogsUrl={consoleLogsUrl}
                    />
                  ) : null}
                  {app.uuid ? <RedeploySubmenu baseUrl={baseUrl} token={token} uuid={String(app.uuid)} /> : null}
                </ActionPanel.Section>
                {app.uuid ? (
                  <ActionPanel.Section title="Lifecycle">
                    <Action
                      icon={{ source: Icon.Play, tintColor: Color.Green }}
                      title="Start"
                      onAction={async () => {
                        try {
                          await requestJson(`/applications/${app.uuid}/start`, { baseUrl, token });
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
                          await requestJson(`/applications/${app.uuid}/stop`, { baseUrl, token });
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
                          await requestJson(`/applications/${app.uuid}/restart`, { baseUrl, token });
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
                      title="View Application JSON"
                      icon={Icon.Code}
                      target={
                        <JsonDetail
                          title="Application Details"
                          baseUrl={baseUrl}
                          token={token}
                          path={`/applications/${app.uuid}`}
                        />
                      }
                    />
                    <Action.Push
                      title="Delete Application"
                      icon={Icon.Trash}
                      target={
                        <DeleteResourceForm
                          baseUrl={baseUrl}
                          token={token}
                          resourceType="application"
                          uuid={String(app.uuid)}
                        />
                      }
                    />
                  </ActionPanel.Section>
                ) : null}
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy Application Name" content={title} />
                  {url ? <Action.CopyToClipboard title="Copy Application URL" content={url} /> : null}
                  {resourceUrl ? <Action.CopyToClipboard title="Copy Coolify URL" content={resourceUrl} /> : null}
                  <Action.CopyToClipboard title="Copy Environment URL" content={environmentUrl} />
                  {app.uuid ? <Action.CopyToClipboard title="Copy Application UUID" content={app.uuid} /> : null}
                  {app.git_branch ? <Action.CopyToClipboard title="Copy Git Branch" content={app.git_branch} /> : null}
                  {app.git_repository ? (
                    <Action.CopyToClipboard title="Copy Repository URL" content={app.git_repository} />
                  ) : null}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoadingApplications && (filteredApplications ?? []).length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No applications found"
          description="Check API token and permissions."
        />
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
