import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  parseAcceptancePointer,
  verifyAcceptancePointerInput,
} from './acceptance-pointer.mjs';

const START = '<!-- roadmap-agent-pr:start -->';
const END = '<!-- roadmap-agent-pr:end -->';
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const CANDIDATE_BODY = 'exact candidate checkpoint body';
const ACCEPTANCE_BODY = 'exact acceptance checkpoint body';

function sha256(body) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

function pointerV2(overrides = {}) {
  return {
    protocol: 'roadmap-agent-pr/v2',
    work_item: 'netkeep80/roadmap#182',
    pr: 'netkeep80/roadmap#184',
    candidate_session: 183,
    candidate_checkpoint_comment_id: 8101,
    candidate_validation_attestation_comment_id: 8102,
    acceptance_session: 185,
    acceptance_checkpoint_comment_id: 8201,
    acceptance_validation_attestation_comment_id: 8202,
    head_sha: HEAD,
    base_sha: BASE,
    ...overrides,
  };
}

function block(data = pointerV2()) {
  return `${START}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n${END}`;
}

function botMetadata(issueNumber) {
  return {
    issue_number: issueNumber,
    user: { login: 'github-actions[bot]', type: 'Bot' },
    provenance: { editorLogin: null, lastEditedAt: null },
  };
}

function resolvedV2(overrides = {}) {
  const pointer = pointerV2();
  return {
    pointer,
    targetPullRequest: {
      ref: pointer.pr,
      head_sha: HEAD,
      base_sha: BASE,
    },
    candidateSession: {
      number: 183,
      protocol: 'roadmap-agent-session/v2',
      work_item: pointer.work_item,
      work_phase: 'implementation',
    },
    candidateCheckpoint: {
      id: 8101,
      body: CANDIDATE_BODY,
      review_candidate: {
        work_item: pointer.work_item,
        pr: pointer.pr,
        head_sha: HEAD,
        base_sha: BASE,
      },
    },
    validationAttestation: {
      id: 8102,
      protocol: 'roadmap-agent-validation-attestation/v1',
      candidate_session: 183,
      candidate_checkpoint_comment_id: 8101,
      candidate_checkpoint_body_sha256: sha256(CANDIDATE_BODY),
      work_item: pointer.work_item,
      pr: pointer.pr,
      head_sha: HEAD,
      base_sha: BASE,
      ...botMetadata(183),
    },
    acceptanceSession: {
      number: 185,
      protocol: 'roadmap-agent-session/v2',
      work_item: pointer.work_item,
      work_phase: 'acceptance',
    },
    acceptanceCheckpoint: {
      id: 8201,
      body: ACCEPTANCE_BODY,
      acceptance: {
        candidate_session: 183,
        candidate_checkpoint_comment_id: 8101,
        candidate_validation_attestation_comment_id: 8102,
        work_item: pointer.work_item,
        pr: pointer.pr,
        head_sha: HEAD,
        base_sha: BASE,
        decision: 'accepted',
      },
    },
    acceptanceValidationAttestation: {
      id: 8202,
      protocol: 'roadmap-agent-acceptance-validation-attestation/v1',
      acceptance_session: 185,
      acceptance_checkpoint_comment_id: 8201,
      acceptance_checkpoint_body_sha256: sha256(ACCEPTANCE_BODY),
      candidate_session: 183,
      candidate_checkpoint_comment_id: 8101,
      candidate_validation_attestation_comment_id: 8102,
      work_item: pointer.work_item,
      pr: pointer.pr,
      head_sha: HEAD,
      base_sha: BASE,
      decision: 'accepted',
      ...botMetadata(185),
    },
    ...overrides,
  };
}

test('parses strict additive roadmap-agent-pr/v2 pointer', () => {
  assert.deepEqual(parseAcceptancePointer(`summary\n\n${block()}`), pointerV2());
  const missing = pointerV2();
  delete missing.acceptance_validation_attestation_comment_id;
  assert.throws(() => parseAcceptancePointer(block(missing)), /fields|acceptance_validation_attestation_comment_id/i);
  assert.throws(
    () => parseAcceptancePointer(block(pointerV2({ acceptance_validation_attestation_comment_id: 0 }))),
    /acceptance_validation_attestation_comment_id.*positive integer/i,
  );
});

test('v2 fails closed without acceptance-success attestation', () => {
  const input = resolvedV2();
  delete input.acceptanceValidationAttestation;
  assert.throws(
    () => verifyAcceptancePointerInput(input),
    /acceptance validation attestation.*required|acceptance-success/i,
  );
});

test('v2 validates candidate and acceptance successful-validation chains without granting merge authority', () => {
  const result = verifyAcceptancePointerInput(resolvedV2());
  assert.deepEqual(result, {
    protocol: 'roadmap-agent-pr/v2',
    work_item: 'netkeep80/roadmap#182',
    pr: 'netkeep80/roadmap#184',
    head_sha: HEAD,
    base_sha: BASE,
    candidate_session: 183,
    acceptance_session: 185,
    acceptance_checkpoint_comment_id: 8201,
    acceptance_validation_attestation_comment_id: 8202,
  });
  assert.equal(Object.hasOwn(result, 'integration_allowed'), false);
});

test('v2 rejects user-authored or edited acceptance-success attestation', () => {
  const userAuthored = resolvedV2();
  userAuthored.acceptanceValidationAttestation = {
    ...userAuthored.acceptanceValidationAttestation,
    user: { login: 'netkeep80', type: 'User' },
  };
  assert.throws(
    () => verifyAcceptancePointerInput(userAuthored),
    /github-actions\[bot\]|platform bot|Bot/i,
  );

  const edited = resolvedV2();
  edited.acceptanceValidationAttestation = {
    ...edited.acceptanceValidationAttestation,
    provenance: { editorLogin: 'netkeep80', lastEditedAt: '2026-08-25T19:00:00Z' },
  };
  assert.throws(
    () => verifyAcceptancePointerInput(edited),
    /edited|append-only|provenance/i,
  );
});

test('v2 rejects wrong acceptance checkpoint ownership, digest, tuple, or decision', () => {
  const cases = [
    ['ownership', (input) => { input.acceptanceValidationAttestation.issue_number = 999; }],
    ['comment', (input) => { input.acceptanceValidationAttestation.acceptance_checkpoint_comment_id = 999; }],
    ['digest', (input) => { input.acceptanceValidationAttestation.acceptance_checkpoint_body_sha256 = 'c'.repeat(64); }],
    ['Session', (input) => { input.acceptanceValidationAttestation.acceptance_session = 999; }],
    ['head', (input) => { input.acceptanceValidationAttestation.head_sha = 'c'.repeat(40); }],
    ['base', (input) => { input.acceptanceValidationAttestation.base_sha = 'c'.repeat(40); }],
    ['decision', (input) => { input.acceptanceValidationAttestation.decision = 'changes_requested'; }],
  ];
  for (const [label, mutate] of cases) {
    const input = resolvedV2();
    mutate(input);
    assert.throws(
      () => verifyAcceptancePointerInput(input),
      new RegExp(`acceptance.*(attestation|validation).*${label}|${label}.*acceptance`, 'i'),
      label,
    );
  }
});

test('v2 also requires exact candidate bot attestation digest and append-only provenance', () => {
  const badDigest = resolvedV2();
  badDigest.validationAttestation = {
    ...badDigest.validationAttestation,
    candidate_checkpoint_body_sha256: 'c'.repeat(64),
  };
  assert.throws(
    () => verifyAcceptancePointerInput(badDigest),
    /validation attestation.*digest|candidate checkpoint.*SHA/i,
  );

  const userAuthored = resolvedV2();
  userAuthored.validationAttestation = {
    ...userAuthored.validationAttestation,
    user: { login: 'netkeep80', type: 'User' },
  };
  assert.throws(
    () => verifyAcceptancePointerInput(userAuthored),
    /validation attestation.*github-actions\[bot\]|candidate.*platform bot/i,
  );
});
