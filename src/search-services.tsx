import { Action, ActionPanel, Icon, List, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, fetchProjectEnvironments, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import { Project, buildEnvLookup, buildEnvNameToIdsMap, buildEnvToProjectMap, toId } from "./api/filters";
import WithValidToken from "./pages/with-valid-token";

type Service = {
  id?: number | string;
  uuid?: string;
  name?: string;
  description?: string;
  environment_id?: number | string;
  environment_uuid?: string;
  service_type?: string;
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
  return `${base}/project/${projectUuid}/environment/${environmentUuid}/service/${resourceUuid}`;
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

function applyFilter(
  items: Service[],
  filterValue: string,
  envToProjectMap: Map<string, string>,
  envNameToIds: Map<string, Set<string>>,
): Service[] {
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

function ServicesList() {
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

  const { data: services, isLoading: isLoadingServices } = useCachedPromise(
    async () => {
      return requestJson<Service[]>("/services", { baseUrl, token });
    },
    [],
    { keepPreviousData: true },
  );

  const filteredServices = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    const withFilter = applyFilter(services ?? [], filterValue, envToProjectMap, envNameToIds);
    if (!lower) return withFilter;
    return withFilter.filter((service) => {
      const haystack = [service.name, service.description, service.service_type, service.uuid]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [envNameToIds, envToProjectMap, filterValue, searchText, services]);

  return (
    <List
      isLoading={isLoadingProjects || isLoadingEnvironments || isLoadingServices}
      navigationTitle="Services"
      searchBarPlaceholder="Search Services..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter" onChange={setFilterValue}>
          <List.Dropdown.Item key="all" title="All Services" value="all" />
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
      {(filteredServices ?? []).map((service) => {
        const title = service.name ?? "Unnamed Service";
        const envId = String(service.environment_id ?? service.environment_uuid ?? "");
        const envInfo = envLookup.get(envId);
        const projectName = envInfo?.projectName ?? "";
        const projectUuid = envInfo?.projectUuid;
        const envUuid = envInfo?.uuid;
        const environmentUrl =
          projectUuid && envUuid ? `${instanceUrl}/project/${projectUuid}/environment/${envUuid}` : instanceUrl;
        const resourceUrl = resolveResourceUrl({
          instanceUrl,
          projectUuid,
          environmentUuid: envUuid,
          resourceUuid: service.uuid ? String(service.uuid) : undefined,
        });
        const accessories = [
          projectName ? { text: projectName } : null,
          service.service_type ? { text: service.service_type } : null,
        ].filter(Boolean) as { text: string }[];

        return (
          <List.Item
            key={String(service.id ?? service.uuid ?? title)}
            title={title}
            subtitle={service.description}
            accessories={accessories}
            actions={
              <ActionPanel>
                {resourceUrl ? (
                  <Action.OpenInBrowser title="Open in Coolify" url={resourceUrl} icon={Icon.Globe} />
                ) : null}
                <ActionPanel.Section>
                  {service.uuid ? (
                    <ActionPanel.Submenu title="Redeploy" icon={Icon.ArrowClockwise}>
                      <Action
                        title="Redeploy"
                        onAction={async () => {
                          try {
                            await deployByUuid({ baseUrl, token, uuid: String(service.uuid) });
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
                            await deployByUuid({ baseUrl, token, uuid: String(service.uuid), force: true });
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
                  <Action.OpenInBrowser title="Open Environment in Coolify" url={environmentUrl} icon={Icon.Globe} />
                </ActionPanel.Section>
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy Service Name" content={title} />
                  {service.uuid ? <Action.CopyToClipboard title="Copy Service UUID" content={service.uuid} /> : null}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoadingServices && (filteredServices ?? []).length === 0 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No services found" />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <ServicesList />
    </WithValidToken>
  );
}
