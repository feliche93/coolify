import {
  Action,
  ActionPanel,
  Alert,
  Icon,
  List,
  confirmAlert,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import { Project, ProjectEnvironment, flattenEnvironments, toId } from "./api/filters";
import EnvironmentResourcesList from "./components/environment-resources";
import JsonDetail from "./components/json-detail";
import CreateProjectForm from "./components/projects/create-project";
import UpdateProjectForm from "./components/projects/update-project";
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
    async (uuid: string) => {
      if (!uuid) return [] as ProjectEnvironmentResponse[];
      return requestJson<ProjectEnvironmentResponse[]>(`/projects/${uuid}/environments`, { baseUrl, token });
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
              <Action.OpenInBrowser
                title="Open Environment in Coolify"
                url={
                  project.uuid && environment.uuid
                    ? `${instanceUrl}/project/${project.uuid}/environment/${environment.uuid}`
                    : instanceUrl
                }
              />
              {project.uuid ? (
                <Action.Push
                  title="View Environment JSON"
                  icon={Icon.Code}
                  target={
                    <JsonDetail
                      title="Environment Details"
                      baseUrl={baseUrl}
                      token={token}
                      path={`/projects/${project.uuid}/${environment.uuid ?? environment.name ?? ""}`}
                    />
                  }
                />
              ) : null}
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
              <ActionPanel.Section>
                {project.uuid && environment.uuid ? (
                  <Action.CopyToClipboard
                    title="Copy Environment URL"
                    content={`${instanceUrl}/project/${project.uuid}/environment/${environment.uuid}`}
                  />
                ) : null}
                {environment.uuid ? (
                  <Action.CopyToClipboard title="Copy Environment UUID" content={environment.uuid} />
                ) : null}
              </ActionPanel.Section>
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

  const {
    data: projects,
    isLoading,
    revalidate,
  } = useCachedPromise(
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
                <Action.OpenInBrowser title="Open Project in Coolify" url={projectUrl} />
                {project.uuid ? (
                  <Action.Push
                    title="Show Environments"
                    icon={Icon.List}
                    target={
                      <EnvironmentList baseUrl={baseUrl} token={token} instanceUrl={instanceUrl} project={project} />
                    }
                  />
                ) : null}
                {project.uuid ? (
                  <Action.Push
                    title="View Project JSON"
                    icon={Icon.Code}
                    target={
                      <JsonDetail
                        title="Project Details"
                        baseUrl={baseUrl}
                        token={token}
                        path={`/projects/${project.uuid}`}
                      />
                    }
                  />
                ) : null}
                {project.uuid ? (
                  <Action.Push
                    title="Update Project"
                    icon={Icon.Pencil}
                    target={
                      <UpdateProjectForm baseUrl={baseUrl} token={token} project={project} onUpdated={revalidate} />
                    }
                  />
                ) : null}
                <Action.Push
                  title="Add Project"
                  icon={Icon.Plus}
                  target={<CreateProjectForm baseUrl={baseUrl} token={token} onAdded={revalidate} />}
                />
                {project.uuid ? (
                  <Action
                    title="Delete Project"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={async () => {
                      await confirmAlert({
                        icon: { source: Icon.XMarkCircle, tintColor: "red" },
                        title: "Delete Project?",
                        message: "This operation is permanent and cannot be undone.",
                        primaryAction: {
                          title: "Delete",
                          style: Alert.ActionStyle.Destructive,
                          async onAction() {
                            const toast = await showToast(Toast.Style.Animated, "Deleting project");
                            try {
                              await requestJson(`/projects/${project.uuid}`, { baseUrl, token, method: "DELETE" });
                              await revalidate();
                              toast.style = Toast.Style.Success;
                              toast.title = "Deleted";
                            } catch (error) {
                              toast.style = Toast.Style.Failure;
                              toast.title = "Failed";
                              toast.message = error instanceof Error ? error.message : String(error);
                            }
                          },
                        },
                      });
                    }}
                  />
                ) : null}
                <ActionPanel.Section>
                  <Action.CopyToClipboard title="Copy Project URL" content={projectUrl} />
                  {project.uuid ? <Action.CopyToClipboard title="Copy Project UUID" content={project.uuid} /> : null}
                </ActionPanel.Section>
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
