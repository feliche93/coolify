import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { requestJson } from "../api/client";
import fromNow from "../utils/time";
import { LogsSubmenu } from "./logs-actions";
import JsonDetail from "./json-detail";
import { RedeploySubmenu } from "./redeploy-actions";

type Deployment = {
  id?: number | string;
  deployment_uuid?: string;
  status?: string;
  application_uuid?: string;
  application_name?: string;
  deployment_url?: string;
  commit_message?: string;
  commit?: string;
  created_at?: string;
};

function normalizeList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== "object") return [];
  const record = response as Record<string, unknown>;
  if (Array.isArray(record.rows)) return record.rows as T[];
  if (Array.isArray(record.data)) return record.data as T[];
  if (Array.isArray(record.deployments)) return record.deployments as T[];
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.rows)) return nested.rows as T[];
    if (Array.isArray(nested.data)) return nested.data as T[];
  }
  return [];
}

function statusColor(status?: string) {
  const value = (status ?? "").toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
  if (!value) return Color.SecondaryText;
  if (value.includes("fail") || value.includes("error")) return Color.Red;
  if (value.includes("running") || value.includes("in_progress") || value.includes("build")) return Color.Blue;
  if (value.includes("success") || value.includes("finished")) return Color.Green;
  return Color.SecondaryText;
}

function statusIcon(status?: string) {
  return { source: Icon.CircleFilled, tintColor: statusColor(status) };
}

export default function ApplicationDeploymentsList({
  baseUrl,
  token,
  applicationUuid,
  applicationName,
  instanceUrl,
}: {
  baseUrl: string;
  token: string;
  applicationUuid: string;
  applicationName: string;
  instanceUrl: string;
}) {
  const { data: deployments = [], isLoading } = useCachedPromise(
    async (uuid: string) => {
      const response = await requestJson<unknown>(`/deployments/applications/${uuid}`, {
        baseUrl,
        token,
      });
      return normalizeList<Deployment>(response);
    },
    [applicationUuid],
    { keepPreviousData: true },
  );
  const list = normalizeList<Deployment>(deployments);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search deployments...">
      <List.Section title={`${applicationName} / Deployments`} subtitle={`${list.length} deployments`}>
        {list.map((deployment) => {
          const createdAtRaw = deployment.created_at ? new Date(deployment.created_at).getTime() : undefined;
          const createdAt = createdAtRaw && Number.isFinite(createdAtRaw) ? createdAtRaw : undefined;
          const deployUrl = deployment.deployment_url ? normalizeUrl(deployment.deployment_url) : undefined;
          return (
            <List.Item
              key={String(deployment.deployment_uuid ?? deployment.id)}
              title={deployment.commit_message ?? deployment.commit?.slice(0, 7) ?? "No commit message"}
              icon={statusIcon(deployment.status)}
              accessories={[
                {
                  text: createdAt ? fromNow(createdAt, new Date()) : "",
                  tooltip: createdAt ? new Date(createdAt).toLocaleString() : "",
                },
              ]}
              actions={
                <ActionPanel>
                  {deployUrl ? <Action.OpenInBrowser title="Open Deploy URL" url={deployUrl} icon={Icon.Link} /> : null}
                  {deployment.deployment_uuid ? (
                    <Action.Push
                      title="View Deployment JSON"
                      icon={Icon.Code}
                      target={
                        <JsonDetail
                          title="Deployment Details"
                          baseUrl={baseUrl}
                          token={token}
                          path={`/deployments/${deployment.deployment_uuid}`}
                        />
                      }
                    />
                  ) : null}
                  {applicationUuid ? <RedeploySubmenu baseUrl={baseUrl} token={token} uuid={applicationUuid} /> : null}
                  {applicationUuid ? (
                    <LogsSubmenu baseUrl={baseUrl} token={token} applicationUuid={applicationUuid} />
                  ) : null}
                  <Action.OpenInBrowser title="Open in Coolify" url={`${instanceUrl}/deployments`} icon={Icon.Globe} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
      {!isLoading && list.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No deployments found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}
