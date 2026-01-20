import { Action, ActionPanel, Clipboard, Detail, Icon, Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { requestJson } from "../api/client";

function isHttpUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildConsoleLogsUrl({
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

export function LogsSubmenu({
  baseUrl,
  token,
  applicationUuid,
  consoleLogsUrl,
}: {
  baseUrl: string;
  token: string;
  applicationUuid: string;
  consoleLogsUrl?: string;
}) {
  return (
    <ActionPanel.Submenu title="Logs" icon={Icon.Terminal}>
      {isHttpUrl(consoleLogsUrl) ? (
        <Action.OpenInBrowser title="Open Console Logs" url={consoleLogsUrl!} icon={Icon.Terminal} />
      ) : null}
      <Action
        title="Copy Logs"
        onAction={async () => {
          try {
            const logs = await fetchApplicationLogs({ baseUrl, token, applicationUuid, lines: 1000 });
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
      <Action.Push
        title="Show Last 100 Lines"
        target={<LogsDetail baseUrl={baseUrl} token={token} applicationUuid={applicationUuid} lines={100} />}
      />
      <Action.Push
        title="Show Last 500 Lines"
        target={<LogsDetail baseUrl={baseUrl} token={token} applicationUuid={applicationUuid} lines={500} />}
      />
    </ActionPanel.Submenu>
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
    async (currentBaseUrl: string, currentUuid: string, currentLines: number) =>
      fetchApplicationLogs({ baseUrl: currentBaseUrl, token, applicationUuid: currentUuid, lines: currentLines }),
    [baseUrl, applicationUuid, lines],
  );

  const content = data?.trim() ? `\`\`\`\n${data}\n\`\`\`` : "No logs returned.";

  return <Detail isLoading={isLoading} markdown={content} />;
}
