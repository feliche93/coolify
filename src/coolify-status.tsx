import { Action, ActionPanel, Detail, Icon, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { Preferences, normalizeBaseUrl, requestJson } from "./api/client";
import WithValidToken from "./pages/with-valid-token";

type Health = {
  status?: string;
  message?: string;
};

type Version = {
  version?: string;
};

function StatusView() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const token = apiToken?.trim() ?? "";

  const { isLoading: isLoadingHealth, data: health } = useCachedPromise(
    async () => requestJson<Health>("/health", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );
  const { isLoading: isLoadingVersion, data: version } = useCachedPromise(
    async () => requestJson<Version>("/version", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  const markdown = [
    "# Coolify Status",
    "",
    `- **Health**: ${health?.status ?? health?.message ?? "unknown"}`,
    `- **Version**: ${version?.version ?? "unknown"}`,
  ].join("\n");

  return (
    <Detail
      isLoading={isLoadingHealth || isLoadingVersion}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            title="Enable API"
            icon={Icon.Power}
            onAction={async () => {
              try {
                await requestJson("/enable", { baseUrl, token });
                await showToast({ style: Toast.Style.Success, title: "API enabled" });
              } catch (error) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to enable API",
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            }}
          />
          <Action
            title="Disable API"
            icon={Icon.Power}
            style={Action.Style.Destructive}
            onAction={async () => {
              try {
                await requestJson("/disable", { baseUrl, token });
                await showToast({ style: Toast.Style.Success, title: "API disabled" });
              } catch (error) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to disable API",
                  message: error instanceof Error ? error.message : String(error),
                });
              }
            }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <StatusView />
    </WithValidToken>
  );
}
