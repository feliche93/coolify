import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { useState } from "react";
import { requestJson } from "../../api/client";

type CreateProjectValues = {
  name?: string;
  description?: string;
};

export default function CreateProjectForm({
  baseUrl,
  token,
  onAdded,
}: {
  baseUrl: string;
  token: string;
  onAdded: () => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { itemProps, handleSubmit, values } = useForm<CreateProjectValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        await requestJson("/projects", { baseUrl, token, method: "POST", body: values });
        onAdded();
        pop();
      } finally {
        setIsSubmitting(false);
      }
    },
    validation: {
      name: FormValidation.Required,
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title="Create Project" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Create Project" />
      <Form.TextField title="Name" placeholder="Your Cool Project" {...itemProps.name} />
      <Form.TextField title="Description" placeholder="Optional description" {...itemProps.description} />
      <Form.Description text="New projects start with a default production environment." />
    </Form>
  );
}
