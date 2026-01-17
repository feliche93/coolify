import { Action, ActionPanel, Detail, Icon, openExtensionPreferences } from "@raycast/api";

export default function InvalidTokenView() {
  return (
    <Detail
      markdown={`# ERROR\n\nInvalid API token. Please set one in the extension settings.`}
      actions={
        <ActionPanel>
          <Action icon={Icon.Gear} title="Open Extension Preferences" onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
}
