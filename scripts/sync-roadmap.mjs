#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "data", "portfolio.json");
const STATUS_JSON_PATH = path.join(ROOT, "data", "status.json");
const STATUS_MD_PATH = path.join(ROOT, "STATUS.md");
const args = new Set(process.argv.slice(2));
const mode = args.has("--sync") ? "sync" : args.has("--validate-live") ? "validate-live" : "validate";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function uniq(values) { return [...new Set(values)]; }
function priorityRank(value) {
  return ({P0:0,"P0/P1":1,P1:2,"P1/P2":3,P2:4,P3:5})[value] ?? 99;
}
function issueUrl(owner, repo, number) { return `https://github.com/${owner}/${repo}/issues/${number}`; }
function repoUrl(owner, repo) { return `https://github.com/${owner}/${repo}`; }

async function readRegistry() {
  return JSON.parse(await fs.readFile(REGISTRY_PATH, "utf8"));
}

function validateRegistry(registry) {
  const errors = [];
  if (registry.schema_version !== 1) errors.push("schema_version must be 1");
  if (!registry.owner) errors.push("owner is required");
  if (!registry.control_repository) errors.push("control_repository is required");
  if (!Array.isArray(registry.repositories) || registry.repositories.length === 0) {
    errors.push("repositories must be a non-empty array");
    return errors;
  }
  if (!Array.isArray(registry.workstreams) || registry.workstreams.length === 0) {
    errors.push("workstreams must be a non-empty array");
    return errors;
  }

  const names = registry.repositories.map((r) => r.name);
  if (uniq(names).length !== names.length) errors.push("repository names must be unique");
  if (!names.includes(registry.control_repository)) errors.push("control_repository must be registered");

  const allowedPriorities = new Set(["P0","P0/P1","P1","P1/P2","P2","P3"]);
  const allowedLifecycle = new Set(["active","blocked","transitional","research","oracle","maintenance","incubation","archive-candidate","control-plane"]);
  const nameSet = new Set(names);
  const workstreamIssues = registry.workstreams.map((w) => w.issue);
  if (uniq(workstreamIssues).length !== workstreamIssues.length) errors.push("workstream issue numbers must be unique");

  for (const workstream of registry.workstreams) {
    if (!Number.isInteger(workstream.issue) || workstream.issue <= 0) errors.push(`workstream: invalid issue ${workstream.issue}`);
    for (const key of ["priority","status","title","objective","next_gate"]) {
      if (!workstream[key] || typeof workstream[key] !== "string") errors.push(`workstream#${workstream.issue}: ${key} is required`);
    }
    if (!allowedPriorities.has(workstream.priority)) errors.push(`workstream#${workstream.issue}: unsupported priority ${workstream.priority}`);
    if (!Array.isArray(workstream.repositories)) errors.push(`workstream#${workstream.issue}: repositories must be an array`);
    for (const repoName of workstream.repositories || []) {
      if (!nameSet.has(repoName)) errors.push(`workstream#${workstream.issue}: unknown repository ${repoName}`);
    }
  }

  for (const repo of registry.repositories) {
    for (const key of ["name","priority","lifecycle","role","objective","next_gate"]) {
      if (!repo[key] || typeof repo[key] !== "string") errors.push(`${repo.name || "<unknown>"}: ${key} is required`);
    }
    if (!allowedPriorities.has(repo.priority)) errors.push(`${repo.name}: unsupported priority ${repo.priority}`);
    if (!allowedLifecycle.has(repo.lifecycle)) errors.push(`${repo.name}: unsupported lifecycle ${repo.lifecycle}`);
    for (const key of ["roadmap_issues","local_epics","canonical_for","depends_on","tracked_issues"]) {
      if (!Array.isArray(repo[key])) errors.push(`${repo.name}: ${key} must be an array`);
    }
    for (const dep of repo.depends_on || []) {
      if (!nameSet.has(dep)) errors.push(`${repo.name}: unknown dependency ${dep}`);
      if (dep === repo.name) errors.push(`${repo.name}: self-dependency is not allowed`);
    }
    for (const number of [...(repo.roadmap_issues || []), ...(repo.local_epics || []), ...(repo.tracked_issues || [])]) {
      if (!Number.isInteger(number) || number <= 0) errors.push(`${repo.name}: invalid issue number ${number}`);
    }
  }
  return errors;
}

function apiHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "netkeep80-roadmap-control-plane"
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function github(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, {headers: apiHeaders()});
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} ${pathname}: ${body.slice(0,400)}`);
  }
  return response.json();
}

async function openPullRequestCount(owner, repo) {
  let total = 0;
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`);
    total += batch.length;
    if (batch.length < 100) return total;
  }
}

async function fetchTrackedIssues(owner, repo, numbers) {
  const results = [];
  for (const number of numbers) {
    try {
      const item = await github(`/repos/${owner}/${repo}/issues/${number}`);
      results.push({
        number,
        title:item.title,
        state:item.state,
        state_reason:item.state_reason ?? null,
        updated_at:item.updated_at,
        html_url:item.html_url,
        is_pull_request:Boolean(item.pull_request)
      });
    } catch (error) {
      results.push({number,title:null,state:"missing",state_reason:null,updated_at:null,html_url:issueUrl(owner,repo,number),is_pull_request:false,error:String(error.message || error)});
    }
  }
  return results;
}

async function listPublicOwnerRepos(owner) {
  const repos = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/users/${owner}/repos?type=owner&per_page=100&page=${page}&sort=full_name`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

async function collectLiveState(registry) {
  if (!process.env.GITHUB_TOKEN) console.warn("WARN: GITHUB_TOKEN is not set; public API rate limits may apply.");
  const owner = registry.owner;
  const discovered = await listPublicOwnerRepos(owner);
  const discoveredNames = discovered.map((r) => r.name).sort();
  const registeredNames = registry.repositories.map((r) => r.name).sort();
  const unregistered = discoveredNames.filter((name) => !registeredNames.includes(name));
  const missing = registeredNames.filter((name) => !discoveredNames.includes(name));
  if (unregistered.length) throw new Error(`unregistered repositories: ${unregistered.join(", ")}`);
  if (missing.length) throw new Error(`registered repositories missing from public owner scope: ${missing.join(", ")}`);

  const stateRepos = [];
  for (const semantic of registry.repositories) {
    const live = discovered.find((r) => r.name === semantic.name) ?? await github(`/repos/${owner}/${semantic.name}`);
    const [openPrs, trackedIssues] = await Promise.all([
      openPullRequestCount(owner, semantic.name),
      fetchTrackedIssues(owner, semantic.name, semantic.tracked_issues)
    ]);
    const combinedOpenIssuesAndPrs = Number(live.open_issues_count ?? 0);
    const openIssues = Math.max(0, combinedOpenIssuesAndPrs - openPrs);
    stateRepos.push({
      name:semantic.name,
      html_url:live.html_url,
      default_branch:live.default_branch,
      archived:live.archived,
      visibility:live.visibility,
      pushed_at:live.pushed_at,
      updated_at:live.updated_at,
      open_issues:openIssues,
      open_pull_requests:openPrs,
      tracked_issues:trackedIssues
    });
  }

  const workstreams = await fetchTrackedIssues(owner, registry.control_repository, registry.workstreams.map((w) => w.issue));
  const brokenTracked = stateRepos.flatMap((r) => r.tracked_issues.filter((i) => i.state === "missing").map((i) => `${r.name}#${i.number}`));
  const brokenWorkstreams = workstreams.filter((i) => i.state === "missing").map((i) => `${registry.control_repository}#${i.number}`);
  const brokenRefs = [...brokenTracked, ...brokenWorkstreams];
  if (brokenRefs.length) throw new Error(`broken tracked issue references: ${brokenRefs.join(", ")}`);

  const latestObserved = [
    ...stateRepos.flatMap((r) => [r.pushed_at,r.updated_at,...r.tracked_issues.map((i) => i.updated_at)]),
    ...workstreams.map((i) => i.updated_at)
  ].filter(Boolean).sort().at(-1) ?? null;

  const facts = {
    schema_version:1,
    owner,
    registry_schema_version:registry.schema_version,
    latest_observed_github_change:latestObserved,
    repository_count:stateRepos.length,
    workstreams,
    repositories:stateRepos
  };
  facts.state_hash = crypto.createHash("sha256").update(JSON.stringify(facts)).digest("hex");
  return facts;
}

function mdEscape(value) { return String(value ?? "").replaceAll("|","\\|").replace(/\s+/g," ").trim(); }
function issueBadge(issue) {
  if (issue.state === "open") return "🟡";
  if (issue.state === "closed") return "✅";
  if (issue.state === "missing") return "❌";
  return "⚪";
}

function renderStatus(registry, facts) {
  const owner = registry.owner;
  const liveByName = new Map(facts.repositories.map((r) => [r.name,r]));
  const liveWorkstreams = new Map(facts.workstreams.map((i) => [i.number,i]));
  const ordered = [...registry.repositories].sort((a,b) => priorityRank(a.priority)-priorityRank(b.priority) || a.name.localeCompare(b.name));
  const lines = [];
  lines.push("# Current portfolio status","");
  lines.push("> **GENERATED FILE — DO NOT EDIT.** Semantic decisions come from [`data/portfolio.json`](data/portfolio.json); factual GitHub state is collected by `scripts/sync-roadmap.mjs`.","");
  lines.push(`- Owner: \`${owner}\``);
  lines.push(`- Registered repositories: **${facts.repository_count}**`);
  lines.push(`- Latest observed GitHub change in snapshot: **${facts.latest_observed_github_change ?? "n/a"}**`);
  lines.push(`- State hash: \`${facts.state_hash}\``,"");

  lines.push("## Portfolio workstreams","");
  lines.push("| Priority | Workstream | Declared status | GitHub state | Next gate |","|---:|---|---|---|---|");
  for (const w of [...registry.workstreams].sort((a,b) => priorityRank(a.priority)-priorityRank(b.priority) || a.issue-b.issue)) {
    const live = liveWorkstreams.get(w.issue);
    const state = live ? `${issueBadge(live)} ${live.state}` : "❌ missing";
    lines.push(`| **${w.priority}** | [#${w.issue}](${issueUrl(owner,registry.control_repository,w.issue)}) ${mdEscape(w.title)} | \`${w.status}\` | ${state} | ${mdEscape(w.next_gate)} |`);
  }

  lines.push("","## Executive board","");
  lines.push("| Priority | Repository | Lifecycle | Current objective | Next portfolio gate | GitHub | Roadmap |","|---:|---|---|---|---|---|---|");
  for (const semantic of ordered) {
    const live = liveByName.get(semantic.name);
    const workstreams = semantic.roadmap_issues.map((n) => `[#${n}](${issueUrl(owner,"roadmap",n)})`).join(", ");
    lines.push(`| **${semantic.priority}** | [\`${semantic.name}\`](${repoUrl(owner,semantic.name)}) | \`${semantic.lifecycle}\` | ${mdEscape(semantic.objective)} | ${mdEscape(semantic.next_gate)} | ${live.open_issues} issues / ${live.open_pull_requests} PRs | ${workstreams || "—"} |`);
  }

  lines.push("","## P0 / blocking gates","");
  for (const semantic of ordered.filter((r) => r.priority.startsWith("P0"))) {
    const live = liveByName.get(semantic.name);
    lines.push(`### ${semantic.name} — ${semantic.lifecycle}`,"",`**Objective:** ${semantic.objective}`,"",`**Next gate:** ${semantic.next_gate}`);
    if (semantic.depends_on.length) lines.push("",`**Depends on:** ${semantic.depends_on.map((d) => `[\`${d}\`](${repoUrl(owner,d)})`).join(", ")}`);
    if (live.tracked_issues.length) {
      lines.push("");
      for (const issue of live.tracked_issues) lines.push(`- ${issueBadge(issue)} [#${issue.number}](${issue.html_url}) \`${issue.state}\`${issue.title ? ` — ${issue.title}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Repository facts","");
  lines.push("| Repository | Branch | Archived | Last push | Open issues | Open PRs |","|---|---|---:|---|---:|---:|");
  for (const semantic of ordered) {
    const live = liveByName.get(semantic.name);
    lines.push(`| [\`${semantic.name}\`](${live.html_url}) | \`${live.default_branch}\` | ${live.archived ? "yes" : "no"} | ${live.pushed_at ?? "—"} | ${live.open_issues} | ${live.open_pull_requests} |`);
  }

  lines.push("","## Tracked issues by repository","");
  for (const semantic of ordered.filter((r) => liveByName.get(r.name).tracked_issues.length)) {
    const live = liveByName.get(semantic.name);
    lines.push(`### ${semantic.name}`,"");
    for (const issue of live.tracked_issues) lines.push(`- ${issueBadge(issue)} [#${issue.number}](${issue.html_url}) \`${issue.state}\`${issue.title ? ` — ${issue.title}` : ""}`);
    lines.push("");
  }

  lines.push("## How to read this file","");
  lines.push("- `objective`, `next gate`, `priority`, `lifecycle`, dependencies and ownership are **portfolio decisions** from `data/portfolio.json`.");
  lines.push("- issue/PR counts, archive/default-branch state, timestamps and tracked-issue states are **GitHub facts**.");
  lines.push("- closing a tracked local issue updates this status automatically; changing portfolio priority or the next strategic gate requires an explicit roadmap change.");
  lines.push("- implementation details remain in local repositories; this file is the control board, not a duplicate backlog.","");
  return lines.join("\n");
}

async function writeIfChanged(file, content) {
  let old = null;
  try { old = await fs.readFile(file,"utf8"); } catch {}
  if (old === content) return false;
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,content);
  return true;
}

async function main() {
  const registry = await readRegistry();
  const errors = validateRegistry(registry);
  if (errors.length) {
    for (const error of errors) fail(error);
    return;
  }
  if (mode === "validate") {
    console.log(`registry ok: ${registry.repositories.length} repositories, ${registry.workstreams.length} workstreams`);
    return;
  }
  const facts = await collectLiveState(registry);
  console.log(`live coverage ok: ${facts.repository_count} repositories`);
  if (mode === "validate-live") return;
  const jsonChanged = await writeIfChanged(STATUS_JSON_PATH, JSON.stringify(facts,null,2)+"\n");
  const mdChanged = await writeIfChanged(STATUS_MD_PATH, renderStatus(registry,facts)+"\n");
  console.log(`sync complete: status.json=${jsonChanged ? "changed" : "unchanged"}, STATUS.md=${mdChanged ? "changed" : "unchanged"}`);
}

main().catch((error) => fail(error.stack || error.message || String(error)));
