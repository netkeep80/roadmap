#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
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
import {
  AGENT_MARKER,
  agentIssuesOnly,
  collectLiveAgentInputs,
  githubAgentApi,
  publicRepositoryNames,
  validateLiveAgentState,
} from './validate-agents.mjs';

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'data', 'portfolio.json');
const AGENTS_JSON_PATH = path.join(ROOT, 'data', 'agents.json');
const AGENTS_MD_PATH = path.join(ROOT, 'AGENTS_STATUS.md');
const validateOnly = process.argv.includes('--validate-live');

async function readRegistry() {
  return JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
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

function checkpointCommentsOnly(comments) {
  return comments.filter((comment) => typeof comment.body === 'string' && comment.body.includes(AGENT_MARKER));
}

async function writeIfChanged(file, content) {
  let previous = null;
  try {
    previous = await fs.readFile(file, 'utf8');
  } catch {}
  if (previous === content) return false;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
  return true;
}

export async function buildLiveAgentSnapshot({
  registry,
  repositories,
  issues,
  checkedAt = new Date().toISOString(),
  listComments = listIssueComments,
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

  const checkpointsBySession = {};
  for (const session of sessions) {
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

  return buildAgentSnapshot({ checkedAt, roles, sessions, messages, checkpointsBySession });
}

async function main() {
  const registry = await readRegistry();
  if (!process.env.GITHUB_TOKEN) {
    console.warn('WARN: GITHUB_TOKEN is not set; public API rate limits may apply.');
  }
  const { repositories, issues } = await collectLiveAgentInputs(registry);
  const snapshot = await buildLiveAgentSnapshot({ registry, repositories, issues });

  console.log(`agent status live ok: ${snapshot.role_count}/${snapshot.repository_count} roles, ${snapshot.active_session_count} active sessions, ${snapshot.claim_count} claims, ${snapshot.unresolved_message_count} unresolved messages`);
  if (validateOnly) return;

  const jsonChanged = await writeIfChanged(AGENTS_JSON_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  const mdChanged = await writeIfChanged(AGENTS_MD_PATH, `${renderAgentStatus(snapshot)}\n`);
  console.log(`agent status sync complete: agents.json=${jsonChanged ? 'changed' : 'unchanged'}, AGENTS_STATUS.md=${mdChanged ? 'changed' : 'unchanged'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
