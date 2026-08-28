import { compareClaimPriority } from './agent-protocol.mjs';
import { selectBoundedWork } from './worker-runtime.mjs';

function fail(message) {
  throw new Error(`worker slot runtime: ${message}`);
}

function assertSlotSnapshot(slot) {
  if (!slot || Array.isArray(slot) || typeof slot !== 'object') fail('slot snapshot is required');
  if (!Number.isInteger(slot.slot) || slot.slot < 1 || slot.slot > 5) fail('slot must be an integer from 1 to 5');
  if (!Number.isInteger(slot.generation) || slot.generation < 0) fail('generation must be a non-negative integer');
  if (!['idle', 'working', 'waiting', 'blocked'].includes(slot.state)) fail('slot state is invalid');
  return slot;
}

function assertWorkerSlot(workerSlot) {
  if (!Number.isInteger(workerSlot) || workerSlot < 1 || workerSlot > 5) {
    fail('workerSlot must be an integer from 1 to 5');
  }
}

function assertStringArray(values, field) {
  if (!Array.isArray(values)) fail(`${field} must be an array`);
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) fail(`${field} entries must be non-empty strings`);
  }
  return values;
}

export function decideSlotEntry({ slot, workerSlot }) {
  const current = assertSlotSnapshot(slot);
  assertWorkerSlot(workerSlot);

  if (current.slot !== workerSlot) {
    return {
      action: 'exit_wrong_slot',
      generation: current.generation,
      assignment: null,
    };
  }

  return {
    action: current.state === 'idle' ? 'self_dispatch' : 'resume_assignment',
    generation: current.generation,
    assignment: current.state === 'idle' ? null : current.assignment,
  };
}

export function checkSlotGeneration({ slot, workerSlot, expectedGeneration }) {
  const current = assertSlotSnapshot(slot);
  assertWorkerSlot(workerSlot);
  if (!Number.isInteger(expectedGeneration) || expectedGeneration < 0) {
    fail('expectedGeneration must be a non-negative integer');
  }

  if (current.slot !== workerSlot) {
    return {
      action: 'exit_wrong_slot',
      target_writes_allowed: false,
      slot_writes_allowed: false,
    };
  }

  if (current.generation !== expectedGeneration) {
    return {
      action: 'exit_stale_generation',
      target_writes_allowed: false,
      slot_writes_allowed: false,
    };
  }

  return {
    action: 'proceed',
    target_writes_allowed: true,
    slot_writes_allowed: true,
  };
}

export function selectSlotAssignment({
  handoffs = [],
  issues = [],
  assignedWorkItems = [],
  pendingWorkItems = [],
} = {}) {
  const occupied = new Set([
    ...assertStringArray(assignedWorkItems, 'assignedWorkItems'),
    ...assertStringArray(pendingWorkItems, 'pendingWorkItems'),
  ]);

  const availableHandoffs = handoffs.filter((candidate) => !occupied.has(candidate?.work_item));
  const availableIssues = issues.filter((candidate) => !occupied.has(candidate?.work_item));
  const selected = selectBoundedWork({ handoffs: availableHandoffs, issues: availableIssues, messages: [] });
  if (selected.action === 'exit_no_work') return selected;

  return {
    action: 'acquire_assignment',
    candidate: selected.candidate,
  };
}

function assertAcquisitionClaim(claim, label) {
  if (!claim || Array.isArray(claim) || typeof claim !== 'object') fail(`${label} must be an acquisition claim`);
  if (!Number.isInteger(claim.number) || claim.number <= 0) fail(`${label}.number must be a positive integer`);
  if (!Number.isFinite(Date.parse(claim.created_at ?? ''))) fail(`${label}.created_at must be a GitHub timestamp`);
  if (typeof claim.work_item !== 'string' || !claim.work_item.trim()) fail(`${label}.work_item must be a non-empty string`);
  assertWorkerSlot(claim.slot);
  if (!Number.isInteger(claim.base_generation) || claim.base_generation < 0) {
    fail(`${label}.base_generation must be a non-negative integer`);
  }
  return claim;
}

export function decideAssignmentAcquisition({ contender, claims = [] }) {
  const current = assertAcquisitionClaim(contender, 'contender');
  if (!Array.isArray(claims)) fail('claims must be an array');

  const competitors = claims
    .map((claim, index) => assertAcquisitionClaim(claim, `claims[${index}]`))
    .filter((claim) => claim.work_item === current.work_item);

  if (!competitors.some((claim) => claim.number === current.number)) {
    fail('contender must be present in refreshed acquisition claims');
  }

  competitors.sort((left, right) => compareClaimPriority(left, right));
  const winner = competitors[0];
  return {
    action: winner.number === current.number ? 'persist_assignment' : 'close_and_reselect',
    winner_issue: winner.number,
    target_writes_allowed: false,
  };
}
