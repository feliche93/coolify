import { Action, ActionPanel, Clipboard, Detail, Icon, List, Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { requestJson } from "../api/client";
import { toId } from "../api/filters";
import { Application, Database, ResourceType, Service, buildResources } from "../lib/resources";

type EnvironmentResourcesProps = {
  baseUrl: string;
  token: string;
  instanceUrl: string;
  projectUuid?: string;
  environmentId?: string;
  environmentUuid?: string;
  environmentName?: string;
};

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

function isHttpUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildConsoleLogsUrl({
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

async function fetchApplicationLogs({
  baseUrl,
  token,
  applicationUuid,
  lines,
}: {
  baseUrl: string;
  token: string;
  applicationUuid: string;
  lines: number;
}) {
  const response = await requestJson<{ logs?: string } | string>(
    `/applications/${applicationUuid}/logs?lines=${lines}`,
    { baseUrl, token },
  );
  if (typeof response === "string") return response;
  if (response && typeof response === "object" && "logs" in response) return response.logs ?? "";
  return "";
}

async function deployByUuid({
  baseUrl,
  token,
  uuid,
  force,
}: {
  baseUrl: string;
  token: string;
  uuid: string;
  force?: boolean;
}) {
  const params = force ? "?force=true" : "";
  await requestJson(`/deploy?uuid=${uuid}${params}`, { baseUrl, token });
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

export default function EnvironmentResourcesList({
  baseUrl,
  token,
  instanceUrl,
  projectUuid,
  environmentId,
  environmentUuid,
  environmentName,
}: EnvironmentResourcesProps) {
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
    const envId = toId(environmentId);
    const envUuid = toId(environmentUuid);
    const keys = new Set([envId, envUuid].filter(Boolean) as string[]);
    if (keys.size === 0) return [];
    return resources.filter((item) => keys.has(toId(item.environmentId) ?? ""));
  }, [environmentId, environmentUuid, resources]);

  const environmentUrl =
    projectUuid && environmentUuid
      ? `${instanceUrl}/project/${projectUuid}/environment/${environmentUuid}`
      : instanceUrl;

  return (
    <List
      isLoading={isLoadingApplications || isLoadingServices || isLoadingDatabases}
      navigationTitle={environmentName ? `${environmentName} Resources` : "Resources"}
      searchBarPlaceholder="Search resources..."
    >
      {filteredResources.map((item) => {
        const resourceUrl = resolveResourceUrl({
          instanceUrl,
          projectUuid,
          environmentUuid,
          resourceUuid: item.uuid,
          type: item.type,
        });
        const consoleLogsUrl =
          item.type === "application"
            ? buildConsoleLogsUrl({
                instanceUrl,
                projectUuid,
                environmentUuid,
                applicationUuid: item.uuid,
              })
            : undefined;
        const accessories = [item.kind ? { text: item.kind } : null].filter(Boolean) as {
          text?: string;
          tag?: { value: string; color: string };
        }[];

        return (
          <List.Item
            key={`${item.type}-${item.id}`}
            title={item.name}
            subtitle={item.subtitle}
            icon={typeIcon(item.type)}
            accessories={accessories}
            actions={
              <ActionPanel>
                {item.url ? <Action.OpenInBrowser title="Open Application" url={item.url} icon={Icon.Link} /> : null}
                {resourceUrl ? (
                  <Action.OpenInBrowser title="Open in Coolify" url={resourceUrl} icon={Icon.Globe} />
                ) : null}
                <ActionPanel.Section>
                  {item.uuid ? (
                    <ActionPanel.Submenu title="Redeploy" icon={Icon.ArrowClockwise}>
                      <Action
                        title="Redeploy"
                        onAction={async () => {
                          try {
                            await deployByUuid({ baseUrl, token, uuid: item.uuid as string });
                            await showToast({ style: Toast.Style.Success, title: "Redeploy triggered" });
                          } catch (error) {
                            await showToast({
                              style: Toast.Style.Failure,
                              title: "Failed to redeploy",
                              message: error instanceof Error ? error.message : String(error),
                            });
                          }
                        }}
                      />
                      <Action
                        title="Force Redeploy"
                        style={Action.Style.Destructive}
                        onAction={async () => {
                          try {
                            await deployByUuid({ baseUrl, token, uuid: item.uuid as string, force: true });
                            await showToast({ style: Toast.Style.Success, title: "Force redeploy triggered" });
                          } catch (error) {
                            await showToast({
                              style: Toast.Style.Failure,
                              title: "Failed to force redeploy",
                              message: error instanceof Error ? error.message : String(error),
                            });
                          }
                        }}
                      />
                    </ActionPanel.Submenu>
                  ) : null}
                  {item.type === "application" ? (
                    <ActionPanel.Submenu title="Logs" icon={Icon.Terminal}>
                      {isHttpUrl(consoleLogsUrl) ? (
                        <Action.OpenInBrowser title="Open Console Logs" url={consoleLogsUrl!} icon={Icon.Terminal} />
                      ) : null}
                      {item.uuid ? (
                        <Action
                          title="Copy Logs"
                          onAction={async () => {
                            try {
                              const logs = await fetchApplicationLogs({
                                baseUrl,
                                token,
                                applicationUuid: item.uuid as string,
                                lines: 1000,
                              });
                              if (!logs) {
                                await showToast({ style: Toast.Style.Failure, title: "No logs returned" });
                                return;
                              }
                              await Clipboard.copy(logs);
                              await showToast({ style: Toast.Style.Success, title: "Copied logs" });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: "Failed to fetch logs",
                                message: error instanceof Error ? error.message : String(error),
                              });
                            }
                          }}
                        />
                      ) : null}
                      {item.uuid ? (
                        <Action.Push
                          title="Show Last 100 Lines"
                          target={
                            <LogsDetail
                              baseUrl={baseUrl}
                              token={token}
                              applicationUuid={item.uuid as string}
                              lines={100}
                            />
                          }
                        />
                      ) : null}
                      {item.uuid ? (
                        <Action.Push
                          title="Show Last 500 Lines"
                          target={
                            <LogsDetail
                              baseUrl={baseUrl}
                              token={token}
                              applicationUuid={item.uuid as string}
                              lines={500}
                            />
                          }
                        />
                      ) : null}
                    </ActionPanel.Submenu>
                  ) : null}
                  <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} icon={Icon.Globe} />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy Name" content={item.name} />
                  {item.uuid ? <Action.CopyToClipboard title="Copy UUID" content={item.uuid} /> : null}
                  {item.repo ? <Action.CopyToClipboard title="Copy Repository URL" content={item.repo} /> : null}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
      {!filteredResources.length ? <List.EmptyView icon={Icon.MagnifyingGlass} title="No resources found" /> : null}
    </List>
  );
}

function LogsDetail({
  baseUrl,
  token,
  applicationUuid,
  lines,
}: {
  baseUrl: string;
  token: string;
  applicationUuid: string;
  lines: number;
}) {
  const { data, isLoading } = useCachedPromise(
    async () => fetchApplicationLogs({ baseUrl, token, applicationUuid, lines }),
    [baseUrl, applicationUuid, lines],
  );

  const content = data?.trim() ? `\`\`\`\n${data}\n\`\`\`` : "No logs returned.";

  return <Detail isLoading={isLoading} markdown={content} />;
}
