import {
  Action,
  ActionPanel,
  Color,
  Form,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  getPreferenceValues,
  useNavigation,
} from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { useCachedPromise } from "@raycast/utils";
import { useMemo, useState } from "react";
import { Preferences, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import JsonDetail from "./components/json-detail";
import WithValidToken from "./pages/with-valid-token";

type Server = {
  uuid?: string;
  description?: string | null;
  name?: string;
  ip?: string;
  is_reachable?: boolean;
  is_usable?: boolean;
  user?: string;
  port?: string;
};

type PrivateKey = {
  id?: number;
  uuid?: string;
  name?: string;
};

type CreateServerValues = {
  name?: string;
  description?: string;
  ip?: string;
  port?: string;
  user?: string;
  private_key_uuid?: string;
  is_build_server?: boolean;
  instant_validate?: boolean;
};

type ServerResource = {
  uuid?: string;
  name?: string;
  type?: string;
  status?: string;
  created_at?: string;
};

type ServerDomainEntry = {
  ip?: string;
  domains?: string[];
};

function serverColor(server: Server) {
  if (server.is_reachable && server.is_usable) return Color.Green;
  if (server.is_reachable || server.is_usable) return Color.Yellow;
  return Color.Red;
}

function resourceStatusColor(status?: string) {
  if (!status) return Color.SecondaryText;
  return status.startsWith("running:") ? Color.Green : Color.Red;
}

function ServerDetailsView({ baseUrl, token, server }: { baseUrl: string; token: string; server: Server }) {
  return (
    <JsonDetail title={server.name ?? "Server"} baseUrl={baseUrl} token={token} path={`/servers/${server.uuid}`} />
  );
}

function ServerResourcesView({ baseUrl, token, server }: { baseUrl: string; token: string; server: Server }) {
  const { isLoading, data: resources = [] } = useCachedPromise(
    async (uuid?: string) => {
      if (!uuid) return [];
      return requestJson<ServerResource[]>(`/servers/${uuid}/resources`, { baseUrl, token });
    },
    [server.uuid],
    { keepPreviousData: true },
  );

  const filteredResources = useMemo(() => resources ?? [], [resources]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search resources...">
      <List.Section title={`${server.name ?? "Server"} / Resources`} subtitle={`${filteredResources.length} resources`}>
        {filteredResources.map((resource) => {
          const status = resource.status ?? "";
          const statusParts = status.split(":");
          const statusLabel = statusParts[0] ? statusParts[0].replace(/_/g, " ") : "unknown";
          const healthy = statusParts[1] === "healthy";

          const accessories: List.Item.Accessory[] = [
            {
              tag: {
                value: statusLabel,
                color: resourceStatusColor(status),
              },
            },
            resource.created_at
              ? { date: new Date(resource.created_at), tooltip: `Created: ${resource.created_at}` }
              : null,
          ].filter(Boolean) as List.Item.Accessory[];

          if (status && statusLabel !== "exited" && !healthy) {
            accessories.unshift({
              icon: { source: Icon.Warning, tintColor: Color.Yellow },
              tooltip: "Unhealthy state.",
            });
          }

          return (
            <List.Item
              key={String(resource.uuid ?? resource.name)}
              icon={{ source: Icon.CircleFilled, tintColor: resourceStatusColor(status) }}
              title={resource.name ?? "Unnamed Resource"}
              subtitle={resource.type}
              accessories={accessories}
            />
          );
        })}
      </List.Section>
      {!isLoading && filteredResources.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No resources found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

function ServerDomainsView({ baseUrl, token, server }: { baseUrl: string; token: string; server: Server }) {
  const { isLoading, data: domains = [] } = useCachedPromise(
    async (uuid?: string) => {
      if (!uuid) return [];
      return requestJson<ServerDomainEntry[]>(`/servers/${uuid}/domains`, { baseUrl, token });
    },
    [server.uuid],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search domains...">
      <List.Section title={`${server.name ?? "Server"} / Domains`} subtitle={`${domains.length} entries`}>
        {domains.flatMap((entry) =>
          (entry.domains ?? []).map((domain) => (
            <List.Item
              key={`${entry.ip ?? ""}-${domain}`}
              icon={Icon.Globe}
              title={domain}
              subtitle={entry.ip}
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser title="Open Domain" url={`https://${domain}`} icon={Icon.Link} />
                </ActionPanel>
              }
            />
          )),
        )}
      </List.Section>
      {!isLoading && domains.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No domains found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

function CreateServerForm({ baseUrl, token, onAdded }: { baseUrl: string; token: string; onAdded: () => void }) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: keys = [], isLoading: isLoadingKeys } = useCachedPromise(
    async () => requestJson<PrivateKey[]>("/security/keys", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  const { itemProps, handleSubmit, values } = useForm<CreateServerValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        await requestJson("/servers", { baseUrl, token, method: "POST", body: values });
        await showToast({ style: Toast.Style.Success, title: "Server added" });
        onAdded();
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to add server",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      port: "22",
      is_build_server: false,
      instant_validate: false,
    },
    validation: {
      name: FormValidation.Required,
      ip: FormValidation.Required,
      port(value) {
        if (!value) return "The port is required";
        if (!Number(value)) return "Port must be a number";
      },
      user: FormValidation.Required,
      private_key_uuid: FormValidation.Required,
    },
  });

  return (
    <Form
      isLoading={isLoadingKeys || isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title="Create Server" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Create Server" />
      <Form.TextField title="Name" placeholder="coolify-node-1" {...itemProps.name} />
      <Form.TextField title="Description" placeholder="Production node" {...itemProps.description} />
      <Form.TextField
        title="IP Address / Domain"
        placeholder="example.com"
        info="An IP address (127.0.0.1) or domain (example.com)"
        {...itemProps.ip}
      />
      <Form.TextField title="Port" placeholder="22" {...itemProps.port} />
      <Form.TextField title="User" placeholder="root" {...itemProps.user} />
      <Form.Dropdown title="Private Key" {...itemProps.private_key_uuid}>
        {keys.map((key) => (
          <Form.Dropdown.Item key={String(key.id ?? key.uuid)} title={key.name ?? "Key"} value={String(key.uuid)} />
        ))}
      </Form.Dropdown>
      <Form.Checkbox label="Use as build server" {...itemProps.is_build_server} />
      <Form.Checkbox label="Validate immediately" {...itemProps.instant_validate} />
    </Form>
  );
}

function ServersList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [searchText, setSearchText] = useState("");

  const {
    data: servers = [],
    isLoading,
    revalidate,
  } = useCachedPromise(async () => requestJson<Server[]>("/servers", { baseUrl, token }), [], {
    keepPreviousData: true,
  });

  const filteredServers = servers.filter((server) => {
    const lower = searchText.trim().toLowerCase();
    if (!lower) return true;
    const haystack = [server.name, server.description, server.ip, server.user].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(lower);
  });

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Servers..." onSearchTextChange={setSearchText} throttle>
      {!isLoading && filteredServers.length === 0 ? (
        <List.EmptyView
          title="No servers found"
          description="Create a server in Coolify first."
          actions={
            <ActionPanel>
              <Action.Push
                icon={Icon.Plus}
                title="Add Server"
                target={<CreateServerForm baseUrl={baseUrl} token={token} onAdded={revalidate} />}
              />
            </ActionPanel>
          }
        />
      ) : (
        <List.Section title="Servers" subtitle={`${filteredServers.length} servers`}>
          {filteredServers.map((server) => (
            <List.Item
              key={String(server.uuid ?? server.name)}
              icon={{ source: Icon.HardDrive, tintColor: serverColor(server) }}
              title={server.name ?? "Unnamed Server"}
              subtitle={server.description ?? ""}
              accessories={[server.ip ? { text: server.ip } : null].filter(Boolean) as List.Item.Accessory[]}
              actions={
                <ActionPanel>
                  <Action.Push
                    icon={Icon.Eye}
                    title="View Details"
                    target={<ServerDetailsView baseUrl={baseUrl} token={token} server={server} />}
                  />
                  <Action.Push
                    icon={Icon.CircleFilled}
                    title="View Resources"
                    target={<ServerResourcesView baseUrl={baseUrl} token={token} server={server} />}
                  />
                  <Action.Push
                    icon={Icon.Globe}
                    title="View Domains"
                    target={<ServerDomainsView baseUrl={baseUrl} token={token} server={server} />}
                  />
                  <Action.Push
                    icon={Icon.Plus}
                    title="Add Server"
                    target={<CreateServerForm baseUrl={baseUrl} token={token} onAdded={revalidate} />}
                    shortcut={Keyboard.Shortcut.Common.New}
                  />
                  {server.uuid ? (
                    <Action
                      icon={Icon.CheckCircle}
                      title="Validate Server"
                      onAction={async () => {
                        try {
                          await requestJson(`/servers/${server.uuid}/validate`, { baseUrl, token });
                          await showToast({ style: Toast.Style.Success, title: "Validation started" });
                        } catch (error) {
                          await showToast({
                            style: Toast.Style.Failure,
                            title: "Failed to validate",
                            message: error instanceof Error ? error.message : String(error),
                          });
                        }
                      }}
                    />
                  ) : null}
                  {server.uuid ? (
                    <Action.OpenInBrowser
                      title="Open in Coolify"
                      url={`${instanceUrl}/server/${server.uuid}`}
                      icon={Icon.Globe}
                    />
                  ) : null}
                  <ActionPanel.Section>
                    {server.ip ? <Action.CopyToClipboard title="Copy IP" content={server.ip} /> : null}
                    {server.uuid ? <Action.CopyToClipboard title="Copy Server UUID" content={server.uuid} /> : null}
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <ServersList />
    </WithValidToken>
  );
}
