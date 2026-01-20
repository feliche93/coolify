import {
  Action,
  ActionPanel,
  Alert,
  Form,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, useCachedPromise, useForm } from "@raycast/utils";
import { useState } from "react";
import { requestJson } from "../api/client";

export type EnvironmentVariable = {
  uuid?: string;
  is_build_time?: boolean;
  is_literal?: boolean;
  is_multiline?: boolean;
  is_preview?: boolean;
  is_really_required?: boolean;
  is_required?: boolean;
  is_shared?: boolean;
  is_shown_once?: boolean;
  key?: string;
  order?: number | null;
  real_value?: string;
  value?: string | null;
  version?: string;
  created_at?: string;
  updated_at?: string;
};

export type EnvVarResource = {
  type: "application" | "service";
  uuid: string;
  name: string;
};

type EnvVarFormValues = {
  key: string;
  value: string;
  is_preview: boolean;
  is_build_time: boolean;
  is_literal: boolean;
  is_multiline: boolean;
  is_shown_once: boolean;
};

type BulkEnvVarValues = {
  payload: string;
};

function resourceTypeToEndpoint(type: EnvVarResource["type"]) {
  return type === "application" ? "applications" : "services";
}

function envVarsPath(resource: EnvVarResource) {
  return `/${resourceTypeToEndpoint(resource.type)}/${resource.uuid}/envs`;
}

export default function EnvironmentVariablesList({
  baseUrl,
  token,
  resource,
}: {
  baseUrl: string;
  token: string;
  resource: EnvVarResource;
}) {
  const endpoint = envVarsPath(resource);
  const {
    isLoading,
    data: envs = [],
    revalidate,
  } = useCachedPromise(
    async (path: string) => requestJson<EnvironmentVariable[]>(path, { baseUrl, token }),
    [endpoint],
    {
      keepPreviousData: true,
    },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search environment variable" isShowingDetail>
      <List.Section title={`${resource.name} / Environment Variables`} subtitle={`${envs.length} envs`}>
        {envs.map((env) => (
          <List.Item
            key={env.uuid ?? env.key}
            title={env.key ?? "Unnamed Variable"}
            detail={
              <List.Item.Detail
                markdown={env.value ?? env.real_value ?? ""}
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label
                      title="Build Variable"
                      icon={env.is_build_time ? Icon.Check : Icon.Xmark}
                    />
                    <List.Item.Detail.Metadata.Label title="Literal" icon={env.is_literal ? Icon.Check : Icon.Xmark} />
                    <List.Item.Detail.Metadata.Label
                      title="Multiline"
                      icon={env.is_multiline ? Icon.Check : Icon.Xmark}
                    />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action.Push
                  icon={Icon.Plus}
                  title="Create Variable"
                  target={<EnvVarForm baseUrl={baseUrl} token={token} resource={resource} onSaved={revalidate} />}
                />
                <Action.Push
                  icon={Icon.Pencil}
                  title="Edit Variable"
                  target={
                    <EnvVarForm baseUrl={baseUrl} token={token} resource={resource} env={env} onSaved={revalidate} />
                  }
                />
                <Action.Push
                  icon={Icon.Tray}
                  title="Bulk Update (JSON)"
                  target={<BulkEnvVarForm baseUrl={baseUrl} token={token} resource={resource} onSaved={revalidate} />}
                />
                <Action
                  icon={Icon.Trash}
                  title="Delete Variable"
                  style={Action.Style.Destructive}
                  onAction={async () => {
                    if (!env.uuid) return;
                    await confirmAlert({
                      title: "Delete Environment Variable?",
                      message: `Delete ${env.key ?? "this variable"}?`,
                      primaryAction: {
                        title: "Delete",
                        style: Alert.ActionStyle.Destructive,
                        async onAction() {
                          try {
                            await requestJson(`${envVarsPath(resource)}/${env.uuid}`, {
                              baseUrl,
                              token,
                              method: "DELETE",
                            });
                            await showToast({ style: Toast.Style.Success, title: "Variable deleted" });
                            await revalidate();
                          } catch (error) {
                            await showToast({
                              style: Toast.Style.Failure,
                              title: "Failed to delete variable",
                              message: error instanceof Error ? error.message : String(error),
                            });
                          }
                        },
                      },
                    });
                  }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!isLoading && envs.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No environment variables found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

function EnvVarForm({
  baseUrl,
  token,
  resource,
  env,
  onSaved,
}: {
  baseUrl: string;
  token: string;
  resource: EnvVarResource;
  env?: EnvironmentVariable;
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = Boolean(env?.key);

  const { itemProps, handleSubmit, values } = useForm<EnvVarFormValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        await requestJson(envVarsPath(resource), {
          baseUrl,
          token,
          method: isEdit ? "PATCH" : "POST",
          body: {
            key: values.key,
            value: values.value,
            is_preview: values.is_preview,
            is_build_time: values.is_build_time,
            is_literal: values.is_literal,
            is_multiline: values.is_multiline,
            is_shown_once: values.is_shown_once,
          },
        });
        await showToast({ style: Toast.Style.Success, title: isEdit ? "Variable updated" : "Variable created" });
        onSaved();
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to save variable",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      key: env?.key ?? "",
      value: env?.value ?? env?.real_value ?? "",
      is_preview: env?.is_preview ?? false,
      is_build_time: env?.is_build_time ?? false,
      is_literal: env?.is_literal ?? false,
      is_multiline: env?.is_multiline ?? false,
      is_shown_once: env?.is_shown_once ?? false,
    },
    validation: {
      key: FormValidation.Required,
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            icon={Icon.Check}
            title={isEdit ? "Update Variable" : "Create Variable"}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Description text={isEdit ? "Update Environment Variable" : "Create Environment Variable"} />
      <Form.TextField title="Key" placeholder="DATABASE_URL" {...itemProps.key} />
      <Form.TextField title="Value" placeholder="value" {...itemProps.value} />
      <Form.Checkbox label="Preview" {...itemProps.is_preview} />
      <Form.Checkbox label="Build Time" {...itemProps.is_build_time} />
      <Form.Checkbox label="Literal" {...itemProps.is_literal} />
      <Form.Checkbox label="Multiline" {...itemProps.is_multiline} />
      <Form.Checkbox label="Shown Once" {...itemProps.is_shown_once} />
    </Form>
  );
}

function BulkEnvVarForm({
  baseUrl,
  token,
  resource,
  onSaved,
}: {
  baseUrl: string;
  token: string;
  resource: EnvVarResource;
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { itemProps, handleSubmit, values } = useForm<BulkEnvVarValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        const parsed = JSON.parse(values.payload || "[]");
        await requestJson(`${envVarsPath(resource)}/bulk`, {
          baseUrl,
          token,
          method: "PATCH",
          body: { data: parsed },
        });
        await showToast({ style: Toast.Style.Success, title: "Variables updated" });
        onSaved();
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to update variables",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      payload: "[]",
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title="Bulk Update" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Paste a JSON array of environment variables." />
      <Form.TextArea title="Payload" {...itemProps.payload} />
    </Form>
  );
}
