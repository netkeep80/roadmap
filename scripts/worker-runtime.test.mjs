import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as workerRuntime from './worker-runtime.mjs';
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

function workerSession({ state = 'working', createdAt = '2026-08-24T09:00:00Z', updatedAt = '2026-08-24T09:00:00Z', claims = ['netkeep80/alpha#1'], number = 10 } = {}) {
  return {
    number,
    created_at: createdAt,
    updated_at: updatedAt,
    data: { state, claims },
  };
}

function executableIssue(ref, overrides = {}) {
  return {
    ref,
    open: true,
    portfolio_consistent: true,
    executable_now: true,
    blocked: false,
    occupied_by_live_winner: false,
    stale_recovery_required: false,
    ...overrides,
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
  const issue = executableIssue('netkeep80/alpha#3');
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
      executableIssue('netkeep80/alpha#1', { blocked: true }),
      executableIssue('netkeep80/alpha#2', { occupied_by_live_winner: true }),
      executableIssue('netkeep80/alpha#3', { stale_recovery_required: true }),
    ],
  });
  assert.equal(result.action, 'exit_no_work');
  assert.equal(result.candidate, null);
});

test('live overlap skips occupied work and selects another explicit issue', () => {
  const occupied = executableIssue('netkeep80/alpha#1', { occupied_by_live_winner: true });
  const free = executableIssue('netkeep80/alpha#2');
  const result = selectBoundedWork({ handoffs: [], messages: [], issues: [occupied, free] });
  assert.equal(result.action, 'claim_issue');
  assert.equal(result.candidate.ref, 'netkeep80/alpha#2');
});

test('post-Session claim refresh allows only the deterministic winner to write target state', () => {
  assert.equal(typeof workerRuntime.decidePostSessionClaim, 'function');
  const claim = 'netkeep80/alpha#1';
  const earlier = workerSession({ number: 101, createdAt: '2026-08-24T10:00:00Z', claims: [claim] });
  const later = workerSession({ number: 102, createdAt: '2026-08-24T10:00:01Z', claims: [claim] });
  const liveClaimers = [later, earlier];

  assert.deepEqual(workerRuntime.decidePostSessionClaim({ claim, contender: earlier, liveClaimers }), {
    action: 'proceed',
    winner_session_issue: 101,
    target_writes_allowed: true,
  });
  assert.deepEqual(workerRuntime.decidePostSessionClaim({ claim, contender: later, liveClaimers }), {
    action: 'release_and_reselect_or_exit',
    winner_session_issue: 101,
    target_writes_allowed: false,
  });

  const reselection = selectBoundedWork({
    handoffs: [],
    messages: [],
    issues: [
      executableIssue(claim, { occupied_by_live_winner: true }),
      executableIssue('netkeep80/alpha#2'),
    ],
  });
  assert.equal(reselection.candidate.ref, 'netkeep80/alpha#2');
});

test('anonymous scheduled-worker bootstrap is one parameter-free prompt', async () => {
  const text = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /WORKER_SLOT|worker_slot/);
  assert.match(text, /fresh anonymous worker/i);
  assert.match(text, /after Session creation[\s\S]*refresh[\s\S]*claim/i);
  assert.match(text, /no executable work[\s\S]*zero repository changes[\s\S]*no idle Session/i);
});

test('obvious cleanup observation without an explicit work item cannot create work', () => {
  const result = selectBoundedWork({
    handoffs: [],
    messages: [],
    issues: [],
    observations: [{ kind: 'cleanup-opportunity', obvious: true }],
  });
  assert.deepEqual(result, { action: 'exit_no_work', candidate: null });
});

test('idle coordinator observations without a declared work candidate also exit', () => {
  const result = selectBoundedWork({
    role_authority: 'coordinate',
    handoffs: [],
    messages: [],
    issues: [],
    observations: [{ kind: 'interesting-idea' }],
  });
  assert.deepEqual(result, { action: 'exit_no_work', candidate: null });
});

test('same explicit GitHub candidate state produces the same bounded decision', () => {
  const input = {
    handoffs: [],
    messages: [],
    issues: [
      executableIssue('netkeep80/alpha#1', { occupied_by_live_winner: true }),
      executableIssue('netkeep80/alpha#2'),
    ],
  };
  assert.deepEqual(selectBoundedWork(structuredClone(input)), selectBoundedWork(structuredClone(input)));
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
