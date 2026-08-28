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

test('scheduled worker docs use normalized rank rather than source-type queue', async () => {
  const text = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  assert.match(text, /P0[^\n]*P1[^\n]*P2|declared priority/i);
  assert.doesNotMatch(
    text,
    /Selection order is fixed:[\s\S]*valid executable handoff[\s\S]*actionable incoming Message[\s\S]*existing executable open local issue/i,
  );
  assert.match(text, /source type[^\n]*not[^\n]*priority|source[^\n]*not[^\n]*priority/i);
});

test('scheduled worker bootstrap fails closed before selection on invalid current control state', async () => {
  const scheduled = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../AGENT_PROTOCOL.md', import.meta.url), 'utf8');

  assert.match(scheduled, /EXIT_CONTROL_PLANE_INVALID/);
  assert.match(scheduled, /current operational[^\n]*protocol/i);
  assert.match(scheduled, /before[^\n]*(work selection|selecting work|Session creation)/i);
  assert.match(scheduled, /full closed-history forensic audit/i);
  assert.match(protocol, /Malformed JSON[^\n]*fail closed/i);
});
