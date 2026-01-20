import { getPreferenceValues } from "@raycast/api";
import { Preferences, normalizeBaseUrl } from "./api/client";
import JsonDetail from "./components/json-detail";
import WithValidToken from "./pages/with-valid-token";

function ResourcesApiView() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const token = apiToken?.trim() ?? "";

  return <JsonDetail title="Resources (API)" baseUrl={baseUrl} token={token} path="/resources" />;
}

export default function Command() {
  return (
    <WithValidToken>
      <ResourcesApiView />
    </WithValidToken>
  );
}
