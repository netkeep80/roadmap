const START = '<!-- roadmap-agent:start -->';
const END = '<!-- roadmap-agent:end -->';
const OWNER = 'netkeep80';

const SESSION_PROTOCOL_V1 = 'roadmap-agent-session/v1';
const SESSION_PROTOCOL_V2 = 'roadmap-agent-session/v2';
const CHECKPOINT_PROTOCOL_V1 = 'roadmap-agent-checkpoint/v1';
const CHECKPOINT_PROTOCOL_V2 = 'roadmap-agent-checkpoint/v2';
const WORKER_SLOT_PROTOCOL_V1 = 'roadmap-worker-slot/v1';

const ISSUE_PROTOCOLS = new Map([
  ['roadmap-agent-role/v1', 'role'],
  [SESSION_PROTOCOL_V1, 'session'],
  [SESSION_PROTOCOL_V2, 'session'],
  ['roadmap-agent-message/v1', 'message'],
  [WORKER_SLOT_PROTOCOL_V1, 'worker-slot'],
]);

const CHECKPOINT_PROTOCOLS = new Set([CHECKPOINT_PROTOCOL_V1, CHECKPOINT_PROTOCOL_V2]);
const WORK_PHASES = new Set(['implementation', 'acceptance']);
const ACCEPTANCE_DECISIONS = new Set(['accepted', 'changes_requested']);

const SESSION_STATES = new Set([
  'starting',
  'working',
  'waiting',
  'blocked',
  'handoff',
  'completed',
  'abandoned',
]);

const TERMINAL_SESSION_STATES = new Set(['completed', 'abandoned']);
const WORKER_SLOT_STATES = new Set(['idle', 'working', 'waiting', 'blocked']);

const MESSAGE_KINDS = new Set([
  'info',
  'request',
  'blocker',
  'dependency-ready',
  'dependency-broken',
  'handoff',
  'decision-required',
  'coordination',
]);

const MESSAGE_STATES = new Set(['open', 'acknowledged', 'resolved']);

function fail(message) {
  throw new Error(`agent protocol: ${message}`);
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

function repositorySet(values) {
  if (!Array.isArray(values)) fail('repository collection must be an array');
  return new Set(values.map((value) => {
    if (typeof value === 'string') return value.replace(`${OWNER}/`, '');
    if (value && typeof value.name === 'string') return value.name;
    fail('repository collection contains an invalid entry');
  }));
}

function assertExactSameSet(left, right, label) {
  const leftOnly = [...left].filter((value) => !right.has(value)).sort();
  const rightOnly = [...right].filter((value) => !left.has(value)).sort();
  if (leftOnly.length || rightOnly.length) {
    fail(`${label} coverage mismatch: registry-only=[${leftOnly.join(', ')}], public-only=[${rightOnly.join(', ')}]`);
  }
}

function parseRepository(fullName) {
  if (typeof fullName !== 'string') fail('repository must be a string');
  const match = new RegExp(`^${OWNER}/([^/]+)$`).exec(fullName);
  if (!match) fail(`repository ${JSON.stringify(fullName)} is outside public owner namespace`);
  return match[1];
}

function assertArray(value, field) {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return value;
}

function assertStringArray(value, field) {
  const items = assertArray(value, field);
  for (const item of items) {
    if (typeof item !== 'string' || !item.trim()) fail(`${field} entries must be non-empty strings`);
  }
  return items;
}

function publicRoleRepositories(roleMap) {
  return new Set([...roleMap.values()].map((role) => parseRepository(role.repository)));
}

function parseIssueReference(ref) {
  if (typeof ref !== 'string') fail('reference must be a string');
  const match = /^netkeep80\/([^/#]+)#([1-9][0-9]*)$/.exec(ref);
  if (!match) fail(`reference ${JSON.stringify(ref)} is not a registered public issue/PR reference`);
  return { repository: match[1], number: Number(match[2]) };
}

function validatePublicIssueReference(ref, publicRepositories, field, requiredRepository = null) {
  const parsed = parseIssueReference(ref);
  if (!publicRepositories.has(parsed.repository)) {
    fail(`${field} reference ${ref} does not resolve to a registered public repository`);
  }
  if (requiredRepository && parsed.repository !== requiredRepository) {
    fail(`${field} ${ref} must belong to repository ${requiredRepository}`);
  }
  return parsed;
}

function validateSha(value, field) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40,64}$/i.test(value)) {
    fail(`${field} must be a 40-64 hex commit SHA`);
  }
  return value.toLowerCase();
}

function validateBranchName(name, field) {
  if (typeof name !== 'string' || !name.trim()) fail(`${field} branch name must be a non-empty string`);
  if (name !== name.trim() || name.startsWith('refs/heads/') || name.startsWith('/') || name.endsWith('/')) {
    fail(`${field} branch name must be a canonical branch name, not a ref`);
  }
  if (name.includes('//') || name.includes('..') || name.includes('@{') || /[\x00-\x20\x7f~^:?*\[\\]/.test(name)) {
    fail(`${field} branch name is not a valid GitHub branch name`);
  }
  for (const component of name.split('/')) {
    if (!component || component.startsWith('.') || component.endsWith('.') || component.endsWith('.lock')) {
      fail(`${field} branch name is not a valid GitHub branch name`);
    }
  }
  return name;
}

function validateCurrentBranch(value, publicRepositories, sessionRepository, field) {
  if (value === null) return null;
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(`${field} must be null or a branch object`);
  const repository = parseRepository(value.repository);
  if (!publicRepositories.has(repository)) {
    fail(`${field} repository ${value.repository} does not resolve to a registered public repository`);
  }
  if (repository !== sessionRepository) {
    fail(`${field} repository ${value.repository} must match Session repository ${OWNER}/${sessionRepository}`);
  }
  const name = validateBranchName(value.name, field);
  return { repository: value.repository, name };
}

function sameCurrentBranch(left, right) {
  if (left === null || right === null) return left === right;
  return left.repository === right.repository && left.name === right.name;
}

function validateCheckpointEvidenceReference(ref, publicRepositories, sessionRepository) {
  if (typeof ref !== 'string') fail('checkpoint refs entries must be strings');
  if (ref.startsWith('commit:')) {
    const sha = ref.slice('commit:'.length);
    if (!/^[0-9a-f]{40,64}$/i.test(sha)) fail(`checkpoint commit SHA ${JSON.stringify(sha)} is malformed`);
    return { kind: 'commit', repository: sessionRepository, sha };
  }
  return { kind: 'issue', ...validatePublicIssueReference(ref, publicRepositories, 'checkpoint ref') };
}

function assertGitHubIssueState(issue, expectedState, label) {
  if (!issue || !['open', 'closed'].includes(issue.state)) {
    fail(`${label} GitHub issue state must be open or closed`);
  }
  if (issue.state !== expectedState) {
    fail(`${label} lifecycle requires GitHub issue ${expectedState}, got ${issue.state}`);
  }
}

function assertPlainObject(value, field) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(`${field} must be an object`);
  return value;
}

function validateReviewCandidate(value, publicRepositories, sessionRepository, sessionData) {
  const candidate = assertPlainObject(value, 'review_candidate');
  if (sessionData.work_phase !== 'implementation') fail('review_candidate requires implementation Session phase');
  if (candidate.work_item !== sessionData.work_item) fail('review_candidate work_item must match Session work_item');
  validatePublicIssueReference(candidate.work_item, publicRepositories, 'review_candidate work_item', sessionRepository);
  validatePublicIssueReference(candidate.pr, publicRepositories, 'review_candidate pr', sessionRepository);
  if (sessionData.current_pr !== null && sessionData.current_pr !== candidate.pr) {
    fail('review_candidate pr must match Session current_pr');
  }
  candidate.head_sha = validateSha(candidate.head_sha, 'review_candidate head_sha');
  candidate.base_sha = validateSha(candidate.base_sha, 'review_candidate base_sha');
  return candidate;
}

function validateAcceptance(value, publicRepositories, sessionRepository, sessionData) {
  const acceptance = assertPlainObject(value, 'acceptance');
  if (sessionData.work_phase !== 'acceptance') fail('acceptance certificate requires acceptance Session phase');
  if (!Number.isInteger(acceptance.candidate_session) || acceptance.candidate_session <= 0) {
    fail('acceptance candidate_session must be a positive integer');
  }
  if (!Number.isInteger(acceptance.candidate_checkpoint_comment_id) || acceptance.candidate_checkpoint_comment_id <= 0) {
    fail('acceptance candidate_checkpoint_comment_id must be a positive integer');
  }
  if (!Number.isInteger(acceptance.candidate_validation_attestation_comment_id) || acceptance.candidate_validation_attestation_comment_id <= 0) {
    fail('acceptance candidate_validation_attestation_comment_id must be a positive integer');
  }
  if (acceptance.work_item !== sessionData.work_item) fail('acceptance work_item must match Session work_item');
  validatePublicIssueReference(acceptance.work_item, publicRepositories, 'acceptance work_item', sessionRepository);
  validatePublicIssueReference(acceptance.pr, publicRepositories, 'acceptance pr', sessionRepository);
  if (sessionData.current_pr !== null && sessionData.current_pr !== acceptance.pr) {
    fail('acceptance pr must match Session current_pr');
  }
  acceptance.head_sha = validateSha(acceptance.head_sha, 'acceptance head_sha');
  acceptance.base_sha = validateSha(acceptance.base_sha, 'acceptance base_sha');
  if (!ACCEPTANCE_DECISIONS.has(acceptance.decision)) {
    fail('acceptance decision must be accepted or changes_requested');
  }
  return acceptance;
}

export function parseProtocolBlock(body) {
  if (typeof body !== 'string') fail('issue body must be a string');
  const startCount = countOccurrences(body, START);
  const endCount = countOccurrences(body, END);
  if (startCount !== 1 || endCount !== 1) {
    fail(`expected exactly one canonical block, found start=${startCount} end=${endCount}`);
  }

  const start = body.indexOf(START) + START.length;
  const end = body.indexOf(END, start);
  if (end < start) fail('canonical block markers are malformed');

  const between = body.slice(start, end).trim();
  const fenced = /^```json\s*\n([\s\S]*?)\n```$/.exec(between);
  if (!fenced) fail('canonical block must contain exactly one fenced json object');

  let parsed;
  try {
    parsed = JSON.parse(fenced[1]);
  } catch (error) {
    fail(`malformed JSON: ${error.message}`);
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    fail('canonical JSON must be an object');
  }
  if (typeof parsed.protocol !== 'string') fail('protocol is required');
  return parsed;
}

export function classifyAgentIssue(issue) {
  if (!issue || typeof issue !== 'object') fail('issue object is required');
  const data = parseProtocolBlock(issue.body);
  const kind = ISSUE_PROTOCOLS.get(data.protocol);
  if (!kind) fail(`unknown issue protocol ${JSON.stringify(data.protocol)}`);
  return { kind, data, issue };
}

function validateRole(issue, registrySet, publicSet) {
  const { kind, data } = classifyAgentIssue(issue);
  if (kind !== 'role') fail(`issue #${issue.number} is not a role`);
  const repository = parseRepository(data.repository);
  if (!registrySet.has(repository) || !publicSet.has(repository)) {
    fail(`role #${issue.number} repository ${data.repository} is outside public registry scope`);
  }
  if (data.scope !== 'public-only') fail(`role #${issue.number} scope must be public-only`);
  if (data.state !== 'active') fail(`role #${issue.number} state must be active`);
  if (data.role_kind !== 'repository-developer') fail(`role #${issue.number} role_kind must be repository-developer`);
  const expectedAuthority = repository === 'roadmap' ? 'coordinate' : 'propose';
  if (data.portfolio_authority !== expectedAuthority) {
    fail(`role #${issue.number} portfolio_authority must be ${expectedAuthority}`);
  }
  return { ...data, issue_number: issue.number, created_at: issue.created_at ?? null };
}

export function validateRoleCoverage(registryRepositories, publicRepositories, issues, { enforceComplete = true } = {}) {
  const registrySet = repositorySet(registryRepositories);
  const publicSet = repositorySet(publicRepositories);
  assertExactSameSet(registrySet, publicSet, 'public/registry');

  if (!Array.isArray(issues)) fail('issues must be an array');
  const roleMap = new Map();
  const roleByRepository = new Map();

  for (const issue of issues) {
    if (!issue || issue.state === 'closed') continue;
    const { kind } = classifyAgentIssue(issue);
    if (kind !== 'role') continue;
    const roleData = validateRole(issue, registrySet, publicSet);
    const repository = parseRepository(roleData.repository);
    if (roleByRepository.has(repository)) {
      fail(`duplicate active role for ${repository}: #${roleByRepository.get(repository)} and #${issue.number}`);
    }
    roleByRepository.set(repository, issue.number);
    roleMap.set(issue.number, roleData);
  }

  const missing = [...registrySet].filter((repository) => !roleByRepository.has(repository)).sort();
  if (enforceComplete && missing.length) {
    fail(`missing active role coverage for: ${missing.join(', ')}`);
  }

  return { roleMap, roleByRepository, missing };
}

export function validateWorkerSlot(issue, roleMap) {
  const { kind, data } = classifyAgentIssue(issue);
  if (kind !== 'worker-slot') fail(`issue #${issue.number} is not a worker slot`);
  assertGitHubIssueState(issue, 'open', 'worker slot');

  if (!Number.isInteger(data.slot) || data.slot < 1 || data.slot > 5) {
    fail('worker slot must be an integer from 1 to 5');
  }
  if (!Number.isInteger(data.generation) || data.generation < 0) {
    fail('worker slot generation must be a non-negative integer');
  }
  if (!WORKER_SLOT_STATES.has(data.state)) {
    fail(`invalid worker slot state ${JSON.stringify(data.state)}`);
  }
  for (const field of ['assignment', 'current_branch', 'current_pr', 'progress']) {
    if (!Object.hasOwn(data, field)) fail(`worker slot must declare ${field}`);
  }

  if (data.state === 'idle') {
    if (data.assignment !== null || data.current_branch !== null || data.current_pr !== null || data.progress !== null) {
      fail('idle worker slot cannot retain assignment, branch, PR, or progress state');
    }
    return data;
  }

  const assignment = assertPlainObject(data.assignment, 'worker slot assignment');
  if (!Number.isInteger(assignment.role_issue)) fail('worker slot assignment role_issue must be an integer');
  const role = roleMap.get(assignment.role_issue);
  if (!role) fail(`worker slot assignment references unknown role #${assignment.role_issue}`);
  if (assignment.repository !== role.repository) {
    fail(`worker slot assignment repository ${assignment.repository} does not match role repository ${role.repository}`);
  }

  const repository = parseRepository(assignment.repository);
  const publicRepositories = publicRoleRepositories(roleMap);
  if (!publicRepositories.has(repository)) {
    fail(`worker slot assignment repository ${assignment.repository} is outside public role scope`);
  }
  validatePublicIssueReference(assignment.work_item, publicRepositories, 'worker slot work_item', repository);

  if (data.current_branch !== null) {
    data.current_branch = validateBranchName(data.current_branch, 'worker slot current_branch');
  }
  if (data.current_pr !== null) {
    validatePublicIssueReference(data.current_pr, publicRepositories, 'worker slot current_pr', repository);
  }
  if (data.progress !== null) {
    const progress = assertPlainObject(data.progress, 'worker slot progress');
    if (Object.hasOwn(progress, 'phase') && (typeof progress.phase !== 'string' || !progress.phase.trim())) {
      fail('worker slot progress phase must be a non-empty string when present');
    }
    if (Object.hasOwn(progress, 'next_action') && (typeof progress.next_action !== 'string' || !progress.next_action.trim())) {
      fail('worker slot progress next_action must be a non-empty string when present');
    }
  }

  return data;
}

export function validateSession(issue, roleMap) {
  const { kind, data } = classifyAgentIssue(issue);
  if (kind !== 'session') fail(`issue #${issue.number} is not a session`);
  if (!Number.isInteger(data.role_issue)) fail('session role_issue must be an integer');
  const role = roleMap.get(data.role_issue);
  if (!role) fail(`session references unknown role #${data.role_issue}`);
  if (data.repository !== role.repository) {
    fail(`session repository ${data.repository} does not match role repository ${role.repository}`);
  }
  if (!SESSION_STATES.has(data.state)) fail(`invalid session state ${JSON.stringify(data.state)}`);
  if (TERMINAL_SESSION_STATES.has(data.state)) {
    assertGitHubIssueState(issue, 'closed', `terminal session state ${data.state}`);
  } else {
    assertGitHubIssueState(issue, 'open', `active/handoff session state ${data.state}`);
  }

  const isV2 = data.protocol === SESSION_PROTOCOL_V2;
  if (isV2 && data.worker_slot !== undefined) fail('v2 Session cannot persist worker_slot');
  if (!isV2 && data.worker_slot !== undefined && (!Number.isInteger(data.worker_slot) || data.worker_slot <= 0)) {
    fail('session worker_slot must be a positive integer when present');
  }

  const repository = parseRepository(data.repository);
  const publicRepositories = publicRoleRepositories(roleMap);
  const claims = assertArray(data.claims, 'session claims');
  for (const claim of claims) {
    validatePublicIssueReference(claim, publicRepositories, 'claim', repository);
  }

  if (isV2) {
    validatePublicIssueReference(data.work_item, publicRepositories, 'work_item', repository);
    if (!WORK_PHASES.has(data.work_phase)) fail('work_phase must be implementation or acceptance');
    if (claims.length > 1) fail('v2 Session can claim at most one work item');
    if (claims.length === 1 && claims[0] !== data.work_item) fail('v2 claim must equal session work_item');
    if (!Object.hasOwn(data, 'current_branch')) fail('v2 Session must declare current_branch explicitly');
  }

  if (TERMINAL_SESSION_STATES.has(data.state) && claims.length) {
    fail(`terminal session state ${data.state} cannot retain claims`);
  }
  if (data.state === 'handoff' && claims.length) {
    fail('handoff session cannot retain claims');
  }

  if (Object.hasOwn(data, 'current_branch')) {
    data.current_branch = validateCurrentBranch(data.current_branch, publicRepositories, repository, 'session current_branch');
    if (TERMINAL_SESSION_STATES.has(data.state) && data.current_branch !== null) {
      fail(`terminal session state ${data.state} cannot retain current_branch ownership`);
    }
    if (isV2 && data.work_phase === 'acceptance' && data.current_branch !== null) {
      fail('acceptance Session cannot retain current_branch');
    }
  }

  if (data.current_pr !== null) {
    validatePublicIssueReference(data.current_pr, publicRepositories, 'current_pr', repository);
  }

  for (const blocker of assertArray(data.blocked_by, 'session blocked_by')) {
    validatePublicIssueReference(blocker, publicRepositories, 'blocked_by');
  }

  return data;
}

export function validateMessage(issue, roleMap) {
  const { kind, data } = classifyAgentIssue(issue);
  if (kind !== 'message') fail(`issue #${issue.number} is not a message`);
  if (!Number.isInteger(data.from_role_issue) || !roleMap.has(data.from_role_issue)) {
    fail(`message source role #${data.from_role_issue} does not exist`);
  }

  const targets = assertArray(data.to_role_issues, 'message to_role_issues');
  if (!targets.length) fail('message must have at least one target role');
  if (new Set(targets).size !== targets.length) fail('message target roles must be unique');
  for (const target of targets) {
    if (!Number.isInteger(target) || !roleMap.has(target)) fail(`message target role #${target} does not exist`);
  }

  if (!MESSAGE_KINDS.has(data.kind)) fail(`invalid message kind ${JSON.stringify(data.kind)}`);
  if (!MESSAGE_STATES.has(data.state)) fail(`invalid message state ${JSON.stringify(data.state)}`);
  if (data.state === 'resolved') {
    assertGitHubIssueState(issue, 'closed', 'resolved message');
  } else {
    assertGitHubIssueState(issue, 'open', `unresolved message state ${data.state}`);
  }
  if (typeof data.requires_ack !== 'boolean') fail('message requires_ack must be boolean');

  const publicRepositories = publicRoleRepositories(roleMap);
  for (const ref of assertArray(data.refs, 'message refs')) {
    validatePublicIssueReference(ref, publicRepositories, 'message reference');
  }

  return data;
}

export function validateCheckpoint(comment, roleMap, sessionData) {
  if (!comment || typeof comment !== 'object') fail('checkpoint comment object is required');
  if (!sessionData || typeof sessionData !== 'object') fail('checkpoint session data is required');
  const data = parseProtocolBlock(comment.body);
  if (!CHECKPOINT_PROTOCOLS.has(data.protocol)) {
    fail(`checkpoint protocol must be ${CHECKPOINT_PROTOCOL_V1} or ${CHECKPOINT_PROTOCOL_V2}`);
  }
  const sessionIsV2 = sessionData.protocol === SESSION_PROTOCOL_V2;
  const checkpointIsV2 = data.protocol === CHECKPOINT_PROTOCOL_V2;
  if (sessionIsV2 !== checkpointIsV2) fail('Checkpoint protocol version must match Session protocol version');
  if (!SESSION_STATES.has(data.state)) fail(`invalid checkpoint state ${JSON.stringify(data.state)}`);

  const completed = assertStringArray(data.completed, 'checkpoint completed');
  const refs = assertStringArray(data.refs, 'checkpoint refs');
  const blockers = assertStringArray(data.blockers, 'checkpoint blockers');
  const next = assertStringArray(data.next, 'checkpoint next');
  const messages = assertStringArray(data.messages, 'checkpoint messages');

  const publicRepositories = publicRoleRepositories(roleMap);
  const sessionRepository = parseRepository(sessionData.repository);
  for (const ref of refs) validateCheckpointEvidenceReference(ref, publicRepositories, sessionRepository);
  for (const blocker of blockers) validatePublicIssueReference(blocker, publicRepositories, 'checkpoint blocker');
  for (const message of messages) validatePublicIssueReference(message, publicRepositories, 'checkpoint message');

  if (checkpointIsV2) {
    if (data.work_item !== sessionData.work_item) fail('checkpoint work_item must match Session work_item');
    validatePublicIssueReference(data.work_item, publicRepositories, 'checkpoint work_item', sessionRepository);
    if (Object.hasOwn(data, 'review_candidate') && Object.hasOwn(data, 'acceptance')) {
      fail('Checkpoint cannot contain both review_candidate and acceptance');
    }
    if (Object.hasOwn(data, 'review_candidate')) {
      data.review_candidate = validateReviewCandidate(data.review_candidate, publicRepositories, sessionRepository, sessionData);
    }
    if (Object.hasOwn(data, 'acceptance')) {
      data.acceptance = validateAcceptance(data.acceptance, publicRepositories, sessionRepository, sessionData);
    }
  }

  const sessionHasCurrentBranchField = Object.hasOwn(sessionData, 'current_branch');
  const sessionCurrentBranch = sessionHasCurrentBranchField ? sessionData.current_branch : undefined;
  if (sessionCurrentBranch !== undefined && sessionCurrentBranch !== null) {
    if (!Object.hasOwn(data, 'current_branch')) {
      fail('checkpoint current_branch is required while Session owns a branch');
    }
    const checkpointBranch = validateCurrentBranch(data.current_branch, publicRepositories, sessionRepository, 'checkpoint current_branch');
    if (!sameCurrentBranch(checkpointBranch, sessionCurrentBranch)) {
      fail('checkpoint current_branch must match current Session branch ownership');
    }
    data.current_branch = checkpointBranch;
  } else if (Object.hasOwn(data, 'current_branch')) {
    const checkpointBranch = validateCurrentBranch(data.current_branch, publicRepositories, sessionRepository, 'checkpoint current_branch');
    if (checkpointBranch !== null && !TERMINAL_SESSION_STATES.has(sessionData.state)) {
      fail('checkpoint current_branch cannot introduce branch ownership absent from an active Session');
    }
    data.current_branch = checkpointBranch;
  }

  return { ...data, completed, refs, blockers, next, messages };
}

export function compareClaimPriority(left, right) {
  const leftTime = Date.parse(left?.created_at ?? '');
  const rightTime = Date.parse(right?.created_at ?? '');
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    fail('claim priority requires valid session created_at timestamps');
  }
  if (leftTime < rightTime) return -1;
  if (leftTime > rightTime) return 1;

  const leftNumber = Number(left?.number);
  const rightNumber = Number(right?.number);
  if (!Number.isInteger(leftNumber) || !Number.isInteger(rightNumber)) {
    fail('claim priority requires integer session issue numbers');
  }
  if (leftNumber < rightNumber) return -1;
  if (leftNumber > rightNumber) return 1;
  return 0;
}

export const AGENT_PROTOCOL = Object.freeze({
  startMarker: START,
  endMarker: END,
  owner: OWNER,
  checkpointProtocol: CHECKPOINT_PROTOCOL_V1,
  checkpointProtocols: Object.freeze([...CHECKPOINT_PROTOCOLS]),
  sessionProtocols: Object.freeze([SESSION_PROTOCOL_V1, SESSION_PROTOCOL_V2]),
  workerSlotProtocol: WORKER_SLOT_PROTOCOL_V1,
  workerSlotStates: Object.freeze([...WORKER_SLOT_STATES]),
  workPhases: Object.freeze([...WORK_PHASES]),
  sessionStates: Object.freeze([...SESSION_STATES]),
  messageKinds: Object.freeze([...MESSAGE_KINDS]),
  messageStates: Object.freeze([...MESSAGE_STATES]),
});