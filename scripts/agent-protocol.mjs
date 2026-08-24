const START = '<!-- roadmap-agent:start -->';
const END = '<!-- roadmap-agent:end -->';
const OWNER = 'netkeep80';

const ISSUE_PROTOCOLS = new Map([
  ['roadmap-agent-role/v1', 'role'],
  ['roadmap-agent-session/v1', 'session'],
  ['roadmap-agent-message/v1', 'message'],
]);

const CHECKPOINT_PROTOCOL = 'roadmap-agent-checkpoint/v1';

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

function validateCheckpointEvidenceReference(ref, publicRepositories, sessionRepository) {
  if (typeof ref !== 'string') fail('checkpoint refs entries must be strings');
  if (ref.startsWith('commit:')) {
    const sha = ref.slice('commit:'.length);
    if (!/^[0-9a-f]{40,64}$/i.test(sha)) fail(`checkpoint commit SHA ${JSON.stringify(sha)} is malformed`);
    return { kind: 'commit', repository: sessionRepository, sha };
  }
  return { kind: 'issue', ...validatePublicIssueReference(ref, publicRepositories, 'checkpoint ref') };
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

  const repository = parseRepository(data.repository);
  const publicRepositories = publicRoleRepositories(roleMap);
  const claims = assertArray(data.claims, 'session claims');
  for (const claim of claims) {
    validatePublicIssueReference(claim, publicRepositories, 'claim', repository);
  }

  if (TERMINAL_SESSION_STATES.has(data.state) && claims.length) {
    fail(`terminal session state ${data.state} cannot retain claims`);
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
  if (data.protocol !== CHECKPOINT_PROTOCOL) fail(`checkpoint protocol must be ${CHECKPOINT_PROTOCOL}`);
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
  checkpointProtocol: CHECKPOINT_PROTOCOL,
  sessionStates: Object.freeze([...SESSION_STATES]),
  messageKinds: Object.freeze([...MESSAGE_KINDS]),
  messageStates: Object.freeze([...MESSAGE_STATES]),
});
