import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentSnapshot, renderAgentStatus } from './agent-status.mjs';

const workerPolicy = {
  schema_version: 3,
  scope: 'public-owner-repositories',
  lease_seconds: 3600,
  heartbeat_target_seconds: 1800,
  selection_policy: 'normalized-finish-first-v1',
  no_work_action: 'exit',
  allow_speculative_work: false,
  coordinator_requires_declared_trigger: true,
  pr_reconciliation_required: true,
  branch_reconciliation_required: true,
};

const roles = [
  { issue_number: 32, repository: 'netkeep80/anum_docs', portfolio_authority: 'propose' },
];

const slots = [1, 2, 3, 4, 5].map((slot) => ({
  issue_number: 384 + slot,
  url: `https://github.com/netkeep80/roadmap/issues/${384 + slot}`,
  data: {
    protocol: 'roadmap-worker-slot/v1',
    slot,
    generation: slot === 3 ? 7 : 0,
    state: slot === 3 ? 'working' : 'idle',
    assignment: slot === 3 ? {
      repository: 'netkeep80/anum_docs',
      role_issue: 32,
      work_item: 'netkeep80/anum_docs#959',
    } : null,
    current_branch: slot === 3 ? 'observatory/959-evidence-traceability' : null,
    current_pr: slot === 3 ? 'netkeep80/anum_docs#966' : null,
    progress: slot === 3 ? {
      phase: 'ci',
      next_action: 'Inspect current CI',
    } : null,
  },
}));

test('Agent Status makes five permanent Worker Slots the primary scheduled-worker surface', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-28T10:00:00Z',
    roles,
    slots,
    sessions: [],
    messages: [],
    workerPolicy,
  });

  assert.equal(snapshot.worker_slot_count, 5);
  assert.deepEqual(snapshot.worker_slots.map((entry) => entry.slot), [1, 2, 3, 4, 5]);
  assert.equal(snapshot.worker_slots[2].assignment.work_item, 'netkeep80/anum_docs#959');

  const markdown = renderAgentStatus(snapshot);
  assert.match(markdown, /Worker Slots/i);
  assert.match(markdown, /\| Slot \| Generation \| State \| Repository \| Work item \| Branch \| PR \| Progress \|/);
  assert.match(markdown, /anum_docs#959/);
  assert.match(markdown, /#387/);
});
