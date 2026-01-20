import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { Preferences, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import WithValidToken from "./pages/with-valid-token";

type PrivateKey = {
  id?: number;
  uuid?: string;
  name?: string;
  description?: string;
  private_key?: string;
  public_key?: string;
  fingerprint?: string | null;
};

function PrivateKeysList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [isShowingDetail, setIsShowingDetail] = useState(false);

  const { data: keys = [], isLoading } = useCachedPromise(
    async () => requestJson<PrivateKey[]>("/security/keys", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Private Keys..." isShowingDetail={isShowingDetail}>
      <List.Section title="Private Keys" subtitle={`${keys.length} keys`}>
        {keys.map((key) => (
          <List.Item
            key={String(key.id ?? key.uuid ?? key.name)}
            icon={Icon.Key}
            title={key.name ?? "Unnamed Key"}
            subtitle={isShowingDetail ? undefined : (key.description ?? "")}
            detail={<List.Item.Detail markdown={key.private_key ?? "No private key value"} />}
            actions={
              <ActionPanel>
                <Action
                  icon={Icon.AppWindowSidebarLeft}
                  title="Toggle Private Key"
                  onAction={() => setIsShowingDetail((prev) => !prev)}
                />
                {key.private_key ? <Action.CopyToClipboard title="Copy Private Key" content={key.private_key} /> : null}
                {key.public_key ? <Action.CopyToClipboard title="Copy Public Key" content={key.public_key} /> : null}
                {key.id ? (
                  <Action.OpenInBrowser
                    title="Open in Coolify"
                    url={`${instanceUrl}/private-key/${key.id}`}
                    icon={Icon.Globe}
                  />
                ) : null}
                <ActionPanel.Section>
                  {key.uuid ? <Action.CopyToClipboard title="Copy Key UUID" content={key.uuid} /> : null}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!isLoading && keys.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No private keys found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <PrivateKeysList />
    </WithValidToken>
  );
}
