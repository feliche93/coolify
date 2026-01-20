import { Action, ActionPanel, Icon, List, Toast, confirmAlert, getPreferenceValues, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { Preferences, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import JsonDetail from "./components/json-detail";
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
                {key.uuid ? (
                  <Action.Push
                    title="View Key JSON"
                    icon={Icon.Code}
                    target={
                      <JsonDetail
                        title="Private Key Details"
                        baseUrl={baseUrl}
                        token={token}
                        path={`/security/keys/${key.uuid}`}
                      />
                    }
                  />
                ) : null}
                {key.private_key ? <Action.CopyToClipboard title="Copy Private Key" content={key.private_key} /> : null}
                {key.public_key ? <Action.CopyToClipboard title="Copy Public Key" content={key.public_key} /> : null}
                {key.uuid ? (
                  <Action
                    title="Delete Key"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={async () => {
                      await confirmAlert({
                        title: "Delete Private Key?",
                        message: "This operation cannot be undone.",
                        primaryAction: {
                          title: "Delete",
                          style: Action.Style.Destructive,
                          async onAction() {
                            try {
                              await requestJson(`/security/keys/${key.uuid}`, {
                                baseUrl,
                                token,
                                method: "DELETE",
                              });
                              await showToast({ style: Toast.Style.Success, title: "Key deleted" });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: "Failed to delete key",
                                message: error instanceof Error ? error.message : String(error),
                              });
                            }
                          },
                        },
                      });
                    }}
                  />
                ) : null}
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
