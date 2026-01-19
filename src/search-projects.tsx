import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import { Project, ProjectEnvironment, flattenEnvironments, toId } from "./api/filters";
import EnvironmentResourcesList from "./components/environment-resources";
import WithValidToken from "./pages/with-valid-token";

type ProjectEnvironmentResponse = {
  id?: number | string;
  uuid?: string;
  name?: string;
};

function EnvironmentList({
  baseUrl,
  token,
  instanceUrl,
  project,
}: {
  baseUrl: string;
  token: string;
  instanceUrl: string;
  project: Project;
}) {
  const projectUuid = project.uuid ?? "";
  const { data: environments, isLoading } = useCachedPromise(
    async () => {
      if (!projectUuid) return [] as ProjectEnvironmentResponse[];
      return requestJson<ProjectEnvironmentResponse[]>(`/projects/${projectUuid}/environments`, { baseUrl, token });
    },
    [projectUuid],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search environments...">
      {(environments ?? []).map((environment) => (
        <List.Item
          key={String(environment.id ?? environment.uuid ?? environment.name)}
          title={environment.name ?? "Unnamed Environment"}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Resources"
                icon={Icon.List}
                target={
                  <EnvironmentResourcesList
                    baseUrl={baseUrl}
                    token={token}
                    instanceUrl={instanceUrl}
                    projectUuid={project.uuid}
                    environmentId={String(environment.id ?? "")}
                    environmentUuid={environment.uuid ? String(environment.uuid) : undefined}
                    environmentName={environment.name ?? "Environment"}
                  />
                }
              />
              <Action.OpenInBrowser
                title="Open Environment in Coolify"
                url={
                  project.uuid && environment.uuid
                    ? `${instanceUrl}/project/${project.uuid}/environment/${environment.uuid}`
                    : instanceUrl
                }
              />
              {environment.uuid ? (
                <Action.CopyToClipboard title="Copy Environment UUID" content={environment.uuid} />
              ) : null}
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && (environments ?? []).length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No environments found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

function ProjectsList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [searchText, setSearchText] = useState("");

  const { data: projects, isLoading } = useCachedPromise(
    async () => {
      return requestJson<Project[]>("/projects", { baseUrl, token });
    },
    [],
    { keepPreviousData: true },
  );

  const filteredProjects = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    if (!lower) return projects ?? [];
    return (projects ?? []).filter((project) => {
      const haystack = [project.name, project.uuid, project.id]
        .filter(Boolean)
        .map((value) => String(value))
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [projects, searchText]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Projects..." onSearchTextChange={setSearchText} throttle>
      {(filteredProjects ?? []).map((project) => {
        const environments = flattenEnvironments([project]) as ProjectEnvironment[];
        const environmentCount = environments.length;
        const projectId = toId(project.id ?? project.uuid) ?? "";
        const projectUrl = project.uuid ? `${instanceUrl}/project/${project.uuid}` : instanceUrl;

        return (
          <List.Item
            key={projectId || project.name}
            title={project.name ?? "Unnamed Project"}
            accessories={environmentCount > 0 ? [{ text: `${environmentCount} env` }] : []}
            actions={
              <ActionPanel>
                {project.uuid ? (
                  <Action.Push
                    title="Show Environments"
                    icon={Icon.List}
                    target={
                      <EnvironmentList baseUrl={baseUrl} token={token} instanceUrl={instanceUrl} project={project} />
                    }
                  />
                ) : null}
                <Action.OpenInBrowser title="Open Project in Coolify" url={projectUrl} />
                {project.uuid ? <Action.CopyToClipboard title="Copy Project UUID" content={project.uuid} /> : null}
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoading && (filteredProjects ?? []).length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No projects found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <ProjectsList />
    </WithValidToken>
  );
}
