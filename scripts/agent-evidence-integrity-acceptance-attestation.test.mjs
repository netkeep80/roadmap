import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  acceptanceCheckpointBodySha256,
  parseAcceptanceValidationAttestation,
  renderAcceptanceValidationAttestation,
} from './acceptance-validation-attestation.mjs';

const HEAD = '0123456789abcdef0123456789abcdef01234567';
const BASE = '89abcdef0123456789abcdef0123456789abcdef';

test('renders exact acceptance validation attestation bound to accepted checkpoint body', () => {
  const checkpointBody = 'exact accepted checkpoint body';
  const expectedDigest = createHash('sha256').update(checkpointBody, 'utf8').digest('hex');
  const rendered = renderAcceptanceValidationAttestation({
    acceptanceSession: { number: 200 },
    acceptanceComment: { id: 9001, body: checkpointBody },
    acceptance: {
      candidate_session: 176,
      candidate_checkpoint_comment_id: 8101,
      candidate_validation_attestation_comment_id: 8102,
      work_item: 'netkeep80/roadmap#182',
      pr: 'netkeep80/roadmap#184',
      head_sha: HEAD,
      base_sha: BASE,
      decision: 'accepted',
    },
  });

  assert.equal(acceptanceCheckpointBodySha256(checkpointBody), expectedDigest);
  assert.deepEqual(parseAcceptanceValidationAttestation(rendered), {
    protocol: 'roadmap-agent-acceptance-validation-attestation/v1',
    acceptance_session: 200,
    acceptance_checkpoint_comment_id: 9001,
    acceptance_checkpoint_body_sha256: expectedDigest,
    candidate_session: 176,
    candidate_checkpoint_comment_id: 8101,
    candidate_validation_attestation_comment_id: 8102,
    work_item: 'netkeep80/roadmap#182',
    pr: 'netkeep80/roadmap#184',
    head_sha: HEAD,
    base_sha: BASE,
    decision: 'accepted',
  });
});

test('acceptance validation attestation parser is closed and fail-closed', () => {
  const checkpointBody = 'exact accepted checkpoint body';
  const rendered = renderAcceptanceValidationAttestation({
    acceptanceSession: { number: 200 },
    acceptanceComment: { id: 9001, body: checkpointBody },
    acceptance: {
      candidate_session: 176,
      candidate_checkpoint_comment_id: 8101,
      candidate_validation_attestation_comment_id: 8102,
      work_item: 'netkeep80/roadmap#182',
      pr: 'netkeep80/roadmap#184',
      head_sha: HEAD,
      base_sha: BASE,
      decision: 'accepted',
    },
  });
  const block = parseAcceptanceValidationAttestation(rendered);
  const replaceBlock = (next) => rendered.replace(JSON.stringify(block, null, 2), JSON.stringify(next, null, 2));

  assert.throws(() => parseAcceptanceValidationAttestation(`${rendered}\n${rendered}`), /exactly one canonical block/);
  assert.throws(() => parseAcceptanceValidationAttestation(replaceBlock({ ...block, extra: true })), /closed protocol schema/);
  const missing = { ...block };
  delete missing.pr;
  assert.throws(() => parseAcceptanceValidationAttestation(replaceBlock(missing)), /closed protocol schema/);
  assert.throws(() => parseAcceptanceValidationAttestation(replaceBlock({ ...block, acceptance_checkpoint_body_sha256: 'bad' })), /SHA|sha|invalid/i);
  assert.throws(() => parseAcceptanceValidationAttestation(replaceBlock({ ...block, acceptance_session: 0 })), /positive integer/);
  assert.throws(() => parseAcceptanceValidationAttestation(replaceBlock({ ...block, decision: 'changes_requested' })), /decision must be accepted/);
});
