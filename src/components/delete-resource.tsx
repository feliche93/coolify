import { Action, ActionPanel, Form, Icon, showToast, Toast, useNavigation } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState } from "react";
import { requestJson } from "../api/client";

type DeleteResourceValues = {
  delete_volumes: boolean;
  delete_connected_networks: boolean;
  delete_configurations: boolean;
  docker_cleanup: boolean;
};

export default function DeleteResourceForm({
  baseUrl,
  token,
  resourceType,
  uuid,
  onDeleted,
}: {
  baseUrl: string;
  token: string;
  resourceType: string;
  uuid: string;
  onDeleted?: () => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { handleSubmit, itemProps, values } = useForm<DeleteResourceValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      const params = new URLSearchParams({
        delete_volumes: String(values.delete_volumes),
        delete_connected_networks: String(values.delete_connected_networks),
        delete_configurations: String(values.delete_configurations),
        docker_cleanup: String(values.docker_cleanup),
      });
      try {
        await requestJson(`/${resourceType}s/${uuid}?${params}`, { baseUrl, token, method: "DELETE" });
        await showToast({ style: Toast.Style.Success, title: "Resource deleted" });
        onDeleted?.();
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to delete resource",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      delete_volumes: true,
      delete_connected_networks: true,
      delete_configurations: true,
      docker_cleanup: true,
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            icon={Icon.Trash}
            title="Confirm Resource Deletion"
            onSubmit={handleSubmit}
            style={Action.Style.Destructive}
          />
        </ActionPanel>
      }
    >
      <Form.Description text="Confirm Resource Deletion?" />
      <Form.Checkbox label="Permanently delete all volumes." {...itemProps.delete_volumes} />
      <Form.Checkbox label="Permanently delete all non-predefined networks." {...itemProps.delete_connected_networks} />
      <Form.Checkbox
        label="Permanently delete all configuration files from the server."
        {...itemProps.delete_configurations}
      />
      <Form.Checkbox label="Run Docker Cleanup." {...itemProps.docker_cleanup} />
    </Form>
  );
}
