import { Detail, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { Preferences, normalizeBaseUrl, requestJson } from "./api/client";
import WithValidToken from "./pages/with-valid-token";

function ResourcesApiView() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const token = apiToken?.trim() ?? "";

  const { data, isLoading } = useCachedPromise(async () => requestJson<unknown>("/resources", { baseUrl, token }), [], {
    keepPreviousData: true,
  });

  return (
    <Detail
      isLoading={isLoading}
      markdown={`# Resources (API)\n\n\`\`\`json\n${JSON.stringify(data ?? {}, null, 2)}\n\`\`\``}
    />
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <ResourcesApiView />
    </WithValidToken>
  );
}
