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
