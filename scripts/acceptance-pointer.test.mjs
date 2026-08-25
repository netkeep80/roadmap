import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseAcceptancePointer,
  verifyAcceptancePointerInput,
} from './acceptance-pointer.mjs';

const START = '<!-- roadmap-agent-pr:start -->';
const END = '<!-- roadmap-agent-pr:end -->';
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

function pointer(overrides = {}) {
  return {
    protocol: 'roadmap-agent-pr/v1',
    work_item: 'netkeep80/roadmap#141',
    pr: 'netkeep80/roadmap#177',
    candidate_session: 176,
    candidate_checkpoint_comment_id: 8101,
    candidate_validation_attestation_comment_id: 8102,
    acceptance_session: 178,
    acceptance_checkpoint_comment_id: 8201,
    head_sha: HEAD,
    base_sha: BASE,
    ...overrides,
  };
}

function block(data = pointer()) {
  return `${START}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n${END}`;
}

function resolved(overrides = {}) {
  const value = pointer();
  return {
    pointer: value,
    targetPullRequest: {
      ref: value.pr,
      head_sha: HEAD,
      base_sha: BASE,
    },
    candidateSession: {
      number: 176,
      protocol: 'roadmap-agent-session/v2',
      work_item: value.work_item,
      work_phase: 'implementation',
    },
    candidateCheckpoint: {
      id: 8101,
      review_candidate: {
        work_item: value.work_item,
        pr: value.pr,
        head_sha: HEAD,
        base_sha: BASE,
      },
    },
    validationAttestation: {
      id: 8102,
      candidate_session: 176,
      candidate_checkpoint_comment_id: 8101,
      work_item: value.work_item,
      pr: value.pr,
      head_sha: HEAD,
      base_sha: BASE,
    },
    acceptanceSession: {
      number: 178,
      protocol: 'roadmap-agent-session/v2',
      work_item: value.work_item,
      work_phase: 'acceptance',
    },
    acceptanceCheckpoint: {
      id: 8201,
      acceptance: {
        candidate_session: 176,
        candidate_checkpoint_comment_id: 8101,
        candidate_validation_attestation_comment_id: 8102,
        work_item: value.work_item,
        pr: value.pr,
        head_sha: HEAD,
        base_sha: BASE,
        decision: 'accepted',
      },
    },
    ...overrides,
  };
}

test('parses exactly one roadmap-agent-pr/v1 pointer block', () => {
  const data = parseAcceptancePointer(`human summary\n\n${block()}\n`);
  assert.deepEqual(data, pointer());
});

test('missing or duplicate acceptance pointer blocks fail closed', () => {
  assert.throws(
    () => parseAcceptancePointer('ordinary PR body'),
    /exactly one.*roadmap-agent-pr/i,
  );
  assert.throws(
    () => parseAcceptancePointer(`${block()}\n${block()}`),
    /exactly one.*roadmap-agent-pr/i,
  );
});

test('malformed pointer JSON and malformed bounded ids fail closed', () => {
  assert.throws(
    () => parseAcceptancePointer(`${START}\n\`\`\`json\n{not-json}\n\`\`\`\n${END}`),
    /JSON.*malformed/i,
  );
  assert.throws(
    () => parseAcceptancePointer(block(pointer({ acceptance_checkpoint_comment_id: 0 }))),
    /acceptance_checkpoint_comment_id.*positive integer/i,
  );
  assert.throws(
    () => parseAcceptancePointer(block(pointer({ head_sha: 'not-a-sha' }))),
    /head_sha.*commit SHA/i,
  );
});

test('pointer protocol and public references are exact', () => {
  assert.throws(
    () => parseAcceptancePointer(block(pointer({ protocol: 'roadmap-agent-pr/v3' }))),
    /protocol/i,
  );
  assert.throws(
    () => parseAcceptancePointer(block(pointer({ work_item: 'private/example#1' }))),
    /work_item.*public issue/i,
  );
  assert.throws(
    () => parseAcceptancePointer(block(pointer({ pr: 'netkeep80/roadmap#0' }))),
    /pr.*public issue\/PR/i,
  );
});

test('bounded verifier accepts one exact independently accepted candidate tuple', () => {
  const result = verifyAcceptancePointerInput(resolved());
  assert.deepEqual(result, {
    work_item: 'netkeep80/roadmap#141',
    pr: 'netkeep80/roadmap#177',
    head_sha: HEAD,
    base_sha: BASE,
    candidate_session: 176,
    acceptance_session: 178,
    acceptance_checkpoint_comment_id: 8201,
  });
  assert.equal(Object.hasOwn(result, 'integration_allowed'), false);
});

test('current target head/base movement makes the pointer stale', () => {
  assert.throws(
    () => verifyAcceptancePointerInput(resolved({
      targetPullRequest: {
        ref: 'netkeep80/roadmap#177',
        head_sha: 'c'.repeat(40),
        base_sha: BASE,
      },
    })),
    /target PR head.*stale|exact head/i,
  );
  assert.throws(
    () => verifyAcceptancePointerInput(resolved({
      targetPullRequest: {
        ref: 'netkeep80/roadmap#177',
        head_sha: HEAD,
        base_sha: 'c'.repeat(40),
      },
    })),
    /target PR base.*stale|exact base/i,
  );
});

test('same implementation Session cannot authorize final acceptance', () => {
  const input = resolved();
  input.pointer = pointer({ acceptance_session: 176 });
  input.acceptanceSession = {
    number: 176,
    protocol: 'roadmap-agent-session/v2',
    work_item: input.pointer.work_item,
    work_phase: 'acceptance',
  };
  assert.throws(
    () => verifyAcceptancePointerInput(input),
    /acceptance Session.*different.*candidate Session/i,
  );
});

test('mismatched candidate, attestation, or acceptance evidence fails closed', () => {
  const badCandidate = resolved();
  badCandidate.candidateCheckpoint = {
    ...badCandidate.candidateCheckpoint,
    review_candidate: {
      ...badCandidate.candidateCheckpoint.review_candidate,
      base_sha: 'c'.repeat(40),
    },
  };
  assert.throws(
    () => verifyAcceptancePointerInput(badCandidate),
    /candidate checkpoint.*base/i,
  );

  const badAttestation = resolved();
  badAttestation.validationAttestation = {
    ...badAttestation.validationAttestation,
    candidate_checkpoint_comment_id: 9999,
  };
  assert.throws(
    () => verifyAcceptancePointerInput(badAttestation),
    /attestation.*candidate checkpoint/i,
  );

  const badAcceptance = resolved();
  badAcceptance.acceptanceCheckpoint = {
    ...badAcceptance.acceptanceCheckpoint,
    acceptance: {
      ...badAcceptance.acceptanceCheckpoint.acceptance,
      decision: 'changes_requested',
    },
  };
  assert.throws(
    () => verifyAcceptancePointerInput(badAcceptance),
    /acceptance decision.*accepted/i,
  );
});
