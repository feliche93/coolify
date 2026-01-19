import { Action, ActionPanel, Icon, Toast, showToast } from "@raycast/api";
import { requestJson } from "../api/client";

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

export function RedeploySubmenu({
  baseUrl,
  token,
  uuid,
  title = "Redeploy",
}: {
  baseUrl: string;
  token: string;
  uuid: string;
  title?: string;
}) {
  return (
    <ActionPanel.Submenu title={title} icon={Icon.ArrowClockwise}>
      <Action
        title="Redeploy"
        onAction={async () => {
          try {
            await deployByUuid({ baseUrl, token, uuid });
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
            await deployByUuid({ baseUrl, token, uuid, force: true });
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
  );
}
