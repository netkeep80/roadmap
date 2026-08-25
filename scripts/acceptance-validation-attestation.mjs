import { createHash } from 'node:crypto';

const PROTOCOL = 'roadmap-agent-acceptance-validation-attestation/v1';
const START = '<!-- roadmap-agent-acceptance-validation-attestation:start -->';
const END = '<!-- roadmap-agent-acceptance-validation-attestation:end -->';
const SHA = /^[0-9a-f]{40,64}$/i;
const DIGEST = /^[0-9a-f]{64}$/;
const FIELDS = [
  'protocol',
  'acceptance_session',
  'acceptance_checkpoint_comment_id',
  'acceptance_checkpoint_body_sha256',
  'candidate_session',
  'candidate_checkpoint_comment_id',
  'candidate_validation_attestation_comment_id',
  'work_item',
  'pr',
  'head_sha',
  'base_sha',
  'decision',
];

function fail(message) {
  throw new Error(`acceptance validation attestation: ${message}`);
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function sha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) fail(`${label} must be a commit SHA`);
  return value.toLowerCase();
}

function reference(value, label) {
  if (typeof value !== 'string' || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function exactFields(data) {
  const keys = Object.keys(data).sort();
  const expected = [...FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail('fields must match the closed protocol schema exactly');
  }
}

export function acceptanceCheckpointBodySha256(body) {
  if (typeof body !== 'string') fail('acceptance checkpoint body must be a string');
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function renderAcceptanceValidationAttestation({ acceptanceSession, acceptanceComment, acceptance } = {}) {
  const acceptanceSessionNumber = positiveInteger(Number(acceptanceSession?.number), 'acceptance_session');
  const acceptanceCommentId = positiveInteger(Number(acceptanceComment?.id), 'acceptance_checkpoint_comment_id');
  if (typeof acceptanceComment?.body !== 'string') fail('acceptance checkpoint body must be a string');
  if (!acceptance || Array.isArray(acceptance) || typeof acceptance !== 'object') fail('acceptance must be an object');
  if (acceptance.decision !== 'accepted') fail('decision must be accepted');

  const data = {
    protocol: PROTOCOL,
    acceptance_session: acceptanceSessionNumber,
    acceptance_checkpoint_comment_id: acceptanceCommentId,
    acceptance_checkpoint_body_sha256: acceptanceCheckpointBodySha256(acceptanceComment.body),
    candidate_session: positiveInteger(acceptance.candidate_session, 'candidate_session'),
    candidate_checkpoint_comment_id: positiveInteger(acceptance.candidate_checkpoint_comment_id, 'candidate_checkpoint_comment_id'),
    candidate_validation_attestation_comment_id: positiveInteger(
      acceptance.candidate_validation_attestation_comment_id,
      'candidate_validation_attestation_comment_id',
    ),
    work_item: reference(acceptance.work_item, 'work_item'),
    pr: reference(acceptance.pr, 'pr'),
    head_sha: sha(acceptance.head_sha, 'head_sha'),
    base_sha: sha(acceptance.base_sha, 'base_sha'),
    decision: 'accepted',
  };

  return `${START}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n${END}`;
}

export function parseAcceptanceValidationAttestation(body) {
  if (typeof body !== 'string') fail('body must be a string');
  if (countOccurrences(body, START) !== 1 || countOccurrences(body, END) !== 1) {
    fail('body must contain exactly one canonical block');
  }
  const start = body.indexOf(START) + START.length;
  const end = body.indexOf(END, start);
  if (end < start) fail('markers are malformed');
  const fenced = /^```json\s*\n([\s\S]*?)\n```$/.exec(body.slice(start, end).trim());
  if (!fenced) fail('block must contain exactly one fenced json object');

  let data;
  try {
    data = JSON.parse(fenced[1]);
  } catch (error) {
    fail(`JSON is malformed: ${error.message}`);
  }
  if (!data || Array.isArray(data) || typeof data !== 'object') fail('JSON must be an object');
  exactFields(data);
  if (data.protocol !== PROTOCOL) fail('protocol is invalid');
  positiveInteger(data.acceptance_session, 'acceptance_session');
  positiveInteger(data.acceptance_checkpoint_comment_id, 'acceptance_checkpoint_comment_id');
  if (typeof data.acceptance_checkpoint_body_sha256 !== 'string' || !DIGEST.test(data.acceptance_checkpoint_body_sha256)) {
    fail('acceptance_checkpoint_body_sha256 is invalid');
  }
  positiveInteger(data.candidate_session, 'candidate_session');
  positiveInteger(data.candidate_checkpoint_comment_id, 'candidate_checkpoint_comment_id');
  positiveInteger(data.candidate_validation_attestation_comment_id, 'candidate_validation_attestation_comment_id');
  reference(data.work_item, 'work_item');
  reference(data.pr, 'pr');
  data.head_sha = sha(data.head_sha, 'head_sha');
  data.base_sha = sha(data.base_sha, 'base_sha');
  if (data.decision !== 'accepted') fail('decision must be accepted');
  return data;
}

export const ACCEPTANCE_VALIDATION_ATTESTATION_PROTOCOL = PROTOCOL;
export const ACCEPTANCE_VALIDATION_ATTESTATION_START = START;
export const ACCEPTANCE_VALIDATION_ATTESTATION_END = END;
