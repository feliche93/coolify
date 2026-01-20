import { Detail } from "@raycast/api";
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

  const markdown = `# ${title}\n\n\`\`\`json\n${JSON.stringify(data ?? {}, null, 2)}\n\`\`\``;

  return <Detail isLoading={isLoading} markdown={markdown} />;
}
