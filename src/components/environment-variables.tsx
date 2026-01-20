import { Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { requestJson } from "../api/client";

export type EnvironmentVariable = {
  uuid?: string;
  is_build_time?: boolean;
  is_literal?: boolean;
  is_multiline?: boolean;
  is_preview?: boolean;
  is_really_required?: boolean;
  is_required?: boolean;
  is_shared?: boolean;
  is_shown_once?: boolean;
  key?: string;
  order?: number | null;
  real_value?: string;
  value?: string | null;
  version?: string;
  created_at?: string;
  updated_at?: string;
};

export type EnvVarResource = {
  type: "application" | "service";
  uuid: string;
  name: string;
};

function resourceTypeToEndpoint(type: EnvVarResource["type"]) {
  return type === "application" ? "applications" : "services";
}

export default function EnvironmentVariablesList({
  baseUrl,
  token,
  resource,
}: {
  baseUrl: string;
  token: string;
  resource: EnvVarResource;
}) {
  const endpoint = `/${resourceTypeToEndpoint(resource.type)}/${resource.uuid}/envs`;
  const { isLoading, data: envs = [] } = useCachedPromise(
    async () => requestJson<EnvironmentVariable[]>(endpoint, { baseUrl, token }),
    [endpoint],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search environment variable" isShowingDetail>
      <List.Section title={`${resource.name} / Environment Variables`} subtitle={`${envs.length} envs`}>
        {envs.map((env) => (
          <List.Item
            key={env.uuid ?? env.key}
            title={env.key ?? "Unnamed Variable"}
            detail={
              <List.Item.Detail
                markdown={env.value ?? env.real_value ?? ""}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label
                      title="Build Variable"
                      icon={env.is_build_time ? Icon.Check : Icon.Xmark}
                    />
                    <List.Item.Detail.Metadata.Label title="Literal" icon={env.is_literal ? Icon.Check : Icon.Xmark} />
                    <List.Item.Detail.Metadata.Label
                      title="Multiline"
                      icon={env.is_multiline ? Icon.Check : Icon.Xmark}
                    />
                  </List.Item.Detail.Metadata>
                }
              />
            }
          />
        ))}
      </List.Section>
      {!isLoading && envs.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No environment variables found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}
