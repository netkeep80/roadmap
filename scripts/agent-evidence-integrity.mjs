#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import { parseProtocolBlock } from './agent-protocol.mjs';
import {
  AGENT_MARKER,
  agentIssuesOnly,
  githubAgentApi,
  listAllControlIssues,
} from './validate-agents.mjs';

const REGISTRY_PATH = new URL('../data/portfolio.json', import.meta.url);
const CHECKPOINT_PROTOCOL = 'roadmap-agent-checkpoint/v1';
const SESSION_PROTOCOL = 'roadmap-agent-session/v1';
const COMMIT_REF = /^commit:([0-9a-f]{40,64})$/i;
const REPOSITORY = /^netkeep80\/([^/]+)$/;

function assertCommitRecord(record) {
  if (!record || Array.isArray(record) || typeof record !== 'object') {
    throw new Error('control plane evidence: commit evidence record must be an object');
  }
  if (typeof record.repository !== 'string' || !REPOSITORY.test(record.repository)) {
    throw new Error('control plane evidence: commit evidence repository is invalid');
  }
  if (typeof record.sha !== 'string' || !/^[0-9a-f]{40,64}$/i.test(record.sha)) {
    throw new Error('control plane evidence: commit evidence SHA is malformed');
  }
  return { repository: record.repository, sha: record.sha.toLowerCase() };
}

export async function validateCommitEvidence(records, resolveCommit) {
  if (!Array.isArray(records)) throw new Error('control plane evidence: records must be an array');
  if (typeof resolveCommit !== 'function') throw new Error('control plane evidence: resolveCommit must be a function');

  const unique = new Map();
  for (const record of records) {
    const normalized = assertCommitRecord(record);
    unique.set(`${normalized.repository}@${normalized.sha}`, normalized);
  }

  for (const { repository, sha } of unique.values()) {
    let resolved;
    try {
      resolved = await resolveCommit(repository, sha);
    } catch (cause) {
      const error = new Error(`control plane evidence: commit evidence ${repository}@${sha} does not resolve`);
      error.cause = cause;
      throw error;
    }
    if (!resolved || typeof resolved.sha !== 'string' || resolved.sha.toLowerCase() !== sha) {
      throw new Error(`control plane evidence: commit evidence ${repository}@${sha} resolved to a different commit`);
    }
  }

  return { unique_commit_evidence: unique.size };
}

async function listIssueComments(owner, repository, issueNumber) {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubAgentApi(`/repos/${owner}/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('control plane evidence: issue comment API did not return an array');
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  return comments;
}

export async function collectCheckpointCommitEvidence({ registry, issues, listComments = listIssueComments }) {
  if (!registry || typeof registry !== 'object') throw new Error('control plane evidence: registry is required');
  const allowedRepositories = new Set(registry.repositories.map((repository) => repository.name));
  const records = [];

  for (const issue of agentIssuesOnly(issues)) {
    const session = parseProtocolBlock(issue.body);
    if (session.protocol !== SESSION_PROTOCOL) continue;

    const repositoryMatch = typeof session.repository === 'string' ? REPOSITORY.exec(session.repository) : null;
    if (!repositoryMatch || !allowedRepositories.has(repositoryMatch[1])) {
      throw new Error('control plane evidence: Session repository is outside the registered public scope');
    }

    const comments = await listComments(registry.owner, registry.control_repository, issue.number);
    for (const comment of comments) {
      if (typeof comment.body !== 'string' || !comment.body.includes(AGENT_MARKER)) continue;
      const checkpoint = parseProtocolBlock(comment.body);
      if (checkpoint.protocol !== CHECKPOINT_PROTOCOL) continue;
      if (!Array.isArray(checkpoint.refs)) throw new Error('control plane evidence: checkpoint refs must be an array');

      for (const ref of checkpoint.refs) {
        if (typeof ref !== 'string' || !ref.startsWith('commit:')) continue;
        const match = COMMIT_REF.exec(ref);
        if (!match) throw new Error('control plane evidence: checkpoint commit SHA is malformed');
        records.push({ repository: session.repository, sha: match[1] });
      }
    }
  }

  return records;
}

export async function validateLiveCheckpointCommitEvidence({ registry, issues, listComments, resolveCommit } = {}) {
  const effectiveRegistry = registry ?? JSON.parse(await fs.readFile(REGISTRY_PATH, 'utf8'));
  const effectiveIssues = issues ?? await listAllControlIssues(effectiveRegistry.owner, effectiveRegistry.control_repository);
  const records = await collectCheckpointCommitEvidence({
    registry: effectiveRegistry,
    issues: effectiveIssues,
    ...(listComments ? { listComments } : {}),
  });

  const effectiveResolver = resolveCommit ?? (async (repository, sha) => {
    const [owner, name] = repository.split('/');
    return githubAgentApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(sha)}`);
  });

  return validateCommitEvidence(records, effectiveResolver);
}

export function renderInvalidAgentStatus({ checkedAt, runUrl } = {}) {
  const timestamp = typeof checkedAt === 'string' && checkedAt ? checkedAt : new Date().toISOString();
  const publicRunUrl = typeof runUrl === 'string' && /^https:\/\/github\.com\/netkeep80\/roadmap\/actions\/runs\/[0-9]+$/.test(runUrl)
    ? runUrl
    : null;

  return [
    '# Agent Control Plane Status',
    '',
    '> **CONTROL PLANE INVALID — DO NOT USE THE PREVIOUS SNAPSHOT FOR WORK SELECTION.**',
    '',
    `- Detected at: ${timestamp}`,
    '- Live protocol/evidence validation failed closed.',
    '- Scheduled workers must not infer authority or executable work from the previous generated snapshot.',
    '- Re-read GitHub after the control-plane defect is repaired and a fresh successful status run is observed.',
    ...(publicRunUrl ? [`- Diagnostic workflow: ${publicRunUrl}`] : []),
    '',
  ].join('\n');
}

async function main() {
  if (process.argv.includes('--render-invalid')) {
    const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : null;
    process.stdout.write(renderInvalidAgentStatus({ checkedAt: new Date().toISOString(), runUrl }));
    return;
  }

  if (!process.argv.includes('--validate-live')) {
    throw new Error('control plane evidence: expected --validate-live or --render-invalid');
  }

  const result = await validateLiveCheckpointCommitEvidence();
  console.log(`control plane commit evidence live ok: ${result.unique_commit_evidence} unique repository-scoped commits`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
