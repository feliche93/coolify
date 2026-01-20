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

function statusColor(status?: string) {
  const value = status?.toLowerCase() ?? "";
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
    async () => requestJson<Deployment[]>(`/deployments/applications/${applicationUuid}`, { baseUrl, token }),
    [applicationUuid],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search deployments...">
      <List.Section title={`${applicationName} / Deployments`} subtitle={`${deployments.length} deployments`}>
        {deployments.map((deployment) => {
          const createdAt = deployment.created_at;
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
      {!isLoading && deployments.length === 0 ? (
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
