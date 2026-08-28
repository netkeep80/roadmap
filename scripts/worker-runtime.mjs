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

function normalizeWorkCandidate(candidate, source) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (typeof candidate.repository !== 'string' || !candidate.repository.trim()) return null;
  if (typeof candidate.work_item !== 'string') return null;
  const match = /^([^#]+)#([1-9]\d*)$/.exec(candidate.work_item);
  if (!match || match[1] !== candidate.repository) return null;
  if (!WORK_PHASES.has(candidate.work_phase)) return null;

  const priority = normalizeEffectivePriority(candidate.effective_priority);
  if (priority === null) return null;

  const localOrder = candidate.local_order ?? null;
  if (localOrder !== null && (!Number.isInteger(localOrder) || localOrder < 0)) return null;

  const continuation = candidate.continuation === true;
  const executable = source === 'handoff'
    ? candidate.valid === true
      && candidate.executable_now === true
      && candidate.occupied_by_live_winner !== true
      && candidate.stale_recovery_required !== true
    : candidate.open === true
      && candidate.portfolio_consistent === true
      && candidate.executable_now === true
      && candidate.blocked !== true
      && candidate.occupied_by_live_winner !== true
      && candidate.stale_recovery_required !== true;
  if (!executable) return null;

  return {
    original: candidate,
    source,
    priority,
    local_order: localOrder,
    continuation,
    repository: candidate.repository,
    issue_number: Number(match[2]),
  };
}

function compareNormalizedCandidates(left, right) {
  if (left.priority !== right.priority) return left.priority - right.priority;

  const leftOrder = left.local_order ?? Number.POSITIVE_INFINITY;
  const rightOrder = right.local_order ?? Number.POSITIVE_INFINITY;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  if (left.continuation !== right.continuation) return left.continuation ? -1 : 1;

  const repositoryOrder = left.repository.localeCompare(right.repository, 'en');
  if (repositoryOrder !== 0) return repositoryOrder;
  return left.issue_number - right.issue_number;
}

function selectNormalizedWork({ handoffs, issues }) {
  const ranked = [];
  for (const candidate of assertArray(handoffs, 'handoffs')) {
    const normalized = normalizeWorkCandidate(candidate, 'handoff');
    if (normalized) ranked.push(normalized);
  }
  for (const candidate of assertArray(issues, 'issues')) {
    const normalized = normalizeWorkCandidate(candidate, 'issue');
    if (normalized) ranked.push(normalized);
  }

  ranked.sort(compareNormalizedCandidates);
  const winner = ranked[0];
  if (!winner) return { action: 'exit_no_work', candidate: null };
  return {
    action: winner.continuation ? 'resume_handoff' : 'claim_issue',
    candidate: winner.original,
  };
}

export function selectBoundedWork({ handoffs = [], messages = [], issues = [] } = {}) {
  assertArray(handoffs, 'handoffs');
  assertArray(messages, 'messages');
  assertArray(issues, 'issues');

  const normalizedMode = [...handoffs, ...issues].some(hasNormalizedCandidateMetadata);
  if (normalizedMode) {
    // Messages are state/evidence inputs in v3 and never form a competing queue.
    return selectNormalizedWork({ handoffs, issues });
  }

  // Historical v1/v2 runtime fixtures remain migration-readable only. New v3
  // autonomous selection always supplies normalized WorkCandidate metadata.
  const handoff = firstMatching(handoffs, (candidate) => (
    candidate.valid === true
    && candidate.executable_now === true
    && candidate.occupied_by_live_winner !== true
  ));
  if (handoff) return { action: 'resume_handoff', candidate: handoff };

  const message = firstMatching(messages, (candidate) => candidate.actionable === true);
  if (message) return { action: 'process_message', candidate: message };

  const issue = firstMatching(issues, (candidate) => (
    candidate.open === true
    && candidate.portfolio_consistent === true
    && candidate.executable_now === true
    && candidate.blocked !== true
    && candidate.occupied_by_live_winner !== true
    && candidate.stale_recovery_required !== true
  ));
  if (issue) return { action: 'claim_issue', candidate: issue };

  return { action: 'exit_no_work', candidate: null };
}

export function decidePostSessionClaim({ claim, contender, liveClaimers = [] }) {
  if (typeof claim !== 'string' || !claim.trim()) fail('post-Session claim must be a non-empty string');
  if (!contender || !Number.isInteger(contender.number) || !Number.isFinite(Date.parse(contender.created_at ?? ''))) {
    fail('post-Session contender requires GitHub Session issue number and created_at');
  }

  const claimers = assertArray(liveClaimers, 'live claimers').filter((session) => (
    session
    && Number.isInteger(session.number)
    && Number.isFinite(Date.parse(session.created_at ?? ''))
    && Array.isArray(session.data?.claims)
    && session.data.claims.includes(claim)
  ));
  if (!claimers.some((session) => session.number === contender.number)) {
    fail('post-Session contender must be present in refreshed live claimers');
  }

  const ordered = [...claimers].sort((left, right) => compareClaimPriority(
    { created_at: left.created_at, number: left.number },
    { created_at: right.created_at, number: right.number },
  ));
  const winner = ordered[0];
  if (winner.number === contender.number) {
    return {
      action: 'proceed',
      winner_session_issue: winner.number,
      target_writes_allowed: true,
    };
  }
  return {
    action: 'release_and_reselect_or_exit',
    winner_session_issue: winner.number,
    target_writes_allowed: false,
  };
}

export function decideBranchPreparation({
  claimWon,
  workPhase = 'implementation',
  currentBranch = null,
  intendedBranch,
  branchExists,
  matchingOpenPr = null,
}) {
  if (workPhase !== 'implementation') fail('workPhase must be implementation');

  const intended = normalizeBranch(intendedBranch, 'intendedBranch');
  const current = currentBranch === null ? null : normalizeBranch(currentBranch, 'currentBranch');
  if (typeof branchExists !== 'boolean') fail('branchExists must be boolean');

  if (claimWon !== true) {
    return {
      action: 'claim_not_won',
      current_branch: current ?? intended,
      branch_creation_allowed: false,
      target_writes_allowed: false,
    };
  }

  if (current === null) {
    return {
      action: 'persist_current_branch',
      current_branch: intended,
      branch_creation_allowed: false,
      target_writes_allowed: false,
    };
  }

  if (!sameBranch(current, intended)) {
    fail('intended branch must match durable currentBranch ownership before target writes');
  }

  if (!branchExists) {
    if (matchingOpenPr !== null) fail('open PR cannot be reused while its owned branch is absent');
    return {
      action: 'create_owned_branch',
      current_branch: current,
      branch_creation_allowed: true,
      target_writes_allowed: true,
    };
  }

  if (matchingOpenPr === null) {
    return {
      action: 'reuse_owned_pre_pr_branch',
      current_branch: current,
      branch_creation_allowed: false,
      target_writes_allowed: true,
    };
  }

  return {
    action: 'reuse_owned_branch_and_pr',
    current_branch: current,
    branch_creation_allowed: false,
    target_writes_allowed: true,
  };
}

export function decideImplementationBranchTakeover({
  predecessor,
  successor,
  revalidatedAfterAdoption = false,
}) {
  if (!predecessor || predecessor.work_phase !== 'implementation' || predecessor.state !== 'handoff') {
    fail('implementation takeover requires an implementation handoff predecessor');
  }
  if (!Array.isArray(predecessor.claims) || predecessor.claims.length !== 0) {
    fail('implementation handoff predecessor must be claim-free');
  }
  const predecessorBranch = normalizeBranch(predecessor.current_branch, 'predecessor.current_branch');

  if (!successor || successor.work_phase !== 'implementation' || successor.claim_won !== true) {
    fail('implementation takeover requires a winning implementation successor');
  }

  if (successor.current_branch === null || successor.current_branch === undefined) {
    return {
      action: 'persist_successor_branch',
      current_branch: predecessorBranch,
      predecessor_clear_allowed: false,
      target_writes_allowed: false,
    };
  }

  const successorBranch = normalizeBranch(successor.current_branch, 'successor.current_branch');
  if (!sameBranch(predecessorBranch, successorBranch)) {
    fail('implementation successor must adopt the exact predecessor branch');
  }

  if (revalidatedAfterAdoption !== true) {
    return {
      action: 'refresh_before_predecessor_clear',
      current_branch: successorBranch,
      predecessor_clear_allowed: false,
      target_writes_allowed: false,
    };
  }

  return {
    action: 'clear_predecessor_branch',
    current_branch: successorBranch,
    predecessor_clear_allowed: true,
    target_writes_allowed: false,
  };
}

export function decideStaleRecovery({ leaseStatus, revalidation }) {
  if (leaseStatus !== 'stale_candidate') fail('stale recovery requires stale_candidate lease status');
  if (!revalidation || revalidation.complete !== true) {
    return { action: 'revalidate', reason: 'current GitHub state must be completely revalidated' };
  }
  if (revalidation.work_still_executable !== true) {
    return { action: 'abandon_without_resume', reason: 'current GitHub state no longer permits the stale work' };
  }
  if (revalidation.occupied_by_live_winner === true) {
    return { action: 'abandon_without_resume', reason: 'a live winning Session currently occupies the work' };
  }
  return { action: 'abandon_then_replace', reason: 'work remains executable after complete GitHub revalidation' };
}
