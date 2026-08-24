const EXPECTED_WORK_ORDER = ['handoff', 'message', 'local-issue'];
const LEASED_STATES = new Set(['starting', 'working', 'waiting', 'blocked']);
const TERMINAL_STATES = new Set(['completed', 'abandoned']);

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

export function validateWorkerPolicy(policy) {
  if (!policy || Array.isArray(policy) || typeof policy !== 'object') fail('policy object is required');
  if (policy.schema_version !== 1) fail('schema_version must be 1');
  if (policy.scope !== 'public-owner-repositories') fail('scope must be public-owner-repositories');
  if (!Number.isInteger(policy.lease_seconds) || policy.lease_seconds <= 0) fail('lease_seconds must be a positive integer');
  if (!Number.isInteger(policy.heartbeat_target_seconds) || policy.heartbeat_target_seconds <= 0) fail('heartbeat_target_seconds must be a positive integer');
  if (policy.heartbeat_target_seconds >= policy.lease_seconds) fail('heartbeat_target_seconds must be smaller than lease_seconds');
  if (!Array.isArray(policy.work_source_order) || policy.work_source_order.length !== EXPECTED_WORK_ORDER.length || policy.work_source_order.some((value, index) => value !== EXPECTED_WORK_ORDER[index])) {
    fail(`work_source_order must be ${EXPECTED_WORK_ORDER.join(' -> ')}`);
  }
  if (policy.no_work_action !== 'exit') fail('no_work_action must be exit');
  if (policy.allow_speculative_work !== false) fail('allow_speculative_work must be false');
  if (policy.coordinator_requires_declared_trigger !== true) fail('coordinator_requires_declared_trigger must be true');
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

export function selectBoundedWork({ handoffs = [], messages = [], issues = [] } = {}) {
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
