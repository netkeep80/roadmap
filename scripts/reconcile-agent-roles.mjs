#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import { classifyAgentIssue, validateRoleCoverage } from './agent-protocol.mjs';
import { assertRoleTemplate, roleIssueBody, roleIssueTitle } from './agent-role-template.mjs';

const REGISTRY_PATH = new URL('../data/portfolio.json', import.meta.url);
const AGENT_MARKER = '<!-- roadmap-agent:start -->';

function apiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'netkeep80-roadmap-agent-role-reconciler',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} ${pathname}: ${body.slice(0, 600)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function isPublicRepository(repo) {
  return repo && repo.private === false && (repo.visibility == null || repo.visibility === 'public');
}

async function listPublicOwnerRepositories(owner) {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/users/${owner}/repos?type=owner&per_page=100&page=${page}&sort=full_name`);
    repositories.push(...batch.filter(isPublicRepository));
    if (batch.length < 100) break;
  }
  return repositories;
}

async function listOpenIssues(owner, repository) {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/repos/${owner}/${repository}/issues?state=open&per_page=100&page=${page}`);
    issues.push(...batch.filter((issue) => !issue.pull_request));
    if (batch.length < 100) break;
  }
  return issues;
}

function openAgentRoleIssues(issues) {
  const result = [];
  for (const issue of issues) {
    if (typeof issue.body !== 'string' || !issue.body.includes(AGENT_MARKER)) continue;
    const classified = classifyAgentIssue(issue);
    if (classified.kind === 'role') result.push(issue);
  }
  return result;
}

async function createRoleIssue(owner, controlRepository, repositoryName) {
  const title = roleIssueTitle(repositoryName);
  const body = roleIssueBody(owner, controlRepository, repositoryName);
  assertRoleTemplate(repositoryName, body);

  return github(`/repos/${owner}/${controlRepository}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body }),
  });
}

export function computeMissingRoles(registryNames, publicNames, issues) {
  const coverage = validateRoleCoverage(registryNames, publicNames, openAgentRoleIssues(issues), { enforceComplete: false });
  return coverage.missing;
}

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN with issues:write permission is required');
  }

  const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
  if (registry.scope !== 'public-owner-repositories') {
    throw new Error(`refusing role reconciliation outside public-owner-repositories scope: ${JSON.stringify(registry.scope)}`);
  }

  const owner = registry.owner;
  const controlRepository = registry.control_repository;
  const registryNames = registry.repositories.map((repo) => repo.name).sort();

  const [repositories, issues] = await Promise.all([
    listPublicOwnerRepositories(owner),
    listOpenIssues(owner, controlRepository),
  ]);
  const publicNames = repositories.map((repo) => repo.name).sort();

  const missing = computeMissingRoles(registryNames, publicNames, issues);
  if (!missing.length) {
    console.log(`role reconciliation: no changes; ${registryNames.length}/${registryNames.length} permanent roles already present`);
  } else {
    console.log(`role reconciliation: creating ${missing.length} permanent roles`);
    for (const repositoryName of missing) {
      const created = await createRoleIssue(owner, controlRepository, repositoryName);
      console.log(`created ${repositoryName}: ${created.html_url}`);
    }
  }

  const finalIssues = await listOpenIssues(owner, controlRepository);
  const finalRoles = openAgentRoleIssues(finalIssues);
  const finalCoverage = validateRoleCoverage(registryNames, publicNames, finalRoles, { enforceComplete: true });

  const directory = [...finalCoverage.roleMap.entries()]
    .map(([issueNumber, role]) => ({ repository: role.repository, issue: issueNumber }))
    .sort((a, b) => a.repository.localeCompare(b.repository));

  console.log(`role reconciliation complete: ${directory.length}/${publicNames.length}`);
  for (const entry of directory) {
    console.log(`${entry.repository} -> https://github.com/${owner}/${controlRepository}/issues/${entry.issue}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
