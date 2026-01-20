import { Action, ActionPanel, Form, Icon, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState } from "react";
import { Preferences, normalizeBaseUrl, requestJson } from "./api/client";
import WithValidToken from "./pages/with-valid-token";

type FormValues = {
  type: string;
  payload: string;
};

const APPLICATION_TYPES = [
  { title: "Public Repository", value: "public" },
  { title: "Private Deploy Key", value: "private-deploy-key" },
  { title: "Private GitHub App", value: "private-github-app" },
  { title: "Dockerfile", value: "dockerfile" },
  { title: "Docker Image", value: "dockerimage" },
  { title: "Docker Compose", value: "dockercompose" },
];

function CreateApplicationForm() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const token = apiToken?.trim() ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { itemProps, handleSubmit, values } = useForm<FormValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        const body = JSON.parse(values.payload || "{}");
        await requestJson(`/applications/${values.type}`, { baseUrl, token, method: "POST", body });
        await showToast({ style: Toast.Style.Success, title: "Application created" });
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to create application",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      type: APPLICATION_TYPES[0].value,
      payload: "{}",
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title="Create Application" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Create an application using the Coolify API. Paste the JSON payload from the API docs." />
      <Form.Dropdown title="Type" {...itemProps.type}>
        {APPLICATION_TYPES.map((item) => (
          <Form.Dropdown.Item key={item.value} title={item.title} value={item.value} />
        ))}
      </Form.Dropdown>
      <Form.TextArea title="Payload (JSON)" {...itemProps.payload} />
    </Form>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <CreateApplicationForm />
    </WithValidToken>
  );
}
