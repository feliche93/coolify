import { Action, ActionPanel, Clipboard, Detail, Icon, Toast, showToast } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { requestJson } from "../api/client";

export default function JsonDetail({
  title,
  baseUrl,
  token,
  path,
}: {
  title: string;
  baseUrl: string;
  token: string;
  path: string;
}) {
  const { data, isLoading } = useCachedPromise(
    async () => requestJson<unknown>(path, { baseUrl, token }),
    [baseUrl, path],
    { keepPreviousData: true },
  );

  const json = JSON.stringify(data ?? {}, null, 2);
  const markdown = `# ${title}\n\n\`\`\`json\n${json}\n\`\`\``;

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action
            icon={Icon.CopyClipboard}
            title="Copy JSON"
            onAction={async () => {
              await Clipboard.copy(json);
              await showToast({ style: Toast.Style.Success, title: "Copied JSON" });
            }}
          />
        </ActionPanel>
      }
    />
  );
}
