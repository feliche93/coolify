import { Action, ActionPanel, Detail, Icon, getPreferenceValues, openExtensionPreferences } from "@raycast/api";

type Preferences = {
  apiUrl?: string;
  apiToken?: string;
};

const DEFAULT_BASE_URL = "https://app.coolify.io/api/v1";

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

function getSetupMarkdown(baseUrl: string, hasToken: boolean): string {
  const statusLine = hasToken
    ? "✅ **API Token** is set."
    : "❌ **API Token** is missing. Add one in Extension Preferences.";

  return `# Coolify Setup\n\n${statusLine}\n\n## How to create a token\n1. Open Coolify.\n2. Go to **Keys & Tokens → API tokens**.\n3. Create a token with the permissions you need.\n4. Paste it into **Raycast → Extensions → Coolify → API Token**.\n\n**Permissions guidance**\n- Start with **read** for viewing resources.\n- Add **read:sensitive** only if you need access to sensitive fields.\n- Add **write** or **deploy** only if you will modify resources or trigger deployments.\n- Use **root** only if you need full administrative access.\n\nNote: Tokens are scoped to the current team.\n\n## Base URL\n- **Coolify Cloud:** ${DEFAULT_BASE_URL}\n- **Self-hosted:** https://<your-instance>/api/v1\n\n**Current Base URL**\n\n\`\`\`\n${baseUrl}\n\`\`\`\n\nTip: for self-hosted, set the URL without extra paths (this command will append /api/v1).\n`;
}

export default function Command() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const hasToken = Boolean(apiToken && apiToken.trim().length > 0);

  return (
    <Detail
      markdown={getSetupMarkdown(baseUrl, hasToken)}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          <Action.CopyToClipboard title="Copy Base URL" content={baseUrl} />
        </ActionPanel>
      }
    />
  );
}
