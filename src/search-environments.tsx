import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, fetchProjectEnvironments, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import { Project, buildEnvLookup, toId } from "./api/filters";
import EnvironmentResourcesList from "./components/environment-resources";
import WithValidToken from "./pages/with-valid-token";

function EnvironmentsList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [filterValue, setFilterValue] = useState("all");
  const [searchText, setSearchText] = useState("");

  const { data: projects, isLoading } = useCachedPromise(
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

  const filteredEnvironments = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    const byProject =
      filterValue === "all"
        ? (environments ?? [])
        : (environments ?? []).filter((env) => toId(env.projectId) === filterValue.replace("project:", ""));
    if (!lower) return byProject;
    return byProject.filter((env) => {
      const haystack = [env.name, env.projectName, env.uuid, env.id]
        .filter(Boolean)
        .map((value) => String(value))
        .join(" ")
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [environments, filterValue, searchText]);
  const envLookup = useMemo(() => buildEnvLookup(environments ?? []), [environments]);

  return (
    <List
      isLoading={isLoading || isLoadingEnvironments}
      navigationTitle="Results"
      searchBarPlaceholder="Search Environments..."
      onSearchTextChange={setSearchText}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Project" onChange={setFilterValue}>
          <List.Dropdown.Item key="all" title="All Projects" value="all" />
          <List.Dropdown.Section title="Projects">
            {(projects ?? []).map((project) => {
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
        </List.Dropdown>
      }
    >
      {(filteredEnvironments ?? []).map((env) => {
        const envId = toId(env.id ?? env.uuid) ?? "";
        const envInfo = envLookup.get(envId);
        const projectUuid = envInfo?.projectUuid;
        return (
          <List.Item
            key={envId || env.name}
            title={env.name ?? "Unnamed Environment"}
            subtitle={env.projectName}
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
                      projectUuid={projectUuid}
                      environmentId={String(env.id ?? "")}
                      environmentUuid={env.uuid ? String(env.uuid) : undefined}
                      environmentName={env.name ?? "Environment"}
                    />
                  }
                />
                <Action.OpenInBrowser
                  title="Open Environment in Coolify"
                  url={
                    projectUuid && env.uuid
                      ? `${instanceUrl}/project/${projectUuid}/environment/${env.uuid}`
                      : instanceUrl
                  }
                />
                {env.uuid ? <Action.CopyToClipboard title="Copy Environment UUID" content={env.uuid} /> : null}
              </ActionPanel>
            }
          />
        );
      })}
      {!isLoading && (filteredEnvironments ?? []).length === 0 ? (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="No environments found" />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <EnvironmentsList />
    </WithValidToken>
  );
}
