import { List } from "@raycast/api";

export type ResourceDetailInfo = {
  title: string;
  type: string;
  status?: string;
  description?: string;
  projectName?: string;
  environmentName?: string;
  kind?: string;
  branch?: string;
  uuid?: string;
  url?: string;
  coolifyUrl?: string;
  environmentUrl?: string;
  repoUrl?: string;
};

function formatStatus(value?: string) {
  if (!value) return undefined;
  const normalized = value.replace(/_/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function addLine(lines: string[], label: string, value?: string) {
  if (!value) return;
  lines.push(`- **${label}**: ${value}`);
}

export function buildResourceDetailMarkdown(info: ResourceDetailInfo) {
  const lines: string[] = [`# ${info.title}`];
  if (info.description) {
    lines.push("");
    lines.push(`> ${info.description}`);
  }

  lines.push("");
  lines.push("## Overview");
  addLine(lines, "Type", info.type);
  addLine(lines, "Status", formatStatus(info.status));
  addLine(lines, "Project", info.projectName);
  addLine(lines, "Environment", info.environmentName);
  addLine(lines, "Kind", info.kind);
  addLine(lines, "Branch", info.branch);
  addLine(lines, "UUID", info.uuid);

  const links: string[] = [];
  if (info.url) links.push(`- [Open URL](${info.url})`);
  if (info.coolifyUrl) links.push(`- [Open in Coolify](${info.coolifyUrl})`);
  if (info.environmentUrl) links.push(`- [Environment in Coolify](${info.environmentUrl})`);
  if (info.repoUrl) links.push(`- [Repository](${info.repoUrl})`);

  if (links.length > 0) {
    lines.push("");
    lines.push("## Links");
    lines.push(...links);
  }

  return lines.join("\n");
}

export function ResourceDetails({ info }: { info: ResourceDetailInfo }) {
  return <List.Item.Detail markdown={buildResourceDetailMarkdown(info)} />;
}
