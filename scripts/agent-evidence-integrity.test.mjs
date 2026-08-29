import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateCommitEvidence,
  validateCheckpointEventEvidence,
} from './agent-evidence-integrity.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_SHA = '89abcdef0123456789abcdef0123456789abcdef';

const registry = {
  owner: 'netkeep80',
  control_repository: 'roadmap',
  repositories: [{ name: 'roadmap' }],
};

function block(data) {
  return `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n<!-- roadmap-agent:end -->`;
}

function v1SessionBody() {
  return block({
    protocol: 'roadmap-agent-session/v1',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    state: 'working',
    claims: ['netkeep80/roadmap#420'],
    current_branch: null,
    current_pr: null,
    blocked_by: [],
  });
}

function v1CheckpointBody(refs = [`commit:${SHA}`]) {
  return block({
    protocol: 'roadmap-agent-checkpoint/v1',
    state: 'working',
    completed: ['verified'],
    refs,
    blockers: [],
    next: [],
    messages: [],
  });
}

test('repository-scoped commit evidence resolves exact commits and deduplicates identical refs', async () => {
  const calls = [];
  const result = await validateCommitEvidence([
    { repository: 'netkeep80/roadmap', sha: SHA },
    { repository: 'netkeep80/roadmap', sha: SHA },
  ], async (repository, sha) => {
    calls.push([repository, sha]);
    return { sha };
  });

  assert.equal(result.unique_commit_evidence, 1);
  assert.deepEqual(calls, [['netkeep80/roadmap', SHA]]);
});

test('commit evidence fails closed when the exact commit does not resolve', async () => {
  await assert.rejects(
    () => validateCommitEvidence([
      { repository: 'netkeep80/roadmap', sha: SHA },
    ], async () => ({ sha: OTHER_SHA })),
    /different commit|does not resolve/i,
  );
});

test('v1 checkpoint event validates only changed checkpoint commit evidence', async () => {
  const calls = [];
  const result = await validateCheckpointEventEvidence({
    registry,
    event: {
      action: 'created',
      issue: {
        number: 500,
        state: 'open',
        body: v1SessionBody(),
      },
      comment: {
        id: 700,
        body: v1CheckpointBody(),
      },
    },
    resolveCommit: async (repository, sha) => {
      calls.push([repository, sha]);
      return { sha };
    },
  });

  assert.equal(result.checked, true);
  assert.equal(result.unique_commit_evidence, 1);
  assert.deepEqual(calls, [['netkeep80/roadmap', SHA]]);
});

test('non-checkpoint comments require zero commit lookups', async () => {
  let calls = 0;
  const result = await validateCheckpointEventEvidence({
    registry,
    event: {
      action: 'created',
      issue: { number: 500, state: 'open', body: v1SessionBody() },
      comment: { id: 701, body: 'ordinary comment' },
    },
    resolveCommit: async () => {
      calls += 1;
      return { sha: SHA };
    },
  });

  assert.deepEqual(result, { checked: false, unique_commit_evidence: 0 });
  assert.equal(calls, 0);
});

test('v2 Session work_item and work_phase remain immutable across edits', async () => {
  const previous = block({
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: 'netkeep80/roadmap#420',
    work_phase: 'implementation',
    state: 'working',
    claims: ['netkeep80/roadmap#420'],
    current_branch: null,
    current_pr: null,
    blocked_by: [],
  });
  const current = block({
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: 'netkeep80/roadmap#999',
    work_phase: 'implementation',
    state: 'working',
    claims: ['netkeep80/roadmap#420'],
    current_branch: null,
    current_pr: null,
    blocked_by: [],
  });

  await assert.rejects(
    () => validateCheckpointEventEvidence({
      registry,
      event: {
        action: 'edited',
        issue: { number: 500, state: 'open', body: current },
        changes: { body: { from: previous } },
      },
    }),
    /work_item.*immutable/i,
  );
});
