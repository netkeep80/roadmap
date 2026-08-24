#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import {
  classifyAgentIssue,
  validateMessage,
  validateRoleCoverage,
  validateSession,
} from './agent-protocol.mjs';

const REGISTRY_PATH = new URL('../data/portfolio.json', import.meta.url);
export const AGENT_MARKER = '<!-- roadmap-agent:start -->';
const enforceComplete = process.argv.includes('--enforce');

function apiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'netkeep80-roadmap-agent-control-plane',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

export async function githubAgentApi(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, { headers: apiHeaders() });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} ${pathname}: ${body.slice(0, 400)}`);
  }
  return response.json();
}

export function isPublicRepository(repo) {
  return repo && repo.private === false && (repo.visibility == null || repo.visibility === 'public');
}

export function publicRepositoryNames(repositories) {
  if (!Array.isArray(repositories)) throw new Error('repository inventory must be an array');
  return repositories.filter(isPublicRepository).map((repo) => repo.name).sort();
}

export async function listPublicOwnerRepositories(owner) {
  const publicRepositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubAgentApi(`/users/${owner}/repos?type=owner&per_page=100&page=${page}&sort=full_name`);
    publicRepositories.push(...batch.filter(isPublicRepository));
    if (batch.length < 100) break;
  }
  return publicRepositories;
}

export async function listOpenControlIssues(owner, repository) {
  const issues = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubAgentApi(`/repos/${owner}/${repository}/issues?state=open&per_page=100&page=${page}`);
    issues.push(...batch.filter((issue) => !issue.pull_request));
    if (batch.length < 100) break;
  }
  return issues;
}

export function agentIssuesOnly(issues) {
  return issues.filter((issue) => typeof issue.body === 'string' && issue.body.includes(AGENT_MARKER));
}

export async function collectLiveAgentInputs(registry) {
  if (!registry || typeof registry !== 'object') throw new Error('agent control plane registry is required');
  const [repositories, issues] = await Promise.all([
    listPublicOwnerRepositories(registry.owner),
    listOpenControlIssues(registry.owner, registry.control_repository),
  ]);
  return { repositories, issues };
}

export async function validateLiveAgentState({ registry, repositories, issues, enforce = false }) {
  if (registry.scope !== 'public-owner-repositories') {
    throw new Error(`agent control plane requires scope=public-owner-repositories, got ${JSON.stringify(registry.scope)}`);
  }

  const publicNames = publicRepositoryNames(repositories);
  const registeredNames = registry.repositories.map((repo) => repo.name).sort();
  const classified = agentIssuesOnly(issues).map((issue) => classifyAgentIssue(issue));
  const roleIssues = classified.filter(({ kind }) => kind === 'role').map(({ issue }) => issue);

  const coverage = validateRoleCoverage(registeredNames, publicNames, roleIssues, { enforceComplete: enforce });

  for (const { kind, issue } of classified) {
    if (kind === 'session') validateSession(issue, coverage.roleMap);
    if (kind === 'message') validateMessage(issue, coverage.roleMap);
  }

  return {
    repository_count: publicNames.length,
    role_count: coverage.roleMap.size,
    missing_roles: coverage.missing,
    session_count: classified.filter(({ kind }) => kind === 'session').length,
    message_count: classified.filter(({ kind }) => kind === 'message').length,
    enforcement: enforce ? 'blocking' : 'advisory',
  };
}

async function main() {
  const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
  if (!process.env.GITHUB_TOKEN) {
    console.warn('WARN: GITHUB_TOKEN is not set; public API rate limits may apply.');
  }

  const { repositories, issues } = await collectLiveAgentInputs(registry);
  const result = await validateLiveAgentState({
    registry,
    repositories,
    issues,
    enforce: enforceComplete,
  });

  if (result.missing_roles.length) {
    console.warn(`WARN: missing permanent Agent Roles (${result.missing_roles.length}): ${result.missing_roles.join(', ')}`);
  }
  console.log(`agent control plane ${result.enforcement}: ${result.role_count}/${result.repository_count} roles, ${result.session_count} active protocol sessions, ${result.message_count} protocol messages`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
