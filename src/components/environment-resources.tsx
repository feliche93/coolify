import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo } from "react";
import { requestJson } from "../api/client";
import { toId } from "../api/filters";
import { Application, Database, ResourceType, Service, buildResources } from "../lib/resources";
import EnvironmentVariablesList from "./environment-variables";
import { buildConsoleLogsUrl, LogsSubmenu } from "./logs-actions";
import { RedeploySubmenu } from "./redeploy-actions";
import { ResourceDetails } from "./resource-details";

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

// buildConsoleLogsUrl, LogsSubmenu, and redeploy actions are shared in components

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
        const canViewEnvVars = item.type === "application" || item.type === "service";
        const accessories = [
          {
            tag: {
              value: item.type.charAt(0).toUpperCase() + item.type.slice(1),
              color: item.type === "application" ? "blue" : item.type === "service" ? "orange" : "green",
            },
          },
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
                  type: item.type.charAt(0).toUpperCase() + item.type.slice(1),
                  projectName: undefined,
                  environmentName,
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
                {item.url ? <Action.OpenInBrowser title="Open Application" url={item.url} icon={Icon.Link} /> : null}
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
      {!filteredResources.length ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No resources found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}
