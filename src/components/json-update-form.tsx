import { Action, ActionPanel, Form, Icon, Toast, showToast, useNavigation } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { useState } from "react";
import { requestJson } from "../api/client";

export default function JsonUpdateForm({
  baseUrl,
  token,
  path,
  title,
}: {
  baseUrl: string;
  token: string;
  path: string;
  title: string;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { itemProps, handleSubmit } = useForm({
    onSubmit: async (values) => {
      setIsSubmitting(true);
      try {
        const body = JSON.parse(values.payload || "{}");
        await requestJson(path, { baseUrl, token, method: "PATCH", body });
        await showToast({ style: Toast.Style.Success, title: "Updated" });
        pop();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Update failed",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    initialValues: {
      payload: "{}",
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title={`Update ${title}`} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text={`Update ${title} with a JSON payload.`} />
      <Form.TextArea title="Payload (JSON)" {...itemProps.payload} />
    </Form>
  );
}
