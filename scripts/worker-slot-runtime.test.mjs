import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideSlotEntry,
  checkSlotGeneration,
  selectSlotAssignment,
  decideAssignmentAcquisition,
} from './worker-slot-runtime.mjs';

const assigned = (overrides = {}) => ({
  protocol: 'roadmap-worker-slot/v1',
  slot: 3,
  generation: 7,
  state: 'working',
  assignment: {
    repository: 'netkeep80/alpha',
    role_issue: 10,
    work_item: 'netkeep80/alpha#42',
  },
  current_branch: 'agent/42-work',
  current_pr: 'netkeep80/alpha#43',
  progress: {
    phase: 'ci',
    next_action: 'Inspect current checks',
  },
  ...overrides,
});

const idle = (overrides = {}) => ({
  protocol: 'roadmap-worker-slot/v1',
  slot: 3,
  generation: 7,
  state: 'idle',
  assignment: null,
  current_branch: null,
  current_pr: null,
  progress: null,
  ...overrides,
});

const issueCandidate = ({ repository = 'netkeep80/alpha', number = 42, priority = 'P0', continuation = false } = {}) => ({
  repository,
  work_item: `${repository}#${number}`,
  work_phase: 'implementation',
  effective_priority: priority,
  local_order: null,
  continuation,
  open: true,
  portfolio_consistent: true,
  executable_now: true,
  blocked: false,
  occupied_by_live_winner: false,
  stale_recovery_required: false,
});

const handoffCandidate = ({ repository = 'netkeep80/alpha', number = 42, priority = 'P0' } = {}) => ({
  repository,
  work_item: `${repository}#${number}`,
  work_phase: 'implementation',
  effective_priority: priority,
  local_order: null,
  continuation: true,
  valid: true,
  executable_now: true,
  occupied_by_live_winner: false,
  stale_recovery_required: false,
});

test('assigned Slot enters cheap resume path without global selection', () => {
  assert.deepEqual(decideSlotEntry({ slot: assigned(), workerSlot: 3 }), {
    action: 'resume_assignment',
    generation: 7,
    assignment: assigned().assignment,
  });
});

test('idle Slot alone enters self-dispatch path', () => {
  assert.deepEqual(decideSlotEntry({ slot: idle(), workerSlot: 3 }), {
    action: 'self_dispatch',
    generation: 7,
    assignment: null,
  });
});

test('wrong Scheduled Task slot never executes another permanent Slot', () => {
  assert.deepEqual(decideSlotEntry({ slot: assigned(), workerSlot: 4 }), {
    action: 'exit_wrong_slot',
    generation: 7,
    assignment: null,
  });
});

test('generation fence permits current invocation and rejects a delayed old invocation', () => {
  assert.deepEqual(checkSlotGeneration({
    slot: assigned(),
    workerSlot: 3,
    expectedGeneration: 7,
  }), {
    action: 'proceed',
    target_writes_allowed: true,
    slot_writes_allowed: true,
  });

  assert.deepEqual(checkSlotGeneration({
    slot: assigned({ generation: 8 }),
    workerSlot: 3,
    expectedGeneration: 7,
  }), {
    action: 'exit_stale_generation',
    target_writes_allowed: false,
    slot_writes_allowed: false,
  });
});

test('generation fence fails closed when invocation points at another Slot', () => {
  assert.deepEqual(checkSlotGeneration({
    slot: assigned(),
    workerSlot: 4,
    expectedGeneration: 7,
  }), {
    action: 'exit_wrong_slot',
    target_writes_allowed: false,
    slot_writes_allowed: false,
  });
});

test('idle self-dispatch reuses normalized priority and skips work already owned by a Slot', () => {
  const p0Owned = issueCandidate({ repository: 'netkeep80/alpha', number: 10, priority: 'P0' });
  const p1Continuation = handoffCandidate({ repository: 'netkeep80/beta', number: 20, priority: 'P1' });
  const p1New = issueCandidate({ repository: 'netkeep80/gamma', number: 30, priority: 'P1' });

  assert.deepEqual(selectSlotAssignment({
    handoffs: [p1Continuation],
    issues: [p1New, p0Owned],
    assignedWorkItems: ['netkeep80/alpha#10'],
    pendingWorkItems: [],
  }), {
    action: 'acquire_assignment',
    candidate: p1Continuation,
  });
});

test('idle self-dispatch treats pending acquisition as occupied and exits when nothing else is executable', () => {
  const candidate = issueCandidate({ repository: 'netkeep80/alpha', number: 10, priority: 'P0' });
  assert.deepEqual(selectSlotAssignment({
    issues: [candidate],
    assignedWorkItems: [],
    pendingWorkItems: ['netkeep80/alpha#10'],
  }), {
    action: 'exit_no_work',
    candidate: null,
  });
});

test('assignment acquisition winner is earliest GitHub claim and later claims can never overtake it', () => {
  const first = {
    number: 501,
    created_at: '2026-08-28T09:30:00Z',
    work_item: 'netkeep80/alpha#42',
    slot: 2,
    base_generation: 3,
  };
  const second = {
    number: 502,
    created_at: '2026-08-28T09:30:01Z',
    work_item: 'netkeep80/alpha#42',
    slot: 4,
    base_generation: 9,
  };

  assert.deepEqual(decideAssignmentAcquisition({ contender: first, claims: [first] }), {
    action: 'persist_assignment',
    winner_issue: 501,
    target_writes_allowed: false,
  });

  assert.deepEqual(decideAssignmentAcquisition({ contender: second, claims: [second, first] }), {
    action: 'close_and_reselect',
    winner_issue: 501,
    target_writes_allowed: false,
  });
});

test('assignment acquisition is scoped to one exact work item', () => {
  const contender = {
    number: 510,
    created_at: '2026-08-28T09:30:00Z',
    work_item: 'netkeep80/alpha#42',
    slot: 2,
    base_generation: 3,
  };
  const unrelated = {
    number: 500,
    created_at: '2026-08-28T09:29:00Z',
    work_item: 'netkeep80/beta#9',
    slot: 1,
    base_generation: 2,
  };

  assert.deepEqual(decideAssignmentAcquisition({ contender, claims: [unrelated, contender] }), {
    action: 'persist_assignment',
    winner_issue: 510,
    target_writes_allowed: false,
  });
});
