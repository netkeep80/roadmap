const START = '<!-- roadmap-agent-pr:start -->';
const END = '<!-- roadmap-agent-pr:end -->';
const PROTOCOL = 'roadmap-agent-pr/v1';
const PUBLIC_REF = /^netkeep80\/[A-Za-z0-9_.-]+#[1-9]\d*$/;
const COMMIT_SHA = /^[0-9a-f]{40,64}$/;

const POINTER_FIELDS = [
  'protocol',
  'work_item',
  'pr',
  'candidate_session',
  'candidate_checkpoint_comment_id',
  'candidate_validation_attestation_comment_id',
  'acceptance_session',
  'acceptance_checkpoint_comment_id',
  'head_sha',
  'base_sha',
];

function fail(message) {
  throw new Error(`acceptance pointer: ${message}`);
}

function object(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    fail(`${label} object is required`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer`);
  }
}

function publicRef(value, label, kind) {
  if (typeof value !== 'string' || !PUBLIC_REF.test(value)) {
    fail(`${label} must be a public ${kind} reference`);
  }
}

function commitSha(value, label) {
  if (typeof value !== 'string' || !COMMIT_SHA.test(value)) {
    fail(`${label} must be a commit SHA`);
  }
}

function count(text, needle) {
  let total = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index < 0) return total;
    total += 1;
    offset = index + needle.length;
  }
}

function validatePointer(value) {
  const pointer = object(value, 'pointer');
  const keys = Object.keys(pointer).sort();
  const expected = [...POINTER_FIELDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail(`pointer fields must be exactly: ${POINTER_FIELDS.join(', ')}`);
  }
  if (pointer.protocol !== PROTOCOL) {
    fail(`protocol must be ${PROTOCOL}`);
  }
  publicRef(pointer.work_item, 'work_item', 'issue');
  publicRef(pointer.pr, 'pr', 'issue/PR');
  positiveInteger(pointer.candidate_session, 'candidate_session');
  positiveInteger(pointer.candidate_checkpoint_comment_id, 'candidate_checkpoint_comment_id');
  positiveInteger(
    pointer.candidate_validation_attestation_comment_id,
    'candidate_validation_attestation_comment_id',
  );
  positiveInteger(pointer.acceptance_session, 'acceptance_session');
  positiveInteger(pointer.acceptance_checkpoint_comment_id, 'acceptance_checkpoint_comment_id');
  commitSha(pointer.head_sha, 'head_sha');
  commitSha(pointer.base_sha, 'base_sha');
  return pointer;
}

function exact(value, expected, message) {
  if (value !== expected) fail(message);
}

function exactTuple(label, value, pointer) {
  const tuple = object(value, label);
  exact(tuple.work_item, pointer.work_item, `${label} work_item mismatch`);
  exact(tuple.pr, pointer.pr, `${label} pr mismatch`);
  exact(tuple.head_sha, pointer.head_sha, `${label} head_sha mismatch`);
  exact(tuple.base_sha, pointer.base_sha, `${label} base_sha mismatch`);
  return tuple;
}

export function parseAcceptancePointer(body) {
  if (typeof body !== 'string') fail('PR body must be a string');
  if (count(body, START) !== 1 || count(body, END) !== 1) {
    fail(`exactly one ${PROTOCOL} block is required`);
  }

  const start = body.indexOf(START);
  const end = body.indexOf(END, start + START.length);
  if (start < 0 || end < 0 || end <= start) {
    fail(`exactly one ${PROTOCOL} block is required`);
  }

  const framed = body.slice(start + START.length, end).trim();
  const match = framed.match(/^```json\s*\n([\s\S]*?)\n```$/);
  if (!match) fail(`${PROTOCOL} block must contain exactly one fenced JSON object`);

  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    fail('pointer JSON is malformed');
  }
  return validatePointer(parsed);
}

export function verifyAcceptancePointerInput(input) {
  const resolved = object(input, 'resolved verifier input');
  const pointer = validatePointer(resolved.pointer);

  const target = object(resolved.targetPullRequest, 'target pull request');
  exact(target.ref, pointer.pr, 'target PR reference mismatch');
  exact(target.head_sha, pointer.head_sha, 'target PR head is stale; exact head is required');
  exact(target.base_sha, pointer.base_sha, 'target PR base is stale; exact base is required');

  const candidateSession = object(resolved.candidateSession, 'candidate Session');
  exact(candidateSession.number, pointer.candidate_session, 'candidate Session number mismatch');
  exact(candidateSession.protocol, 'roadmap-agent-session/v2', 'candidate Session protocol must be roadmap-agent-session/v2');
  exact(candidateSession.work_item, pointer.work_item, 'candidate Session work_item mismatch');
  exact(candidateSession.work_phase, 'implementation', 'candidate Session must be implementation phase');

  const acceptanceSession = object(resolved.acceptanceSession, 'acceptance Session');
  exact(acceptanceSession.number, pointer.acceptance_session, 'acceptance Session number mismatch');
  exact(acceptanceSession.protocol, 'roadmap-agent-session/v2', 'acceptance Session protocol must be roadmap-agent-session/v2');
  exact(acceptanceSession.work_item, pointer.work_item, 'acceptance Session work_item mismatch');
  exact(acceptanceSession.work_phase, 'acceptance', 'acceptance Session must be acceptance phase');
  if (acceptanceSession.number === candidateSession.number) {
    fail('acceptance Session must be different from candidate Session');
  }

  const candidateCheckpoint = object(resolved.candidateCheckpoint, 'candidate checkpoint');
  exact(
    candidateCheckpoint.id,
    pointer.candidate_checkpoint_comment_id,
    'candidate checkpoint comment id mismatch',
  );
  exactTuple('candidate checkpoint', candidateCheckpoint.review_candidate, pointer);

  const attestation = object(resolved.validationAttestation, 'validation attestation');
  exact(
    attestation.id,
    pointer.candidate_validation_attestation_comment_id,
    'validation attestation comment id mismatch',
  );
  exact(attestation.candidate_session, pointer.candidate_session, 'validation attestation candidate Session mismatch');
  exact(
    attestation.candidate_checkpoint_comment_id,
    pointer.candidate_checkpoint_comment_id,
    'validation attestation candidate checkpoint mismatch',
  );
  exactTuple('validation attestation', attestation, pointer);

  const acceptanceCheckpoint = object(resolved.acceptanceCheckpoint, 'acceptance checkpoint');
  exact(
    acceptanceCheckpoint.id,
    pointer.acceptance_checkpoint_comment_id,
    'acceptance checkpoint comment id mismatch',
  );
  const acceptance = exactTuple('acceptance checkpoint', acceptanceCheckpoint.acceptance, pointer);
  exact(acceptance.candidate_session, pointer.candidate_session, 'acceptance candidate Session mismatch');
  exact(
    acceptance.candidate_checkpoint_comment_id,
    pointer.candidate_checkpoint_comment_id,
    'acceptance candidate checkpoint mismatch',
  );
  exact(
    acceptance.candidate_validation_attestation_comment_id,
    pointer.candidate_validation_attestation_comment_id,
    'acceptance validation attestation mismatch',
  );
  exact(acceptance.decision, 'accepted', 'acceptance decision must be accepted');

  return {
    work_item: pointer.work_item,
    pr: pointer.pr,
    head_sha: pointer.head_sha,
    base_sha: pointer.base_sha,
    candidate_session: pointer.candidate_session,
    acceptance_session: pointer.acceptance_session,
    acceptance_checkpoint_comment_id: pointer.acceptance_checkpoint_comment_id,
  };
}
