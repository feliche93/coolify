import { Action, ActionPanel, Color, Detail, Icon, List, getPreferenceValues } from "@raycast/api";
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
import fromNow from "./utils/time";

type Deployment = {
  id?: number | string;
  deployment_uuid?: string;
  status?: string;
  application_id?: number | string;
  application_uuid?: string;
  application_name?: string;
  name?: string;
  deployment_url?: string;
  commit_message?: string;
  commit?: string;
  created_at?: string;
  updated_at?: string;
  source_app_uuid?: string;
  environment_id?: number | string;
  environment_uuid?: string;
  server_name?: string;
  logs?: unknown;
  git_type?: string;
  pull_request_id?: number | string;
};

type Application = {
  id?: number | string;
  uuid?: string;
  name?: string;
  git_branch?: string;
  environment_id?: number | string;
  environment_uuid?: string;
};

const ACTIVE_STATUSES = new Set(["running", "queued", "pending"]);

function statusIcon(status?: string) {
  const value = (status ?? "").toLowerCase();
  if (value === "running") return { source: Icon.Dot, tintColor: Color.Green };
  if (value === "queued" || value === "pending") return { source: Icon.Dot, tintColor: Color.Yellow };
  if (value === "failed") return { source: Icon.Dot, tintColor: Color.Red };
  return { source: Icon.Dot, tintColor: Color.SecondaryText };
}

function normalizeUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

function buildCoolifyDeploymentUrl({
  instanceUrl,
  projectUuid,
  environmentUuid,
  applicationUuid,
  deploymentUuid,
}: {
  instanceUrl: string;
  projectUuid?: string;
  environmentUuid?: string;
  applicationUuid?: string;
  deploymentUuid?: string;
}) {
  if (!projectUuid || !environmentUuid || !applicationUuid || !deploymentUuid) return undefined;
  const base = instanceUrl.replace(/\/+$/, "");
  return `${base}/project/${projectUuid}/environment/${environmentUuid}/application/${applicationUuid}/deployment/${deploymentUuid}`;
}

function buildCoolifyLogsUrl({
  instanceUrl,
  projectUuid,
  environmentUuid,
  applicationUuid,
}: {
  instanceUrl: string;
  projectUuid?: string;
  environmentUuid?: string;
  applicationUuid?: string;
}) {
  if (!projectUuid || !environmentUuid || !applicationUuid) return undefined;
  const base = instanceUrl.replace(/\/+$/, "");
  return `${base}/project/${projectUuid}/environment/${environmentUuid}/application/${applicationUuid}/logs`;
}

function resolveDeployUrl(url: string | undefined, instanceUrl: string) {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = instanceUrl.replace(/\/+$/, "");
  if (url.startsWith("/")) return `${base}${url}`;
  if (url.startsWith("project/")) return `${base}/${url}`;
  return normalizeUrl(url);
}

function resolveLogsUrl(value: unknown, instanceUrl: string) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return resolveDeployUrl(trimmed, instanceUrl);
}

function resolveEnvId(deployment: Deployment, appIdToEnvId: Map<string, string>, appKey: string): string {
  const fromMap = appIdToEnvId.get(appKey);
  if (fromMap) return fromMap;
  const direct = toId(deployment.environment_id ?? deployment.environment_uuid);
  return direct ?? "";
}

function resolveAppKey(deployment: Deployment) {
  return String(deployment.source_app_uuid ?? deployment.application_uuid ?? deployment.application_id ?? "");
}

function isHttpUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function applyFilter(
  items: Deployment[],
  filterValue: string,
  envToProjectMap: Map<string, string>,
  envNameToIds: Map<string, Set<string>>,
  appIdToEnvId: Map<string, string>,
): Deployment[] {
  if (filterValue === "all") return items;
  if (filterValue === "status:active") {
    return items.filter((item) => ACTIVE_STATUSES.has((item.status ?? "").toLowerCase()));
  }
  if (filterValue.startsWith("project:")) {
    const projectId = filterValue.replace("project:", "");
    return items.filter((item) => {
      const appKey = resolveAppKey(item);
      const envId = resolveEnvId(item, appIdToEnvId, appKey);
      return envToProjectMap.get(envId) === projectId;
    });
  }
  if (filterValue.startsWith("env:")) {
    const envName = filterValue.replace("env:", "");
    const envIds = envNameToIds.get(envName);
    if (!envIds) return [];
    return items.filter((item) => {
      const appKey = resolveAppKey(item);
      const envId = resolveEnvId(item, appIdToEnvId, appKey);
      return envIds.has(envId);
    });
  }
  return items;
}

function DeploymentsList() {
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

  const appIdToEnvId = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of applications ?? []) {
      const envId = toId(app.environment_id ?? app.environment_uuid) ?? "";
      if (app.id !== undefined && envId) map.set(String(app.id), envId);
      if (app.uuid && envId) map.set(String(app.uuid), envId);
    }
    return map;
  }, [applications]);

  const appIdToApp = useMemo(() => {
    const map = new Map<string, Application>();
    for (const app of applications ?? []) {
      if (app.id !== undefined) map.set(String(app.id), app);
      if (app.uuid) map.set(String(app.uuid), app);
    }
    return map;
  }, [applications]);

  const { data: deployments, isLoading: isLoadingDeployments } = useCachedPromise(
    async () => {
      const appUuids = (applications ?? []).map((app) => app.uuid).filter(Boolean) as string[];
      const requests = appUuids.map((uuid) =>
        requestJson<Deployment[] | { data?: Deployment[]; deployments?: Deployment[] }>(
          `/deployments/applications/${uuid}?take=20`,
          { baseUrl, token },
        ).then((rows) => {
          const list = Array.isArray(rows) ? rows : (rows?.deployments ?? rows?.data ?? []);
          return list.map((row) => ({ ...row, source_app_uuid: uuid }));
        }),
      );
      if (!requests.length) return [] as Deployment[];
      const results = await Promise.all(requests);
      return results.flat();
    },
    [applications?.length ?? 0],
    { keepPreviousData: true },
  );

  const filteredDeployments = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    const withFilter = applyFilter(deployments ?? [], filterValue, envToProjectMap, envNameToIds, appIdToEnvId);
    const sorted = [...withFilter].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
    if (!lower) return sorted;
    return sorted.filter((deployment) => {
      const haystack = [deployment.application_name, deployment.commit_message, deployment.commit, deployment.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [appIdToEnvId, deployments, envNameToIds, envToProjectMap, filterValue, searchText]);

  return (
    <List
      isLoading={isLoadingProjects || isLoadingEnvironments || isLoadingApplications || isLoadingDeployments}
      navigationTitle="Results"
      searchBarPlaceholder="Search Deployments..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" onChange={setFilterValue}>
          <List.Dropdown.Item key="all" title="All Deployments" value="all" />
          <List.Dropdown.Section title="Status">
            <List.Dropdown.Item title="Active (Running/Queued)" value="status:active" />
          </List.Dropdown.Section>
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
      {(filteredDeployments ?? []).map((deployment) => {
        const appKey = resolveAppKey(deployment);
        const appInfo = appIdToApp.get(appKey);
        const envId = resolveEnvId(deployment, appIdToEnvId, appKey);
        const envInfo = envLookup.get(envId);
        const projectUuid = envInfo?.projectUuid ?? "";
        const envUuid = envInfo?.uuid ?? "";
        const applicationUuid = appInfo?.uuid ?? deployment.source_app_uuid ?? deployment.application_uuid ?? "";
        const environmentUrl =
          projectUuid && envUuid ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}` : instanceUrl;
        const applicationUrl =
          projectUuid && envUuid && applicationUuid
            ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}/application/${applicationUuid}`
            : environmentUrl;
        const deploymentUrl = buildCoolifyDeploymentUrl({
          instanceUrl,
          projectUuid,
          environmentUuid: envUuid,
          applicationUuid,
          deploymentUuid: deployment.deployment_uuid ?? "",
        });
        const consoleLogsUrl = buildCoolifyLogsUrl({
          instanceUrl,
          projectUuid,
          environmentUuid: envUuid,
          applicationUuid,
        });
        const deployUrl = resolveDeployUrl(deployment.deployment_url, instanceUrl);
        const logsUrl = resolveLogsUrl(deployment.logs, instanceUrl);
        const envName = envNameMap.get(envId) ?? "";
        const status = deployment.status ?? "unknown";
        const branch = appInfo?.git_branch ?? "";
        const createdAt = deployment.created_at ? new Date(deployment.created_at).getTime() : undefined;
        const projectName = envInfo?.projectName ?? "";
        const accessories = [
          projectName ? { text: projectName } : null,
          branch
            ? {
                text: branch,
                icon: branch ? { source: "boxicon-git-branch.svg", tintColor: Color.SecondaryText } : null,
              }
            : null,
          {
            text: createdAt ? fromNow(createdAt, new Date()) : "",
            tooltip: createdAt ? new Date(createdAt).toLocaleString() : "",
          },
        ].filter(Boolean) as { text: string; icon?: { source: string; tintColor: Color } }[];

        return (
          <List.Item
            key={String(deployment.deployment_uuid ?? deployment.id ?? deployment.application_name ?? "deployment")}
            title={deployment.commit_message ?? deployment.commit ?? "No commit message"}
            icon={statusIcon(status)}
            subtitle={deployment.application_name ?? deployment.name ?? appInfo?.name ?? "Application"}
            accessories={accessories}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Show Details"
                  icon={Icon.Sidebar}
                  target={
                    <DeploymentDetails
                      deployment={deployment}
                      appName={deployment.application_name ?? deployment.name ?? appInfo?.name ?? ""}
                      branch={branch}
                      environmentName={envName}
                      coolifyUrl={deploymentUrl}
                      deployUrl={deployUrl}
                      logsUrl={logsUrl}
                      consoleLogsUrl={consoleLogsUrl}
                    />
                  }
                />
                {isHttpUrl(deployUrl) ? <Action.OpenInBrowser title="Open Deploy URL" url={deployUrl!} /> : null}
                {isHttpUrl(deploymentUrl) ? (
                  <Action.OpenInBrowser title="Open in Coolify" url={deploymentUrl!} />
                ) : isHttpUrl(applicationUrl) ? (
                  <Action.OpenInBrowser title="Open in Coolify" url={applicationUrl} />
                ) : null}
                {isHttpUrl(applicationUrl) ? (
                  <Action.OpenInBrowser title="Redeploy in Coolify" url={applicationUrl} />
                ) : null}
                {isHttpUrl(consoleLogsUrl) ? (
                  <Action.OpenInBrowser title="Open Console Logs" url={consoleLogsUrl!} />
                ) : null}
                {isHttpUrl(logsUrl) ? <Action.OpenInBrowser title="Open Logs" url={logsUrl!} /> : null}
                {deployment.deployment_uuid ? (
                  <Action.CopyToClipboard title="Copy Deployment UUID" content={deployment.deployment_uuid} />
                ) : null}
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoadingDeployments && (filteredDeployments ?? []).length === 0 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No deployments found" />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <DeploymentsList />
    </WithValidToken>
  );
}
function DeploymentDetails({
  deployment,
  appName,
  branch,
  environmentName,
  coolifyUrl,
  deployUrl,
  logsUrl,
  consoleLogsUrl,
}: {
  deployment: Deployment;
  appName: string;
  branch: string;
  environmentName: string;
  coolifyUrl?: string;
  deployUrl?: string;
  logsUrl?: string;
  consoleLogsUrl?: string;
}) {
  const title = deployment.commit_message ?? deployment.commit ?? "Deployment";
  const createdAt = deployment.created_at ? new Date(deployment.created_at) : undefined;
  const updatedAt = deployment.updated_at ? new Date(deployment.updated_at) : undefined;

  const markdown = `# ${title}\n\n${appName ? `**App:** ${appName}\n\n` : ""}${
    environmentName ? `**Environment:** ${environmentName}\n\n` : ""
  }${deployUrl ? `**Deploy URL:** ${deployUrl}\n\n` : ""}`;

  return (
    <Detail
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Status" text={deployment.status ?? "unknown"} />
          {appName ? <Detail.Metadata.Label title="Application" text={appName} /> : null}
          {branch ? <Detail.Metadata.Label title="Git Branch" text={branch} /> : null}
          {deployment.commit_message ? (
            <Detail.Metadata.Label title="Commit Message" text={deployment.commit_message} />
          ) : null}
          {deployment.commit ? <Detail.Metadata.Label title="Commit SHA" text={deployment.commit} /> : null}
          {deployment.server_name ? <Detail.Metadata.Label title="Server" text={deployment.server_name} /> : null}
          {deployment.git_type ? <Detail.Metadata.Label title="Git Provider" text={deployment.git_type} /> : null}
          {deployment.pull_request_id ? (
            <Detail.Metadata.Label title="Pull Request ID" text={String(deployment.pull_request_id)} />
          ) : null}
          {createdAt ? <Detail.Metadata.Label title="Created" text={createdAt.toLocaleString()} /> : null}
          {updatedAt ? <Detail.Metadata.Label title="Updated" text={updatedAt.toLocaleString()} /> : null}
          {isHttpUrl(deployUrl) ? (
            <Detail.Metadata.Link title="Deploy URL" text={deployUrl} target={deployUrl!} />
          ) : null}
          {isHttpUrl(coolifyUrl) ? (
            <Detail.Metadata.Link title="Coolify" text="Open Deployment" target={coolifyUrl!} />
          ) : null}
          {isHttpUrl(consoleLogsUrl) ? (
            <Detail.Metadata.Link title="Console Logs" text="Open Logs" target={consoleLogsUrl!} />
          ) : null}
          {isHttpUrl(logsUrl) ? <Detail.Metadata.Link title="Logs" text="Open Logs" target={logsUrl!} /> : null}
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          {isHttpUrl(deployUrl) ? <Action.OpenInBrowser title="Open Deploy URL" url={deployUrl!} /> : null}
          {isHttpUrl(coolifyUrl) ? <Action.OpenInBrowser title="Open in Coolify" url={coolifyUrl!} /> : null}
          {isHttpUrl(consoleLogsUrl) ? <Action.OpenInBrowser title="Open Console Logs" url={consoleLogsUrl!} /> : null}
          {isHttpUrl(logsUrl) ? <Action.OpenInBrowser title="Open Logs" url={logsUrl!} /> : null}
        </ActionPanel>
      }
    />
  );
}
