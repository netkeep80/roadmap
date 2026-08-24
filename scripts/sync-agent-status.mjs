#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import {
  classifyAgentIssue,
  parseProtocolBlock,
  validateCheckpoint,
  validateMessage,
  validateRoleCoverage,
  validateSession,
} from './agent-protocol.mjs';
import { buildAgentSnapshot, renderAgentStatus } from './agent-status.mjs';
import { analyzeOpenPullRequests } from './pr-reconciliation.mjs';
import {
  AGENT_MARKER,
  agentIssuesOnly,
  collectLiveAgentInputs,
  githubAgentApi,
  listAllControlIssues,
  publicRepositoryNames,
  validateLiveAgentState,
} from './validate-agents.mjs';

const REGISTRY_PATH = new URL('../data/portfolio.json', import.meta.url);
const WORKER_POLICY_PATH = new URL('../data/worker-policy.json', import.meta.url);
const DEFAULT_STATUS_ISSUE_NUMBER = 103;
const validateOnly = process.argv.includes('--validate-live');

async function readRegistry() {
  return JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
}

async function readWorkerPolicy() {
  return JSON.parse(await fs.readFile(WORKER_POLICY_PATH, 'utf8'));
}

async function listIssueComments(owner, repository, issueNumber) {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubAgentApi(`/repos/${owner}/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  return comments;
}

export async function listRepositoryPullRequests(owner, repository) {
  const pullRequests = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubAgentApi(`/repos/${owner}/${repository}/pulls?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`agent status: pull request API for ${owner}/${repository} did not return an array`);
    pullRequests.push(...batch.map((pr) => ({
      number: pr.number,
      state: pr.state,
      body: pr.body ?? '',
    })));
    if (batch.length < 100) break;
  }
  return pullRequests;
}

function checkpointCommentsOnly(comments) {
  return comments.filter((comment) => typeof comment.body === 'string' && comment.body.includes(AGENT_MARKER));
}

function issueApiHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'netkeep80-roadmap-agent-status',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function patchIssueApi(pathname, options) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method: options.method,
    headers: issueApiHeaders(),
    body: JSON.stringify(options.body),
  });
  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`GitHub API ${response.status} ${pathname}: ${responseBody.slice(0, 400)}`);
  }
  return response.json();
}

export async function updateAgentStatusIssue({ owner, repository, issueNumber, body, api = patchIssueApi }) {
  if (!owner || !repository) throw new Error('agent status issue publication requires owner and repository');
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error('agent status issue number must be a positive integer');
  if (typeof body !== 'string' || !body.trim()) throw new Error('agent status issue body must be non-empty markdown');

  return api(`/repos/${owner}/${repository}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: { body },
  });
}

export async function buildLiveAgentSnapshot({
  registry,
  workerPolicy,
  repositories,
  issues,
  historicalIssues = issues,
  checkedAt = new Date().toISOString(),
  listComments = listIssueComments,
  listPullRequests = listRepositoryPullRequests,
}) {
  await validateLiveAgentState({ registry, repositories, issues, enforce: true });

  const publicNames = publicRepositoryNames(repositories);
  const classified = agentIssuesOnly(issues).map((issue) => classifyAgentIssue(issue));
  const roleIssues = classified.filter(({ kind }) => kind === 'role').map(({ issue }) => issue);
  const coverage = validateRoleCoverage(
    registry.repositories.map((repo) => repo.name),
    publicNames,
    roleIssues,
    { enforceComplete: true },
  );

  const roles = [...coverage.roleMap.values()];
  const sessions = classified
    .filter(({ kind }) => kind === 'session')
    .map(({ issue }) => ({
      number: issue.number,
      html_url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      data: validateSession(issue, coverage.roleMap),
    }));
  const messages = classified
    .filter(({ kind }) => kind === 'message')
    .map(({ issue }) => ({
      number: issue.number,
      html_url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      data: validateMessage(issue, coverage.roleMap),
    }));

  const historicalClassified = agentIssuesOnly(historicalIssues).map((issue) => classifyAgentIssue(issue));
  const auditSessions = historicalClassified
    .filter(({ kind }) => kind === 'session')
    .map(({ issue }) => ({
      number: issue.number,
      html_url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      data: validateSession(issue, coverage.roleMap),
    }));

  const checkpointsBySession = {};
  for (const session of auditSessions) {
    const comments = await listComments(registry.owner, registry.control_repository, session.number);
    const checkpoints = [];
    for (const comment of checkpointCommentsOnly(comments)) {
      const parsed = parseProtocolBlock(comment.body);
      if (parsed.protocol !== 'roadmap-agent-checkpoint/v1') {
        throw new Error(`agent protocol: marked comment ${comment.id} on session #${session.number} is not a checkpoint`);
      }
      checkpoints.push({
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        data: validateCheckpoint(comment, coverage.roleMap, session.data),
      });
    }
    checkpointsBySession[session.number] = checkpoints;
  }

  const prDiagnostics = {
    duplicate_work_items: [],
    unreconciled_supersessions: [],
  };
  for (const repo of registry.repositories) {
    if (!publicNames.has(repo.name)) continue;
    const fullName = `${registry.owner}/${repo.name}`;
    const pullRequests = await listPullRequests(registry.owner, repo.name);
    const diagnostics = analyzeOpenPullRequests({ repository: fullName, pullRequests });
    prDiagnostics.duplicate_work_items.push(...diagnostics.duplicate_work_items.map((entry) => ({ repository: fullName, ...entry })));
    prDiagnostics.unreconciled_supersessions.push(...diagnostics.unreconciled_supersessions.map((entry) => ({ repository: fullName, ...entry })));
  }
  prDiagnostics.duplicate_work_items.sort((left, right) => left.work_item.localeCompare(right.work_item));
  prDiagnostics.unreconciled_supersessions.sort((left, right) => left.repository.localeCompare(right.repository) || left.replacement_pr - right.replacement_pr || left.superseded_pr - right.superseded_pr);

  return buildAgentSnapshot({ checkedAt, roles, sessions, messages, checkpointsBySession, workerPolicy, prDiagnostics });
}

async function main() {
  const [registry, workerPolicy] = await Promise.all([readRegistry(), readWorkerPolicy()]);
  if (!process.env.GITHUB_TOKEN) {
    console.warn('WARN: GITHUB_TOKEN is not set; public API rate limits may apply.');
  }
  const [{ repositories, issues }, historicalIssues] = await Promise.all([
    collectLiveAgentInputs(registry),
    listAllControlIssues(registry.owner, registry.control_repository),
  ]);
  const snapshot = await buildLiveAgentSnapshot({ registry, workerPolicy, repositories, issues, historicalIssues });

  console.log(`agent status live ok: ${snapshot.role_count}/${snapshot.repository_count} roles, ${snapshot.active_session_count} active sessions, ${snapshot.stale_candidate_session_count} stale candidates, ${snapshot.claim_count} active claims, ${snapshot.stale_claim_count} stale claims, ${snapshot.duplicate_work_item_pr_count} duplicate-work PR groups, ${snapshot.unreconciled_supersession_count} unreconciled supersessions, ${snapshot.unresolved_message_count} unresolved messages`);
  if (validateOnly) return;

  const configuredIssueNumber = Number.parseInt(process.env.AGENT_STATUS_ISSUE_NUMBER ?? `${DEFAULT_STATUS_ISSUE_NUMBER}`, 10);
  const issueBody = `${renderAgentStatus(snapshot).replace('GENERATED FILE — DO NOT EDIT.', 'GENERATED ISSUE VIEW — DO NOT EDIT.')}\n`;
  const updatedIssue = await updateAgentStatusIssue({
    owner: registry.owner,
    repository: registry.control_repository,
    issueNumber: configuredIssueNumber,
    body: issueBody,
  });
  console.log(`agent status sync complete: issue #${updatedIssue.number ?? configuredIssueNumber} updated through GitHub Issues API`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
