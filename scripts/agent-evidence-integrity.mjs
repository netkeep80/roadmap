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

function assertRegisteredSessionRepository(registry, repository) {
  const match = typeof repository === 'string' ? REPOSITORY.exec(repository) : null;
  const allowed = new Set((registry?.repositories ?? []).map((entry) => entry.name));
  if (!match || !allowed.has(match[1])) {
    throw new Error('control plane evidence: Session repository is outside the registered public scope');
  }
  return repository;
}

function checkpointCommitRecords(checkpoint, repository) {
  if (!Array.isArray(checkpoint.refs)) {
    throw new Error('control plane evidence: checkpoint refs must be an array');
  }
  const records = [];
  for (const ref of checkpoint.refs) {
    if (typeof ref !== 'string' || !ref.startsWith('commit:')) continue;
    const match = COMMIT_REF.exec(ref);
    if (!match) throw new Error('control plane evidence: checkpoint commit SHA is malformed');
    records.push({ repository, sha: match[1] });
  }
  return records;
}

async function defaultResolveCommit(repository, sha) {
  const [owner, name] = repository.split('/');
  return githubAgentApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(sha)}`);
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

export async function validateCheckpointEventEvidence({ event, registry, resolveCommit = defaultResolveCommit }) {
  if (!event || typeof event !== 'object') {
    throw new Error('control plane evidence: GitHub event payload is required');
  }
  if (!registry || typeof registry !== 'object') {
    throw new Error('control plane evidence: registry is required');
  }

  if (!['created', 'edited'].includes(event.action) || !event.comment || typeof event.comment.body !== 'string') {
    return { checked: false, unique_commit_evidence: 0 };
  }
  if (!event.comment.body.includes(AGENT_MARKER)) {
    return { checked: false, unique_commit_evidence: 0 };
  }

  const checkpoint = parseProtocolBlock(event.comment.body);
  if (checkpoint.protocol !== CHECKPOINT_PROTOCOL) {
    return { checked: false, unique_commit_evidence: 0 };
  }

  if (!event.issue || typeof event.issue.body !== 'string' || !event.issue.body.includes(AGENT_MARKER)) {
    throw new Error('control plane evidence: checkpoint comment is not attached to a protocol Session');
  }
  const session = parseProtocolBlock(event.issue.body);
  if (session.protocol !== SESSION_PROTOCOL) {
    throw new Error('control plane evidence: checkpoint comment is not attached to a Session');
  }
  const repository = assertRegisteredSessionRepository(registry, session.repository);
  const records = checkpointCommitRecords(checkpoint, repository);
  const result = await validateCommitEvidence(records, resolveCommit);
  return { checked: true, ...result };
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

// Manual/baseline audit only. Automatic Agent Status must use --validate-event so it
// does not duplicate the existing historical Session/Checkpoint scan every run.
export async function collectCheckpointCommitEvidence({ registry, issues, listComments = listIssueComments }) {
  if (!registry || typeof registry !== 'object') throw new Error('control plane evidence: registry is required');
  const records = [];

  for (const issue of agentIssuesOnly(issues)) {
    const session = parseProtocolBlock(issue.body);
    if (session.protocol !== SESSION_PROTOCOL) continue;
    const repository = assertRegisteredSessionRepository(registry, session.repository);

    const comments = await listComments(registry.owner, registry.control_repository, issue.number);
    for (const comment of comments) {
      if (typeof comment.body !== 'string' || !comment.body.includes(AGENT_MARKER)) continue;
      const checkpoint = parseProtocolBlock(comment.body);
      if (checkpoint.protocol !== CHECKPOINT_PROTOCOL) continue;
      records.push(...checkpointCommitRecords(checkpoint, repository));
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
  return validateCommitEvidence(records, resolveCommit ?? defaultResolveCommit);
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

  if (process.argv.includes('--validate-event')) {
    if (!process.env.GITHUB_EVENT_PATH) throw new Error('control plane evidence: GITHUB_EVENT_PATH is required');
    const [registry, event] = await Promise.all([
      fs.readFile(REGISTRY_PATH, 'utf8').then(JSON.parse),
      fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8').then(JSON.parse),
    ]);
    const result = await validateCheckpointEventEvidence({ event, registry });
    console.log(`control plane checkpoint event evidence ok: checked=${result.checked}, ${result.unique_commit_evidence} unique repository-scoped commits`);
    return;
  }

  if (process.argv.includes('--validate-live')) {
    const result = await validateLiveCheckpointCommitEvidence();
    console.log(`control plane commit evidence baseline audit ok: ${result.unique_commit_evidence} unique repository-scoped commits`);
    return;
  }

  throw new Error('control plane evidence: expected --validate-event, --validate-live or --render-invalid');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
