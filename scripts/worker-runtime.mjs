import { compareClaimPriority } from './agent-protocol.mjs';

const EXPECTED_WORK_ORDER = ['handoff', 'message', 'local-issue'];
const NORMALIZED_SELECTION_POLICY = 'normalized-finish-first-v1';
const SCHEDULED_WORKER_MODEL = 'fixed-slots-v1';
const WORKER_SLOT_COUNT = 5;
const SLOT_SNAPSHOT_POLICY = 'bounded-replace-v1';
const LEASED_STATES = new Set(['starting', 'working', 'waiting', 'blocked']);
const TERMINAL_STATES = new Set(['completed', 'abandoned']);
const WORK_PHASES = new Set(['implementation']);

function fail(message) {
  throw new Error(`worker runtime: ${message}`);
}

function parseTimestamp(value, field) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) fail(`${field} must be a valid GitHub timestamp`);
  return time;
}

function assertArray(value, field) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return value;
}

function normalizeBranch(value, field) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(`${field} must be a branch object`);
  if (typeof value.repository !== 'string' || !value.repository.trim()) fail(`${field}.repository must be a non-empty string`);
  if (typeof value.name !== 'string' || !value.name.trim()) fail(`${field}.name must be a non-empty string`);
  return { repository: value.repository, name: value.name };
}

function sameBranch(left, right) {
  return left.repository === right.repository && left.name === right.name;
}

export function validateWorkerPolicy(policy) {
  if (!policy || Array.isArray(policy) || typeof policy !== 'object') fail('policy object is required');
  if (![1, 2, 3].includes(policy.schema_version)) fail('schema_version must be 1, 2, or 3');
  if (policy.scope !== 'public-owner-repositories') fail('scope must be public-owner-repositories');
  if (!Number.isInteger(policy.lease_seconds) || policy.lease_seconds <= 0) fail('lease_seconds must be a positive integer');
  if (!Number.isInteger(policy.heartbeat_target_seconds) || policy.heartbeat_target_seconds <= 0) fail('heartbeat_target_seconds must be a positive integer');
  if (policy.heartbeat_target_seconds >= policy.lease_seconds) fail('heartbeat_target_seconds must be smaller than lease_seconds');

  if (policy.schema_version === 3) {
    if (Object.prototype.hasOwnProperty.call(policy, 'work_source_order')) {
      fail('schema_version 3 forbids work_source_order source authority');
    }
    if (policy.selection_policy !== NORMALIZED_SELECTION_POLICY) {
      fail(`schema_version 3 selection_policy must be ${NORMALIZED_SELECTION_POLICY}`);
    }
  } else {
    if (!Array.isArray(policy.work_source_order) || policy.work_source_order.length !== EXPECTED_WORK_ORDER.length || policy.work_source_order.some((value, index) => value !== EXPECTED_WORK_ORDER[index])) {
      fail(`work_source_order must be ${EXPECTED_WORK_ORDER.join(' -> ')}`);
    }
  }

  if (policy.scheduled_worker_model !== undefined && policy.scheduled_worker_model !== SCHEDULED_WORKER_MODEL) {
    fail(`scheduled_worker_model must be ${SCHEDULED_WORKER_MODEL}`);
  }
  if (policy.worker_slot_count !== undefined && policy.worker_slot_count !== WORKER_SLOT_COUNT) {
    fail(`worker_slot_count must be ${WORKER_SLOT_COUNT}`);
  }
  if (policy.slot_snapshot_policy !== undefined && policy.slot_snapshot_policy !== SLOT_SNAPSHOT_POLICY) {
    fail(`slot_snapshot_policy must be ${SLOT_SNAPSHOT_POLICY}`);
  }

  if (policy.no_work_action !== 'exit') fail('no_work_action must be exit');
  if (policy.allow_speculative_work !== false) fail('allow_speculative_work must be false');
  if (policy.coordinator_requires_declared_trigger !== true) fail('coordinator_requires_declared_trigger must be true');
  if (policy.pr_reconciliation_required !== true) fail('pr_reconciliation_required must be true');
  if (policy.branch_reconciliation_required !== undefined && policy.branch_reconciliation_required !== true) {
    fail('branch_reconciliation_required must be true when present');
  }
  if (policy.schema_version >= 2 && policy.branch_reconciliation_required !== true) {
    fail(`schema_version ${policy.schema_version} requires branch_reconciliation_required=true`);
  }
  return policy;
}

function latestCheckpointTimestamp(checkpoints) {
  let latest = null;
  for (const checkpoint of assertArray(checkpoints, 'checkpoints')) {
    const time = parseTimestamp(checkpoint?.created_at, 'checkpoint created_at');
    if (!latest || time > latest.time) latest = { time, value: checkpoint.created_at };
  }
  return latest;
}

export function classifySessionLease({ session, checkpoints = [], now, policy }) {
  const checkedPolicy = validateWorkerPolicy(policy);
  if (!session || typeof session !== 'object' || !session.data || typeof session.data !== 'object') {
    fail('validated Session object is required');
  }
  const state = session.data.state;
  const claims = assertArray(session.data.claims ?? [], 'session claims');

  if (TERMINAL_STATES.has(state)) {
    return { status: 'terminal', heartbeat_at: null, age_seconds: null };
  }
  if (state === 'handoff') {
    if (claims.length) fail('handoff Session cannot retain claims');
    return { status: 'resumable_handoff', heartbeat_at: null, age_seconds: null };
  }
  if (!LEASED_STATES.has(state)) fail(`state ${JSON.stringify(state)} is not lease-classifiable`);

  const nowTime = parseTimestamp(now, 'now');
  const latestCheckpoint = latestCheckpointTimestamp(checkpoints);
  const heartbeatAt = latestCheckpoint?.value ?? session.created_at;
  const heartbeatTime = latestCheckpoint?.time ?? parseTimestamp(session.created_at, 'session created_at');
  if (heartbeatTime > nowTime) fail('authoritative heartbeat cannot be in the future');

  const ageSeconds = (nowTime - heartbeatTime) / 1000;
  return {
    status: ageSeconds <= checkedPolicy.lease_seconds ? 'live' : 'stale_candidate',
    heartbeat_at: heartbeatAt,
    age_seconds: ageSeconds,
  };
}

function firstMatching(values, predicate) {
  for (const value of assertArray(values, 'candidate collection')) {
    if (value && typeof value === 'object' && predicate(value)) return value;
  }
  return null;
}

function hasNormalizedCandidateMetadata(candidate) {
  return Boolean(candidate && typeof candidate === 'object' && (
    Object.prototype.hasOwnProperty.call(candidate, 'effective_priority')
    || Object.prototype.hasOwnProperty.call(candidate, 'work_item')
    || Object.prototype.hasOwnProperty.call(candidate, 'continuation')
    || Object.prototype.hasOwnProperty.call(candidate, 'local_order')
  ));
}

function normalizeEffectivePriority(value) {
  const match = typeof value === 'string' ? /^P(\d+)$/.exec(value) : null;
  if (!match) return null;
  return Number(match[1]);
}

function normalizeLocalOrder(value) {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeCandidate(candidate, sourceKind) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate.work_phase !== undefined && candidate.work_phase !== 'implementation') return null;
  if (candidate.work_phase !== undefined && !WORK_PHASES.has(candidate.work_phase)) return null;

  const normalized = {
    source_kind: sourceKind,
    source_ref: candidate.ref ?? null,
    repository: candidate.repository ?? null,
    work_item: candidate.work_item ?? candidate.ref ?? null,
    effective_priority: normalizeEffectivePriority(candidate.effective_priority),
    local_order: normalizeLocalOrder(candidate.local_order),
    continuation: candidate.continuation === true || sourceKind === 'handoff',
    open: candidate.open !== false,
    portfolio_consistent: candidate.portfolio_consistent !== false,
    executable_now: candidate.executable_now !== false,
    blocked: candidate.blocked === true,
    occupied_by_live_winner: candidate.occupied_by_live_winner === true,
    stale_recovery_required: candidate.stale_recovery_required === true,
    original: candidate,
  };

  if (!normalized.repository || !normalized.work_item || normalized.effective_priority === null) return null;
  return normalized;
}

function normalizedExecutable(candidate) {
  return candidate.open
    && candidate.portfolio_consistent
    && candidate.executable_now
    && !candidate.blocked
    && !candidate.occupied_by_live_winner
    && !candidate.stale_recovery_required;
}

function compareNormalizedCandidates(left, right) {
  if (left.effective_priority !== right.effective_priority) return left.effective_priority - right.effective_priority;

  if (left.local_order !== null || right.local_order !== null) {
    if (left.local_order === null) return 1;
    if (right.local_order === null) return -1;
    if (left.local_order !== right.local_order) return left.local_order - right.local_order;
  }

  if (left.continuation !== right.continuation) return left.continuation ? -1 : 1;
  if (left.repository !== right.repository) return left.repository.localeCompare(right.repository);

  const leftMatch = /#(\d+)$/.exec(left.work_item);
  const rightMatch = /#(\d+)$/.exec(right.work_item);
  const leftNumber = leftMatch ? Number(leftMatch[1]) : Number.MAX_SAFE_INTEGER;
  const rightNumber = rightMatch ? Number(rightMatch[1]) : Number.MAX_SAFE_INTEGER;
  if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  return left.work_item.localeCompare(right.work_item);
}

export function selectNormalizedWork({ handoffs = [], messages = [], issues = [] } = {}) {
  const normalized = [];
  for (const handoff of assertArray(handoffs, 'handoffs')) {
    const candidate = normalizeCandidate(handoff, 'handoff');
    if (candidate && normalizedExecutable(candidate)) normalized.push(candidate);
  }
  for (const issue of assertArray(issues, 'issues')) {
    const candidate = normalizeCandidate(issue, 'local-issue');
    if (candidate && normalizedExecutable(candidate)) normalized.push(candidate);
  }
  for (const message of assertArray(messages, 'messages')) {
    if (!message || typeof message !== 'object') continue;
    const candidate = normalizeCandidate(message.work_candidate ?? null, 'message');
    if (candidate && normalizedExecutable(candidate)) normalized.push(candidate);
  }

  normalized.sort(compareNormalizedCandidates);
  const selected = normalized[0] ?? null;
  return selected
    ? { action: selected.source_kind === 'handoff' ? 'resume_handoff' : 'claim_issue', candidate: selected.original }
    : { action: 'exit_no_work', candidate: null };
}

export function selectBoundedWork({ handoffs = [], messages = [], issues = [], observations = [] } = {}) {
  const normalizedPresent = [
    ...handoffs,
    ...issues,
    ...messages.map((message) => message?.work_candidate),
  ].some(hasNormalizedCandidateMetadata);

  if (normalizedPresent) return selectNormalizedWork({ handoffs, messages, issues });

  const handoff = firstMatching(handoffs, (item) => item.valid === true && item.executable_now === true && item.occupied_by_live_winner !== true);
  if (handoff) return { action: 'resume_handoff', candidate: handoff };

  const message = firstMatching(messages, (item) => item.actionable === true);
  if (message) return { action: 'process_message', candidate: message };

  const issue = firstMatching(issues, (item) => item.open === true
    && item.portfolio_consistent === true
    && item.executable_now === true
    && item.blocked !== true
    && item.occupied_by_live_winner !== true
    && item.stale_recovery_required !== true);
  if (issue) return { action: 'claim_issue', candidate: issue };

  assertArray(observations, 'observations');
  return { action: 'exit_no_work', candidate: null };
}

export function decideStaleRecovery({ leaseStatus, revalidation }) {
  if (leaseStatus !== 'stale_candidate') return { action: 'not_applicable' };
  if (!revalidation || revalidation.complete !== true) return { action: 'revalidate' };
  if (revalidation.work_still_executable !== true || revalidation.occupied_by_live_winner === true) {
    return { action: 'abandon_without_resume' };
  }
  return { action: 'abandon_then_replace' };
}

export function decidePostSessionClaim({ claim, contender, liveClaimers }) {
  if (typeof claim !== 'string' || !claim.trim()) fail('claim must be a non-empty string');
  if (!contender || typeof contender !== 'object') fail('contender Session is required');
  const matching = assertArray(liveClaimers, 'liveClaimers')
    .filter((session) => Array.isArray(session?.data?.claims) && session.data.claims.includes(claim))
    .sort(compareClaimPriority);
  if (!matching.length) fail('post-Session refresh must include at least one LIVE claimer for the claim');
  const winner = matching[0];
  const contenderNumber = contender.number;
  const winnerNumber = winner.number;
  if (!Number.isInteger(contenderNumber) || !Number.isInteger(winnerNumber)) fail('Session issue numbers are required');
  return contenderNumber === winnerNumber
    ? { action: 'proceed', winner_session_issue: winnerNumber, target_writes_allowed: true }
    : { action: 'release_and_reselect_or_exit', winner_session_issue: winnerNumber, target_writes_allowed: false };
}

export function decideBranchPreparation({
  claimWon,
  workPhase = 'implementation',
  currentBranch,
  intendedBranch,
  branchExists,
  matchingOpenPr,
}) {
  if (claimWon !== true) {
    return {
      action: 'stop_collision_loser',
      target_writes_allowed: false,
      branch_create_allowed: false,
      branch_reuse_allowed: false,
    };
  }
  if (!WORK_PHASES.has(workPhase)) fail('branch preparation is implementation-only');

  if (currentBranch) {
    const owned = normalizeBranch(currentBranch, 'currentBranch');
    if (matchingOpenPr?.head_branch && matchingOpenPr.head_branch !== owned.name) {
      return { action: 'fail_closed_branch_pr_mismatch', target_writes_allowed: false, current_branch: owned };
    }
    return branchExists
      ? { action: 'reuse_owned_branch', target_writes_allowed: true, branch_create_allowed: false, branch_reuse_allowed: true, current_branch: owned }
      : { action: 'create_owned_branch', target_writes_allowed: true, branch_create_allowed: true, branch_reuse_allowed: false, current_branch: owned };
  }

  const intended = normalizeBranch(intendedBranch, 'intendedBranch');
  return {
    action: 'persist_branch_before_target_write',
    target_writes_allowed: false,
    branch_create_allowed: false,
    branch_reuse_allowed: false,
    current_branch: intended,
  };
}

export function decideImplementationBranchTakeover({ predecessor, successor }) {
  if (!predecessor || !successor || typeof predecessor !== 'object' || typeof successor !== 'object') fail('predecessor and successor are required');
  if (predecessor.work_phase !== 'implementation' || successor.work_phase !== 'implementation') fail('implementation branch takeover is implementation-only');
  if (predecessor.state !== 'handoff' || !Array.isArray(predecessor.claims) || predecessor.claims.length !== 0) fail('predecessor must be claim-free handoff');
  if (successor.claim_won !== true) fail('successor must be winning claimant');

  const predecessorBranch = normalizeBranch(predecessor.current_branch, 'predecessor.current_branch');
  if (!successor.current_branch) {
    return {
      action: 'persist_successor_branch',
      current_branch: predecessorBranch,
      predecessor_clear_allowed: false,
      target_writes_allowed: false,
    };
  }

  const successorBranch = normalizeBranch(successor.current_branch, 'successor.current_branch');
  if (!sameBranch(predecessorBranch, successorBranch)) {
    return {
      action: 'fail_closed_branch_mismatch',
      predecessor_clear_allowed: false,
      target_writes_allowed: false,
    };
  }

  if (successor.post_adoption_refreshed !== true || predecessor.still_handoff !== true || predecessor.claims_still_empty !== true || successor.still_winning_claimant !== true) {
    return {
      action: 'refresh_after_adoption',
      predecessor_clear_allowed: false,
      target_writes_allowed: false,
    };
  }

  return {
    action: 'complete_predecessor_then_continue',
    predecessor_clear_allowed: true,
    target_writes_allowed: true,
    current_branch: successorBranch,
  };
}
