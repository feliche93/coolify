import { Action, ActionPanel, Form, Icon, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState } from "react";
import { Preferences, normalizeBaseUrl, requestJson } from "./api/client";
import WithValidToken from "./pages/with-valid-token";

type FormValues = {
  type: string;
  payload: string;
};

const DATABASE_TYPES = [
  { title: "PostgreSQL", value: "postgresql" },
  { title: "MySQL", value: "mysql" },
  { title: "MariaDB", value: "mariadb" },
  { title: "MongoDB", value: "mongodb" },
  { title: "Redis", value: "redis" },
  { title: "KeyDB", value: "keydb" },
  { title: "DragonFly", value: "dragonfly" },
  { title: "ClickHouse", value: "clickhouse" },
];

function CreateDatabaseForm() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const token = apiToken?.trim() ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { itemProps, handleSubmit, values } = useForm<FormValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        const body = JSON.parse(values.payload || "{}");
        await requestJson(`/databases/${values.type}`, { baseUrl, token, method: "POST", body });
        await showToast({ style: Toast.Style.Success, title: "Database created" });
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to create database",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      type: DATABASE_TYPES[0].value,
      payload: "{}",
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title="Create Database" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Create a database using the Coolify API. Paste the JSON payload from the API docs." />
      <Form.Dropdown title="Type" {...itemProps.type}>
        {DATABASE_TYPES.map((item) => (
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
      <CreateDatabaseForm />
    </WithValidToken>
  );
}
