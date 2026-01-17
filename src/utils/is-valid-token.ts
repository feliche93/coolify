import { getPreferenceValues } from "@raycast/api";
import { Preferences, normalizeBaseUrl, requestJson } from "../api/client";

export default async function isValidToken(): Promise<boolean> {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const token = apiToken?.trim() ?? "";
  if (!token) {
    throw new Error("Missing API token");
  }

  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  await requestJson("/projects", { baseUrl, token });
  return true;
}
