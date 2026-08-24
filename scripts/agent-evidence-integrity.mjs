#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';

import { compareClaimPriority, parseProtocolBlock, validateCheckpoint, validateRoleCoverage, validateSession } from './agent-protocol.mjs';
import {
  AGENT_MARKER,
  agentIssuesOnly,
  githubAgentApi,
  listAllControlIssues,
  listOpenControlIssues,
} from './validate-agents.mjs';

const REGISTRY_PATH = new URL('../data/portfolio.json', import.meta.url);
const CHECKPOINT_PROTOCOL_V1 = 'roadmap-agent-checkpoint/v1';
const CHECKPOINT_PROTOCOL_V2 = 'roadmap-agent-checkpoint/v2';
const SESSION_PROTOCOL_V1 = 'roadmap-agent-session/v1';
const SESSION_PROTOCOL_V2 = 'roadmap-agent-session/v2';
const CHECKPOINT_PROTOCOLS = new Set([CHECKPOINT_PROTOCOL_V1, CHECKPOINT_PROTOCOL_V2]);
const SESSION_PROTOCOLS = new Set([SESSION_PROTOCOL_V1, SESSION_PROTOCOL_V2]);
const COMMIT_REF = /^commit:([0-9a-f]{40,64})$/i;
const REPOSITORY = /^netkeep80\/([^/]+)$/;
const ISSUE_REF = /^netkeep80\/([^/#]+)#([1-9][0-9]*)$/;

function fail(message) {
  throw new Error(`control plane evidence: ${message}`);
}

function assertCommitRecord(record) {
  if (!record || Array.isArray(record) || typeof record !== 'object') {
    fail('commit evidence record must be an object');
  }
  if (typeof record.repository !== 'string' || !REPOSITORY.test(record.repository)) {
    fail('commit evidence repository is invalid');
  }
  if (typeof record.sha !== 'string' || !/^[0-9a-f]{40,64}$/i.test(record.sha)) {
    fail('commit evidence SHA is malformed');
  }
  return { repository: record.repository, sha: record.sha.toLowerCase() };
}

function assertRegisteredSessionRepository(registry, repository) {
  const match = typeof repository === 'string' ? REPOSITORY.exec(repository) : null;
  const allowed = new Set((registry?.repositories ?? []).map((entry) => entry.name));
  if (!match || !allowed.has(match[1])) {
    fail('Session repository is outside the registered public scope');
  }
  return repository;
}

function assertRegisteredIssueReference(ref, registry, expectedRepository, label) {
  const match = typeof ref === 'string' ? ISSUE_REF.exec(ref) : null;
  if (!match) fail(`${label} is not a public issue/PR reference`);
  const repository = `netkeep80/${match[1]}`;
  assertRegisteredSessionRepository(registry, repository);
  if (repository !== expectedRepository) {
    fail(`${label} must belong to Session repository ${expectedRepository}`);
  }
  return { repository, number: Number(match[2]) };
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/i.test(value)) {
    fail(`${label} is not a commit SHA`);
  }
  return value.toLowerCase();
}

function checkpointCommitRecords(checkpoint, repository) {
  if (!Array.isArray(checkpoint.refs)) {
    fail('checkpoint refs must be an array');
  }
  const records = [];
  for (const ref of checkpoint.refs) {
    if (typeof ref !== 'string' || !ref.startsWith('commit:')) continue;
    const match = COMMIT_REF.exec(ref);
    if (!match) fail('checkpoint commit SHA is malformed');
    records.push({ repository, sha: match[1] });
  }
  return records;
}

function registryRoleMap(registry) {
  if (!Array.isArray(registry?.repositories)) fail('registry repositories must be an array');
  const owner = registry.owner ?? 'netkeep80';
  return new Map(registry.repositories.map((entry, index) => {
    if (!entry || typeof entry.name !== 'string' || !entry.name) fail('registry repository entry is invalid');
    return [-(index + 1), { repository: `${owner}/${entry.name}` }];
  }));
}

function strictCheckpointFromBody(body, registry, session) {
  return validateCheckpoint({ body }, registryRoleMap(registry), session);
}

async function strictAuthoritySession(issue, registry, resolveControlIssue, label) {
  assertSessionIssue(issue, label);
  const parsed = parseProtocolBlock(issue.body);
  if (!SESSION_PROTOCOLS.has(parsed.protocol) || !Number.isInteger(parsed.role_issue)) fail(`${label} must declare a valid Session role_issue`);
  let roleIssue;
  try {
    roleIssue = await resolveControlIssue(parsed.role_issue);
  } catch (cause) {
    const error = new Error(`control plane evidence: ${label} Role #${parsed.role_issue} does not resolve`);
    error.cause = cause;
    throw error;
  }
  if (!roleIssue || Number(roleIssue.number) !== parsed.role_issue || roleIssue.pull_request) fail(`${label} Role #${parsed.role_issue} does not resolve exactly`);
  const names = registry.repositories.map((entry) => entry.name);
  const { roleMap } = validateRoleCoverage(names, names, [roleIssue], { enforceComplete: false });
  const fullRoleMap = registryRoleMap(registry);
  fullRoleMap.set(parsed.role_issue, roleMap.get(parsed.role_issue));
  return validateSession(issue, fullRoleMap);
}

async function defaultResolveCommit(repository, sha) {
  const [owner, name] = repository.split('/');
  return githubAgentApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${encodeURIComponent(sha)}`);
}

async function defaultResolvePullRequest(repository, number) {
  const [owner, name] = repository.split('/');
  return githubAgentApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}`);
}

async function defaultResolveControlIssue(registry, number) {
  const controlRepository = registry.control_repository ?? 'roadmap';
  return githubAgentApi(`/repos/${encodeURIComponent(registry.owner)}/${encodeURIComponent(controlRepository)}/issues/${number}`);
}

function assertSessionIssue(issue, label) {
  if (issue?.pull_request) fail(`${label} must be a Session Issue, not a pull request`);
}

function issueNumberFromUrl(url) {
  const match = typeof url === 'string' ? /\/issues\/([1-9][0-9]*)$/.exec(url) : null;
  return match ? Number(match[1]) : null;
}

async function defaultResolveControlComment(registry, issueNumber, commentId) {
  const controlRepository = registry.control_repository ?? 'roadmap';
  const comment = await githubAgentApi(`/repos/${encodeURIComponent(registry.owner)}/${encodeURIComponent(controlRepository)}/issues/comments/${commentId}`);
  return { ...comment, issue_number: issueNumberFromUrl(comment?.issue_url) };
}

export async function validateCommitEvidence(records, resolveCommit) {
  if (!Array.isArray(records)) fail('records must be an array');
  if (typeof resolveCommit !== 'function') fail('resolveCommit must be a function');

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
      fail(`commit evidence ${repository}@${sha} resolved to a different commit`);
    }
  }

  return { unique_commit_evidence: unique.size };
}

function validateSessionEditImmutability(event) {
  if (event.comment || event.action !== 'edited') return false;
  const previousBody = event.changes?.body?.from;
  if (typeof previousBody !== 'string') return false;

  const previous = parseProtocolBlock(previousBody);
  const currentBody = event.issue?.body;
  if (typeof currentBody !== 'string' || !currentBody) {
    if (previous.protocol === SESSION_PROTOCOL_V2) fail('v2 Session protocol is immutable across body edits');
    return false;
  }

  const current = parseProtocolBlock(currentBody);
  const touchesV2 = current.protocol === SESSION_PROTOCOL_V2 || previous.protocol === SESSION_PROTOCOL_V2;
  if (!touchesV2) return false;
  if (current.protocol !== previous.protocol) fail('v2 Session protocol is immutable across body edits');
  if (current.work_item !== previous.work_item) fail('v2 Session work_item is immutable across body edits');
  if (current.work_phase !== previous.work_phase) fail('v2 Session work_phase is immutable across body edits');
  return true;
}

function authorityBearingV2Checkpoint(body) {
  if (typeof body !== 'string' || !body.includes(AGENT_MARKER)) return false;
  const data = parseProtocolBlock(body);
  return data.protocol === CHECKPOINT_PROTOCOL_V2
    && (Object.hasOwn(data, 'review_candidate') || Object.hasOwn(data, 'acceptance'));
}

function validateAuthorityCommentMutation(event) {
  if (!event.comment) return false;

  if (event.action === 'deleted') {
    if (authorityBearingV2Checkpoint(event.comment.body)) {
      fail('authority-bearing v2 Checkpoint is immutable and cannot be deleted');
    }
    return false;
  }

  if (event.action !== 'edited') return false;
  const previousBody = event.changes?.body?.from;
  const currentAuthority = authorityBearingV2Checkpoint(event.comment.body);
  const previousAuthority = authorityBearingV2Checkpoint(previousBody);
  if (currentAuthority || previousAuthority) {
    fail('authority-bearing v2 Checkpoint is immutable and cannot be edited in place');
  }
  return false;
}

function assertV2SessionForCheckpoint(session, checkpoint, eventIssueNumber) {
  if (session.protocol !== SESSION_PROTOCOL_V2) fail('v2 Checkpoint must be attached to a v2 Session');
  if (session.repository === undefined || checkpoint.work_item !== session.work_item) {
    fail('v2 Checkpoint work_item must match attached Session work_item');
  }
  if (!Number.isInteger(eventIssueNumber) || eventIssueNumber <= 0) fail('v2 checkpoint event requires Session issue number');
}

async function resolveExactPullRequest({ registry, repository, ref, headSha, baseSha, resolvePullRequest, label }) {
  const parsed = assertRegisteredIssueReference(ref, registry, repository, `${label} PR`);
  let pr;
  try {
    pr = await resolvePullRequest(parsed.repository, parsed.number);
  } catch (cause) {
    const error = new Error(`control plane evidence: ${label} PR ${ref} does not resolve`);
    error.cause = cause;
    throw error;
  }
  if (!pr || Number(pr.number) !== parsed.number || pr.state !== 'open') {
    fail(`${label} PR ${ref} is not the exact open PR`);
  }
  const actualHead = typeof pr.head?.sha === 'string' ? pr.head.sha.toLowerCase() : null;
  const actualBase = typeof pr.base?.sha === 'string' ? pr.base.sha.toLowerCase() : null;
  if (actualHead !== assertSha(headSha, `${label} head_sha`)) fail(`${label} head mismatch for ${ref}`);
  if (actualBase !== assertSha(baseSha, `${label} base_sha`)) fail(`${label} base mismatch for ${ref}`);
  return pr;
}

async function assertWinningOpenClaim({ eventIssue, session, resolveOpenControlIssues, label = 'review candidate' }) {
  const issues = await resolveOpenControlIssues();
  if (!Array.isArray(issues)) fail('open control Session resolver must return an array');
  const claimers = [];
  for (const issue of issues) {
    if (issue?.pull_request || typeof issue?.body !== 'string' || !issue.body.includes(AGENT_MARKER) || !issue.body.includes(session.work_item)) continue;
    const contender = parseProtocolBlock(issue.body);
    if (SESSION_PROTOCOLS.has(contender.protocol) && Array.isArray(contender.claims) && contender.claims.includes(session.work_item)) claimers.push(issue);
  }
  const currentNumber = Number(eventIssue?.number);
  if (!claimers.some((issue) => Number(issue.number) === currentNumber)) fail(`${label} Session is absent from the current Claim set`);
  const winner = [...claimers].sort(compareClaimPriority)[0];
  if (Number(winner.number) !== currentNumber) fail(`${label} requires the current winning Claim`);
}

async function validateReviewCandidateEvidence({ checkpoint, session, eventIssue, registry, resolvePullRequest, resolveOpenControlIssues }) {
  const candidate = checkpoint.review_candidate;
  if (!candidate) return false;
  if (session.work_phase !== 'implementation') fail('review candidate requires implementation Session phase');
  if (candidate.work_item !== session.work_item) fail('review candidate work_item must match Session work_item');
  if (!Array.isArray(session.claims) || session.claims.length !== 1 || session.claims[0] !== session.work_item) {
    fail('review candidate requires the implementation Session to own its exact work_item Claim at seal time');
  }
  await assertWinningOpenClaim({ eventIssue, session, resolveOpenControlIssues });
  if (session.current_pr !== candidate.pr) fail('review candidate PR must match Session current_pr');
  await resolveExactPullRequest({
    registry,
    repository: session.repository,
    ref: candidate.pr,
    headSha: candidate.head_sha,
    baseSha: candidate.base_sha,
    resolvePullRequest,
    label: 'review candidate',
  });
  return true;
}

function exactCandidateTuple(candidate) {
  return {
    work_item: candidate.work_item,
    pr: candidate.pr,
    head_sha: assertSha(candidate.head_sha, 'candidate head_sha'),
    base_sha: assertSha(candidate.base_sha, 'candidate base_sha'),
  };
}

function sameCandidateTuple(left, right) {
  return left.work_item === right.work_item
    && left.pr === right.pr
    && left.head_sha === right.head_sha
    && left.base_sha === right.base_sha;
}

function timestamp(record, label) {
  if (record?.created_at === undefined || record?.created_at === null) return null;
  const value = Date.parse(record.created_at);
  if (!Number.isFinite(value)) fail(`${label} created_at is invalid`);
  return value;
}

function validateAcceptanceChronology({ candidateIssue, candidateComment, acceptanceIssue, acceptanceComment }) {
  const candidateNumber = Number(candidateIssue?.number);
  const acceptanceNumber = Number(acceptanceIssue?.number);
  if (!Number.isInteger(candidateNumber) || !Number.isInteger(acceptanceNumber) || candidateNumber >= acceptanceNumber) {
    fail('final acceptance requires a fresh Session created after the implementation candidate Session');
  }

  const candidateSessionAt = timestamp(candidateIssue, 'candidate Session');
  const candidateSealAt = timestamp(candidateComment, 'candidate checkpoint');
  const acceptanceSessionAt = timestamp(acceptanceIssue, 'acceptance Session');
  const acceptanceCheckpointAt = timestamp(acceptanceComment, 'acceptance checkpoint');

  if (candidateSessionAt !== null && candidateSealAt !== null && candidateSessionAt > candidateSealAt) {
    fail('candidate checkpoint chronology is invalid');
  }
  if (candidateSealAt !== null && acceptanceSessionAt !== null && candidateSealAt >= acceptanceSessionAt) {
    fail('candidate seal must predate the fresh acceptance Session');
  }
  if (acceptanceSessionAt !== null && acceptanceCheckpointAt !== null && acceptanceSessionAt > acceptanceCheckpointAt) {
    fail('acceptance checkpoint chronology is invalid');
  }
}

async function validateAcceptanceEvidence({
  checkpoint,
  session,
  eventIssue,
  eventComment,
  registry,
  resolvePullRequest,
  resolveControlIssue,
  resolveControlComment,
  resolveOpenControlIssues,
}) {
  const acceptance = checkpoint.acceptance;
  if (!acceptance) return false;
  if (session.work_phase !== 'acceptance') fail('acceptance certificate requires acceptance Session phase');
  if (session.current_branch !== null) fail('acceptance Session cannot own an implementation branch');
  if (acceptance.work_item !== session.work_item) fail('acceptance work_item must match Session work_item');
  if (session.current_pr !== acceptance.pr) fail('acceptance PR must match Session current_pr');
  if (!Number.isInteger(acceptance.candidate_session) || acceptance.candidate_session <= 0) {
    fail('acceptance candidate_session must be a positive Session issue number');
  }
  if (acceptance.candidate_session === eventIssue.number) {
    fail('final acceptance must use a different Session from its implementation candidate');
  }
  if (!Number.isInteger(acceptance.candidate_checkpoint_comment_id) || acceptance.candidate_checkpoint_comment_id <= 0) {
    fail('acceptance candidate_checkpoint_comment_id must be a positive comment id');
  }

  await resolveExactPullRequest({
    registry,
    repository: session.repository,
    ref: acceptance.pr,
    headSha: acceptance.head_sha,
    baseSha: acceptance.base_sha,
    resolvePullRequest,
    label: 'acceptance candidate',
  });

  let candidateIssue;
  try {
    candidateIssue = await resolveControlIssue(acceptance.candidate_session);
  } catch (cause) {
    const error = new Error(`control plane evidence: candidate Session #${acceptance.candidate_session} does not resolve`);
    error.cause = cause;
    throw error;
  }
  if (!candidateIssue || Number(candidateIssue.number) !== acceptance.candidate_session || typeof candidateIssue.body !== 'string') {
    fail(`candidate Session #${acceptance.candidate_session} does not resolve exactly`);
  }
  const candidateSession = await strictAuthoritySession(
    candidateIssue,
    registry,
    resolveControlIssue,
    'acceptance candidate Session',
  );
  if (candidateSession.protocol !== SESSION_PROTOCOL_V2 || candidateSession.work_phase !== 'implementation') {
    fail('acceptance candidate Session must be a v2 implementation Session');
  }
  if (candidateSession.repository !== session.repository || candidateSession.work_item !== acceptance.work_item) {
    fail('acceptance candidate Session repository/work_item does not match acceptor');
  }
  if (candidateSession.current_pr !== acceptance.pr) fail('acceptance candidate Session current_pr does not match certificate PR');

  let candidateComment;
  try {
    candidateComment = await resolveControlComment(
      acceptance.candidate_session,
      acceptance.candidate_checkpoint_comment_id,
    );
  } catch (cause) {
    const error = new Error(`control plane evidence: candidate checkpoint comment #${acceptance.candidate_checkpoint_comment_id} does not resolve`);
    error.cause = cause;
    throw error;
  }
  const commentIssueNumber = Number(candidateComment?.issue_number ?? issueNumberFromUrl(candidateComment?.issue_url));
  if (!candidateComment
      || Number(candidateComment.id) !== acceptance.candidate_checkpoint_comment_id
      || commentIssueNumber !== acceptance.candidate_session) {
    fail('candidate checkpoint ownership does not match the referenced candidate Session');
  }

  const candidateCheckpoint = strictCheckpointFromBody(candidateComment.body, registry, candidateSession);
  if (candidateCheckpoint.protocol !== CHECKPOINT_PROTOCOL_V2 || !candidateCheckpoint.review_candidate) {
    fail('candidate checkpoint must contain one v2 review_candidate seal');
  }
  if (candidateCheckpoint.work_item !== candidateSession.work_item) {
    fail('candidate checkpoint work_item does not match candidate Session');
  }

  validateAcceptanceChronology({
    candidateIssue,
    candidateComment,
    acceptanceIssue: eventIssue,
    acceptanceComment: eventComment,
  });

  const sealed = exactCandidateTuple(candidateCheckpoint.review_candidate);
  const accepted = exactCandidateTuple(acceptance);
  if (!sameCandidateTuple(sealed, accepted)) fail('acceptance candidate tuple does not match exact implementation seal');
  if (!Array.isArray(session.claims) || session.claims.length !== 1 || session.claims[0] !== session.work_item) {
    fail('acceptance certificate requires the acceptance Session to own its exact work_item Claim at decision time');
  }
  if (typeof resolveOpenControlIssues !== 'function') {
    fail('acceptance certificate requires a current claimant resolver');
  }
  await assertWinningOpenClaim({
    eventIssue,
    session,
    resolveOpenControlIssues,
    label: 'acceptance certificate',
  });
  return true;
}

export async function validateCheckpointEventEvidence({
  event,
  registry,
  resolveCommit = defaultResolveCommit,
  resolvePullRequest = defaultResolvePullRequest,
  resolveControlIssue,
  resolveControlComment,
  resolveOpenControlIssues,
}) {
  if (!event || typeof event !== 'object') fail('GitHub event payload is required');
  if (!registry || typeof registry !== 'object') fail('registry is required');

  if (validateSessionEditImmutability(event)) {
    return { checked: true, unique_commit_evidence: 0, session_immutability_checked: true };
  }

  validateAuthorityCommentMutation(event);

  if (!['created', 'edited'].includes(event.action) || !event.comment || typeof event.comment.body !== 'string') {
    return { checked: false, unique_commit_evidence: 0 };
  }
  if (!event.comment.body.includes(AGENT_MARKER)) {
    return { checked: false, unique_commit_evidence: 0 };
  }

  let checkpoint = parseProtocolBlock(event.comment.body);
  if (!CHECKPOINT_PROTOCOLS.has(checkpoint.protocol)) {
    return { checked: false, unique_commit_evidence: 0 };
  }

  if (!event.issue || typeof event.issue.body !== 'string' || !event.issue.body.includes(AGENT_MARKER)) {
    fail('checkpoint comment is not attached to a protocol Session');
  }
  assertSessionIssue(event.issue, 'checkpoint Session');
  let session = parseProtocolBlock(event.issue.body);
  if (!SESSION_PROTOCOLS.has(session.protocol)) fail('checkpoint comment is not attached to a Session');

  const expectedCheckpointProtocol = session.protocol === SESSION_PROTOCOL_V2 ? CHECKPOINT_PROTOCOL_V2 : CHECKPOINT_PROTOCOL_V1;
  if (checkpoint.protocol !== expectedCheckpointProtocol) fail('Checkpoint protocol version must match attached Session protocol version');

  const repository = assertRegisteredSessionRepository(registry, session.repository);
  const effectiveResolveControlIssue = resolveControlIssue
    ?? ((number) => defaultResolveControlIssue(registry, number));
  if (checkpoint.protocol === CHECKPOINT_PROTOCOL_V2) {
    checkpoint = strictCheckpointFromBody(event.comment.body, registry, session);
    session = await strictAuthoritySession(event.issue, registry, effectiveResolveControlIssue, 'checkpoint Session');
    assertV2SessionForCheckpoint(session, checkpoint, event.issue.number);
  }

  const records = checkpointCommitRecords(checkpoint, repository);
  const commitResult = await validateCommitEvidence(records, resolveCommit);

  if (checkpoint.protocol === CHECKPOINT_PROTOCOL_V1) {
    return { checked: true, ...commitResult };
  }

  if (checkpoint.review_candidate && typeof resolveOpenControlIssues !== 'function') {
    fail('review candidate requires a current claimant resolver');
  }
  const reviewCandidateChecked = await validateReviewCandidateEvidence({
    checkpoint,
    session,
    eventIssue: event.issue,
    registry,
    resolvePullRequest,
    resolveOpenControlIssues,
  });
  if (reviewCandidateChecked) {
    return { checked: true, ...commitResult, review_candidate_checked: true };
  }

  const effectiveResolveControlComment = resolveControlComment
    ?? ((issueNumber, commentId) => defaultResolveControlComment(registry, issueNumber, commentId));
  const acceptanceChecked = await validateAcceptanceEvidence({
    checkpoint,
    session,
    eventIssue: event.issue,
    eventComment: event.comment,
    registry,
    resolvePullRequest,
    resolveControlIssue: effectiveResolveControlIssue,
    resolveControlComment: effectiveResolveControlComment,
    resolveOpenControlIssues,
  });
  if (acceptanceChecked) {
    return { checked: true, ...commitResult, acceptance_checked: true };
  }

  return { checked: true, ...commitResult };
}

async function listIssueComments(owner, repository, issueNumber) {
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubAgentApi(`/repos/${owner}/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) fail('issue comment API did not return an array');
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  return comments;
}

// Manual/baseline audit only. Automatic Agent Status must use --validate-event so it
// does not duplicate the existing historical Session/Checkpoint scan every run.
export async function collectCheckpointCommitEvidence({ registry, issues, listComments = listIssueComments }) {
  if (!registry || typeof registry !== 'object') fail('registry is required');
  const records = [];

  for (const issue of agentIssuesOnly(issues)) {
    const session = parseProtocolBlock(issue.body);
    if (!SESSION_PROTOCOLS.has(session.protocol)) continue;
    const repository = assertRegisteredSessionRepository(registry, session.repository);

    const comments = await listComments(registry.owner, registry.control_repository, issue.number);
    for (const comment of comments) {
      if (typeof comment.body !== 'string' || !comment.body.includes(AGENT_MARKER)) continue;
      const checkpoint = parseProtocolBlock(comment.body);
      if (!CHECKPOINT_PROTOCOLS.has(checkpoint.protocol)) continue;
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
  const timestampValue = typeof checkedAt === 'string' && checkedAt ? checkedAt : new Date().toISOString();
  const publicRunUrl = typeof runUrl === 'string' && /^https:\/\/github\.com\/netkeep80\/roadmap\/actions\/runs\/[0-9]+$/.test(runUrl)
    ? runUrl
    : null;

  return [
    '# Agent Control Plane Status',
    '',
    '> **CONTROL PLANE INVALID — DO NOT USE THE PREVIOUS SNAPSHOT FOR WORK SELECTION.**',
    '',
    `- Detected at: ${timestampValue}`,
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
    if (!process.env.GITHUB_EVENT_PATH) fail('GITHUB_EVENT_PATH is required');
    const [registry, event] = await Promise.all([
      fs.readFile(REGISTRY_PATH, 'utf8').then(JSON.parse),
      fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8').then(JSON.parse),
    ]);
    const result = await validateCheckpointEventEvidence({
      event,
      registry,
      resolveOpenControlIssues: () => listOpenControlIssues(registry.owner, registry.control_repository ?? 'roadmap'),
    });
    console.log(`control plane protocol event evidence ok: checked=${result.checked}, ${result.unique_commit_evidence} unique repository-scoped commits`);
    return;
  }

  if (process.argv.includes('--validate-live')) {
    const result = await validateLiveCheckpointCommitEvidence();
    console.log(`control plane commit evidence baseline audit ok: ${result.unique_commit_evidence} unique repository-scoped commits`);
    return;
  }

  fail('expected --validate-event, --validate-live or --render-invalid');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`ERROR: ${error.stack || error.message || String(error)}`);
    process.exitCode = 1;
  });
}
