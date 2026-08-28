import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideSlotEntry,
  checkSlotGeneration,
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
