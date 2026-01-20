import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";
import { useState } from "react";
import { requestJson } from "../../api/client";

type Project = {
  uuid?: string;
  name?: string;
  description?: string | null;
};

type UpdateProjectValues = {
  name?: string;
  description?: string;
};

export default function UpdateProjectForm({
  baseUrl,
  token,
  project,
  onUpdated,
}: {
  baseUrl: string;
  token: string;
  project: Project;
  onUpdated: () => void;
}) {
  const { pop } = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { itemProps, handleSubmit, values } = useForm<UpdateProjectValues>({
    onSubmit: async () => {
      setIsSubmitting(true);
      try {
        await requestJson(`/projects/${project.uuid}`, { baseUrl, token, method: "PATCH", body: values });
        onUpdated();
        pop();
      } finally {
        setIsSubmitting(false);
      }
    },
    validation: {
      name: FormValidation.Required,
    },
    initialValues: {
      name: project.name ?? "",
      description: project.description ?? "",
    },
  });

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Check} title="Update Project" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description text="Update Project" />
      <Form.TextField title="Name" placeholder="Your Cooler Project" {...itemProps.name} />
      <Form.TextField title="Description" placeholder="Optional description" {...itemProps.description} />
    </Form>
  );
}
