import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifySessionLease,
  decideStaleRecovery,
  selectBoundedWork,
  validateWorkerPolicy,
} from './worker-runtime.mjs';

const rawPolicy = {
  schema_version: 1,
  scope: 'public-owner-repositories',
  lease_seconds: 7200,
  heartbeat_target_seconds: 3600,
  work_source_order: ['handoff', 'message', 'local-issue'],
  no_work_action: 'exit',
  allow_speculative_work: false,
  coordinator_requires_declared_trigger: true,
};

const policy = () => validateWorkerPolicy(structuredClone(rawPolicy));

function workerSession({ state = 'working', createdAt = '2026-08-24T09:00:00Z', updatedAt = '2026-08-24T09:00:00Z', claims = ['netkeep80/alpha#1'] } = {}) {
  return {
    number: 10,
    created_at: createdAt,
    updated_at: updatedAt,
    data: { state, claims },
  };
}

test('validateWorkerPolicy accepts exact bounded public scheduled-worker policy', () => {
  assert.deepEqual(validateWorkerPolicy(structuredClone(rawPolicy)), rawPolicy);
});

test('validateWorkerPolicy rejects speculative work and non-exit idle policy', () => {
  assert.throws(() => validateWorkerPolicy({ ...rawPolicy, allow_speculative_work: true }), /speculative|false/i);
  assert.throws(() => validateWorkerPolicy({ ...rawPolicy, no_work_action: 'invent' }), /no_work|exit/i);
});

test('latest valid checkpoint server timestamp controls LIVE versus STALE_CANDIDATE', () => {
  const session = workerSession();
  const checkpoints = [{ created_at: '2026-08-24T10:00:00Z', data: { state: 'working' } }];

  const live = classifySessionLease({ session, checkpoints, now: '2026-08-24T11:59:59Z', policy: policy() });
  const stale = classifySessionLease({ session, checkpoints, now: '2026-08-24T12:00:01Z', policy: policy() });

  assert.equal(live.status, 'live');
  assert.equal(live.heartbeat_at, '2026-08-24T10:00:00Z');
  assert.equal(stale.status, 'stale_candidate');
});

test('session created_at is authoritative before first checkpoint and updated_at is not a heartbeat', () => {
  const session = workerSession({
    createdAt: '2026-08-24T09:00:00Z',
    updatedAt: '2026-08-24T12:59:59Z',
  });
  const result = classifySessionLease({ session, checkpoints: [], now: '2026-08-24T11:00:01Z', policy: policy() });
  assert.equal(result.heartbeat_at, '2026-08-24T09:00:00Z');
  assert.equal(result.status, 'stale_candidate');
});

test('handoff is resumable but not a running executor and terminal states are terminal', () => {
  const handoff = classifySessionLease({
    session: workerSession({ state: 'handoff', claims: [] }),
    checkpoints: [],
    now: '2026-08-24T18:00:00Z',
    policy: policy(),
  });
  const completed = classifySessionLease({
    session: workerSession({ state: 'completed', claims: [] }),
    checkpoints: [],
    now: '2026-08-24T18:00:00Z',
    policy: policy(),
  });
  assert.equal(handoff.status, 'resumable_handoff');
  assert.equal(completed.status, 'terminal');
});

test('no explicit executable candidate returns exit_no_work', () => {
  assert.deepEqual(selectBoundedWork({ handoffs: [], messages: [], issues: [] }), {
    action: 'exit_no_work',
    candidate: null,
  });
});

test('bounded selection honors handoff then message then local issue', () => {
  const issue = {
    ref: 'netkeep80/alpha#3',
    open: true,
    portfolio_consistent: true,
    executable_now: true,
    blocked: false,
    occupied_by_live_winner: false,
    stale_recovery_required: false,
  };
  const message = { ref: 'netkeep80/roadmap#20', actionable: true };
  const handoff = { ref: 'netkeep80/roadmap#21', valid: true, executable_now: true, occupied_by_live_winner: false };

  assert.equal(selectBoundedWork({ handoffs: [handoff], messages: [message], issues: [issue] }).action, 'resume_handoff');
  assert.equal(selectBoundedWork({ handoffs: [], messages: [message], issues: [issue] }).action, 'process_message');
  assert.equal(selectBoundedWork({ handoffs: [], messages: [], issues: [issue] }).action, 'claim_issue');
});

test('bounded selection never chooses blocked, live-occupied or stale-recovery local issues', () => {
  const result = selectBoundedWork({
    handoffs: [],
    messages: [],
    issues: [
      { ref: 'netkeep80/alpha#1', open: true, portfolio_consistent: true, executable_now: true, blocked: true, occupied_by_live_winner: false, stale_recovery_required: false },
      { ref: 'netkeep80/alpha#2', open: true, portfolio_consistent: true, executable_now: true, blocked: false, occupied_by_live_winner: true, stale_recovery_required: false },
      { ref: 'netkeep80/alpha#3', open: true, portfolio_consistent: true, executable_now: true, blocked: false, occupied_by_live_winner: false, stale_recovery_required: true },
    ],
  });
  assert.equal(result.action, 'exit_no_work');
  assert.equal(result.candidate, null);
});

test('stale work cannot resume before complete GitHub revalidation', () => {
  assert.equal(decideStaleRecovery({ leaseStatus: 'stale_candidate', revalidation: null }).action, 'revalidate');
  assert.equal(decideStaleRecovery({ leaseStatus: 'stale_candidate', revalidation: { complete: false } }).action, 'revalidate');
});

test('stale revalidation follows current GitHub instead of stale checkpoint intent', () => {
  assert.equal(decideStaleRecovery({
    leaseStatus: 'stale_candidate',
    revalidation: { complete: true, work_still_executable: false, occupied_by_live_winner: false },
  }).action, 'abandon_without_resume');

  assert.equal(decideStaleRecovery({
    leaseStatus: 'stale_candidate',
    revalidation: { complete: true, work_still_executable: true, occupied_by_live_winner: true },
  }).action, 'abandon_without_resume');

  assert.equal(decideStaleRecovery({
    leaseStatus: 'stale_candidate',
    revalidation: { complete: true, work_still_executable: true, occupied_by_live_winner: false },
  }).action, 'abandon_then_replace');
});
