import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { Preferences, getInstanceUrl, normalizeBaseUrl, requestJson } from "./api/client";
import JsonDetail from "./components/json-detail";
import WithValidToken from "./pages/with-valid-token";

type Team = {
  id?: number;
  name?: string;
  description?: string | null;
};

type TeamMember = {
  id?: number;
  name?: string;
  email?: string;
};

function TeamMembersList({ baseUrl, token, team }: { baseUrl: string; token: string; team: Team }) {
  const { data: members = [], isLoading } = useCachedPromise(
    async () => {
      if (!team.id) return [];
      return requestJson<TeamMember[]>(`/teams/${team.id}/members`, { baseUrl, token });
    },
    [],
    { keepPreviousData: true },
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search members">
      <List.Section title={`${team.name ?? "Team"} / Members`} subtitle={`${members.length} members`}>
        {members.map((member) => (
          <List.Item
            key={String(member.id ?? member.email ?? member.name)}
            icon={Icon.Person}
            title={member.name ?? "Unnamed Member"}
            subtitle={member.email}
            actions={
              <ActionPanel>
                {member.email ? <Action.CopyToClipboard title="Copy Email" content={member.email} /> : null}
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!isLoading && members.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No members found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

function TeamsList() {
  const { apiUrl, apiToken } = getPreferenceValues<Preferences>();
  const baseUrl = normalizeBaseUrl(apiUrl ?? "");
  const instanceUrl = getInstanceUrl(baseUrl);
  const token = apiToken?.trim() ?? "";
  const [searchText, setSearchText] = useState("");

  const { data: teams = [], isLoading } = useCachedPromise(
    async () => requestJson<Team[]>("/teams", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );
  const { data: currentTeam } = useCachedPromise(
    async () => requestJson<Team>("/teams/current", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );
  const { data: currentMembers = [] } = useCachedPromise(
    async () => requestJson<TeamMember[]>("/teams/current/members", { baseUrl, token }),
    [],
    { keepPreviousData: true },
  );

  const filteredTeams = teams.filter((team) => {
    const lower = searchText.trim().toLowerCase();
    if (!lower) return true;
    const haystack = [team.name, team.description].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(lower);
  });

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Teams..." onSearchTextChange={setSearchText} throttle>
      {currentTeam ? (
        <List.Section title="Current Team">
          <List.Item
            key={`current-${currentTeam.id ?? currentTeam.name}`}
            icon={Icon.Person}
            title={currentTeam.name ?? "Current Team"}
            subtitle={currentTeam.description ?? ""}
            accessories={[{ text: `${currentMembers.length} members` }]}
            actions={
              <ActionPanel>
                <Action.Push
                  icon={Icon.Person}
                  title="View Members"
                  target={<TeamMembersList baseUrl={baseUrl} token={token} team={currentTeam} />}
                />
                {currentTeam.id ? (
                  <Action.Push
                    title="View Team JSON"
                    icon={Icon.Code}
                    target={
                      <JsonDetail
                        title="Team Details"
                        baseUrl={baseUrl}
                        token={token}
                        path={`/teams/${currentTeam.id}`}
                      />
                    }
                  />
                ) : null}
              </ActionPanel>
            }
          />
        </List.Section>
      ) : null}
      <List.Section title="Teams" subtitle={`${filteredTeams.length} teams`}>
        {filteredTeams.map((team) => (
          <List.Item
            key={String(team.id ?? team.name)}
            icon={Icon.TwoPeople}
            title={team.name ?? "Unnamed Team"}
            subtitle={team.description ?? ""}
            actions={
              <ActionPanel>
                {team.id ? (
                  <Action.Push
                    icon={Icon.Person}
                    title="View Members"
                    target={<TeamMembersList baseUrl={baseUrl} token={token} team={team} />}
                  />
                ) : null}
                {team.id ? (
                  <Action.Push
                    title="View Team JSON"
                    icon={Icon.Code}
                    target={
                      <JsonDetail title="Team Details" baseUrl={baseUrl} token={token} path={`/teams/${team.id}`} />
                    }
                  />
                ) : null}
                {team.id ? (
                  <Action.OpenInBrowser
                    title="Open Team in Coolify"
                    url={`${instanceUrl}/team/${team.id}`}
                    icon={Icon.Globe}
                  />
                ) : null}
                <ActionPanel.Section>
                  {team.id ? <Action.CopyToClipboard title="Copy Team ID" content={String(team.id)} /> : null}
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!isLoading && filteredTeams.length === 0 ? (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="No teams found"
          description="Check API token and permissions."
        />
      ) : null}
    </List>
  );
}

export default function Command() {
  return (
    <WithValidToken>
      <TeamsList />
    </WithValidToken>
  );
}
