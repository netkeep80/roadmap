import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import * as evidenceIntegrity from './agent-evidence-integrity.mjs';

const HEAD = '0123456789abcdef0123456789abcdef01234567';
const BASE = '89abcdef0123456789abcdef0123456789abcdef';

test('renders exact acceptance validation attestation bound to accepted checkpoint body', () => {
  assert.equal(
    typeof evidenceIntegrity.renderAcceptanceValidationAttestation,
    'function',
    'acceptance-success renderer must exist',
  );
  assert.equal(
    typeof evidenceIntegrity.parseAcceptanceValidationAttestation,
    'function',
    'acceptance-success parser must exist',
  );
  assert.equal(
    typeof evidenceIntegrity.acceptanceCheckpointBodySha256,
    'function',
    'acceptance checkpoint digest helper must exist',
  );

  const checkpointBody = 'exact accepted checkpoint body';
  const expectedDigest = createHash('sha256').update(checkpointBody, 'utf8').digest('hex');
  const rendered = evidenceIntegrity.renderAcceptanceValidationAttestation({
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

  assert.equal(evidenceIntegrity.acceptanceCheckpointBodySha256(checkpointBody), expectedDigest);
  assert.deepEqual(evidenceIntegrity.parseAcceptanceValidationAttestation(rendered), {
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
