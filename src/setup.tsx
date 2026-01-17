import {
  Action,
  ActionPanel,
  Detail,
  Icon,
  Toast,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { DEFAULT_BASE_URL, getInstanceUrl, normalizeBaseUrl } from "./api/client";

type Preferences = {
  apiUrl?: string;
  apiToken?: string;
};

function getSetupMarkdown(baseUrl: string, hasToken: boolean): string {
  const statusLine = hasToken
    ? "✅ **API Token** is set."
    : "❌ **API Token** is missing. Add one in Extension Preferences.";

  return `![Coolify](coolify-logo.png?raycast-width=96&raycast-height=96)\n\n# Coolify Setup\n\n${statusLine}\n\n## How to create a token\n1. Open Coolify.\n2. Go to **Keys & Tokens → API tokens**.\n3. Create a token with the permissions you need.\n4. Paste it into **Raycast → Extensions → Coolify → API Token**.\n\n**Permissions guidance**\n- Start with **read-only** for viewing resources.\n- Add **read:sensitive** if you need access to sensitive fields.\n- Add **view:sensitive** if you need to unredact secrets.\n- Use **\\*** only if you need full administrative access.\n\nNote: Tokens are scoped to the current team and shown only once on creation.\n\n## Base URL\n- **Coolify Cloud:** ${DEFAULT_BASE_URL}\n- **Self-hosted:** https://<your-instance>/api/v1\n\n**Current Base URL**\n\n\`\`\`\n${baseUrl}\n\`\`\`\n\nTip: for self-hosted, set the URL without extra paths (this command will append /api/v1).\n`;
}

export default function Command() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const hasToken = Boolean(apiToken && apiToken.trim().length > 0);
  const authHeaderTemplate = "Authorization: Bearer <YOUR_API_TOKEN>";
  const docsUrl = "https://coolify.io/docs/api-reference/authorization";

  async function testConnection() {
    if (!hasToken) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Missing API token",
        message: "Set your token in Extension Preferences.",
      });
      return;
    }

    await showToast({ style: Toast.Style.Animated, title: "Testing connection..." });

    try {
      const response = await fetch(`${baseUrl}/teams/current/members`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const members = (await response.json()) as unknown[];
      await showToast({
        style: Toast.Style.Success,
        title: "Connected",
        message: `Authenticated. Team members: ${members.length}`,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Connection failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <Detail
      markdown={getSetupMarkdown(baseUrl, hasToken)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="API Token" text={hasToken ? "Set" : "Missing"} />
          <Detail.Metadata.Label title="Base URL" text={baseUrl} />
          <Detail.Metadata.Label title="Instance URL" text={instanceUrl} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action title="Test Connection" icon={Icon.Check} onAction={testConnection} />
          <Action.OpenInBrowser title="Open Coolify Instance" url={instanceUrl} />
          <Action.OpenInBrowser title="Open API Token Docs" url={docsUrl} />
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          <Action.CopyToClipboard title="Copy Base URL" content={baseUrl} />
          <Action.CopyToClipboard title="Copy Authorization Header Template" content={authHeaderTemplate} />
        </ActionPanel>
      }
    />
  );
}
