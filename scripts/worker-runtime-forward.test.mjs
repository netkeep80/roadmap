import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as workerRuntime from './worker-runtime.mjs';

function normalizedIssue(ref, effectivePriority, overrides = {}) {
  return {
    ref,
    repository: ref.split('#')[0],
    work_item: ref,
    work_phase: 'implementation',
    effective_priority: effectivePriority,
    local_order: null,
    continuation: false,
    open: true,
    portfolio_consistent: true,
    executable_now: true,
    blocked: false,
    occupied_by_live_winner: false,
    stale_recovery_required: false,
    ...overrides,
  };
}

const implementationBranch = {
  repository: 'netkeep80/alpha',
  name: 'agent/issue-7',
};

test('forward normalized selector rejects acceptance-phase work', () => {
  const selected = workerRuntime.selectBoundedWork({
    issues: [normalizedIssue('netkeep80/alpha#7', 'P0', { work_phase: 'acceptance' })],
  });
  assert.deepEqual(selected, { action: 'exit_no_work', candidate: null });
});

test('forward branch preparation rejects acceptance phase', () => {
  assert.throws(() => workerRuntime.decideBranchPreparation({
    claimWon: true,
    workPhase: 'acceptance',
    currentBranch: null,
    intendedBranch: implementationBranch,
    branchExists: true,
    matchingOpenPr: { number: 8 },
  }), /implementation/i);
});

test('forward runtime exposes no independent acceptance outcome authority', () => {
  assert.equal(workerRuntime.decideAcceptanceOutcome, undefined);
});

test('scheduled worker docs keep deterministic normalized rank only for idle self-dispatch', async () => {
  const text = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  assert.match(text, /P0[^\n]*P1[^\n]*P2|declared priority/i);
  assert.match(text, /idle[\s\S]*self-dispatch/i);
  assert.match(text, /assigned[\s\S]*do not[\s\S]*(global|select).*work/i);
  assert.doesNotMatch(
    text,
    /Selection order is fixed:[\s\S]*valid executable handoff[\s\S]*actionable incoming Message[\s\S]*existing executable open local issue/i,
  );
  assert.match(text, /source type[^\n]*not[^\n]*priority|source[^\n]*not[^\n]*priority/i);
});

test('scheduled worker hot path is Slot-first rather than portfolio-wide Session recovery', async () => {
  const scheduled = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../AGENT_PROTOCOL.md', import.meta.url), 'utf8');

  assert.match(scheduled, /permanent Worker Slot|Worker Slot issue/i);
  assert.match(scheduled, /snapshot[^\n]*(best-effort|may be stale|cache)|best-effort[^\n]*snapshot/i);
  assert.match(scheduled, /target Issue[\s\S]*(branch|Git)[\s\S]*PR[\s\S]*CI/i);
  assert.match(scheduled, /do not[^\n]*(repair|synchroni[sz]e).*Slot|no[^\n]*repair phase/i);
  assert.doesNotMatch(scheduled, /Reconstruct current Role\/Session\/Checkpoint\/Claim\/Message\/portfolio state/i);
  assert.doesNotMatch(scheduled, /Before finishing meaningful work, leave a durable Checkpoint/i);
  assert.match(protocol, /historical[^\n]*(Session|Checkpoint)|compatib/i);
});

test('scheduled worker docs validate candidate Slot snapshots before persistence and bound repeated infrastructure blockers', async () => {
  const scheduled = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  assert.match(scheduled, /validate[^\n]*(candidate|snapshot)[^\n]*(before|prior)[^\n]*(write|persist)|before[^\n]*(write|persist)[^\n]*validate[^\n]*(candidate|snapshot)/i);
  assert.match(scheduled, /current_pr[^\n]*netkeep80\/[^#\s]+#(?:N|<number>|[0-9]+)/i);
  assert.match(scheduled, /external_blocker_runs/i);
  assert.match(scheduled, /(second|2nd|two consecutive|2 consecutive)[^\n]*(same|identical)[^\n]*(blocker|infrastructure)[^\n]*(release|idle)/i);
  assert.match(scheduled, /(CI|review)[^\n]*(does not|do not|not)[^\n]*count/i);
});

test('machine worker policy declares the fixed five-slot forward model', async () => {
  const policy = JSON.parse(await readFile(new URL('../data/worker-policy.json', import.meta.url), 'utf8'));
  assert.equal(policy.scheduled_worker_model, 'fixed-slots-v1');
  assert.equal(policy.worker_slot_count, 5);
  assert.equal(policy.slot_snapshot_policy, 'bounded-replace-v1');
  assert.doesNotThrow(() => workerRuntime.validateWorkerPolicy(policy));

  assert.throws(() => workerRuntime.validateWorkerPolicy({
    ...policy,
    worker_slot_count: 4,
  }), /worker_slot_count|five|5/i);
});
