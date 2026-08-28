import test from 'node:test';
import assert from 'node:assert/strict';

import * as agentProtocol from './agent-protocol.mjs';
import {
  parseProtocolBlock,
  classifyAgentIssue,
  validateRoleCoverage,
  validateSession,
  validateMessage,
  validateCheckpoint,
  compareClaimPriority,
} from './agent-protocol.mjs';

const block = (value) => `before\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\nafter`;

const role = (repository, number = 10) => ({
  number,
  state: 'open',
  created_at: '2026-08-24T09:00:00Z',
  body: block({
    protocol: 'roadmap-agent-role/v1',
    repository: `netkeep80/${repository}`,
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: repository === 'roadmap' ? 'coordinate' : 'propose',
  }),
});

const session = ({ roleIssue = 10, repository = 'alpha', claims = [], state = 'working', number = 100, createdAt = '2026-08-24T10:00:00Z' } = {}) => ({
  number,
  state: 'open',
  created_at: createdAt,
  body: block({
    protocol: 'roadmap-agent-session/v1',
    role_issue: roleIssue,
    repository: `netkeep80/${repository}`,
    state,
    claims,
    current_pr: null,
    blocked_by: [],
  }),
});

const checkpoint = (overrides = {}) => ({
  id: 300,
  created_at: '2026-08-24T10:30:00Z',
  body: block({
    protocol: 'roadmap-agent-checkpoint/v1',
    state: 'working',
    completed: ['validated current state'],
    refs: ['netkeep80/alpha#7', 'commit:0123456789abcdef0123456789abcdef01234567'],
    blockers: [],
    next: ['continue exact local gate'],
    messages: ['netkeep80/roadmap#20'],
    ...overrides,
  }),
});

const workerSlot = (overrides = {}) => ({
  number: 500,
  state: 'open',
  created_at: '2026-08-28T09:00:00Z',
  body: block({
    protocol: 'roadmap-worker-slot/v1',
    slot: 3,
    generation: 0,
    state: 'idle',
    assignment: null,
    current_branch: null,
    current_pr: null,
    progress: null,
    ...overrides,
  }),
});

test('parseProtocolBlock parses exactly one strict JSON block', () => {
  const parsed = parseProtocolBlock(role('alpha').body);
  assert.equal(parsed.protocol, 'roadmap-agent-role/v1');
  assert.equal(parsed.repository, 'netkeep80/alpha');
});

test('parseProtocolBlock rejects malformed JSON and duplicate canonical blocks', () => {
  assert.throws(() => parseProtocolBlock('<!-- roadmap-agent:start -->\n```json\n{bad}\n```\n<!-- roadmap-agent:end -->'), /JSON|parse|malformed/i);
  const one = block({ protocol: 'roadmap-agent-role/v1' });
  assert.throws(() => parseProtocolBlock(`${one}\n${one}`), /exactly one|multiple/i);
});

test('classifyAgentIssue recognizes finite issue protocol kinds', () => {
  assert.equal(classifyAgentIssue(role('alpha')).kind, 'role');
  assert.equal(classifyAgentIssue(session()).kind, 'session');
  const message = {
    number: 200,
    state: 'open',
    body: block({
      protocol: 'roadmap-agent-message/v1',
      from_role_issue: 10,
      to_role_issues: [11],
      kind: 'dependency-ready',
      requires_ack: true,
      state: 'open',
      refs: ['netkeep80/alpha#1'],
    }),
  };
  assert.equal(classifyAgentIssue(message).kind, 'message');
});

test('classifyAgentIssue recognizes permanent worker slots', () => {
  assert.equal(classifyAgentIssue(workerSlot()).kind, 'worker-slot');
});

test('validateWorkerSlot accepts bounded idle and assigned snapshots', () => {
  assert.equal(typeof agentProtocol.validateWorkerSlot, 'function');
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role('alpha', 10)]);

  const idle = agentProtocol.validateWorkerSlot(workerSlot(), coverage.roleMap);
  assert.equal(idle.slot, 3);
  assert.equal(idle.generation, 0);
  assert.equal(idle.state, 'idle');
  assert.equal(idle.assignment, null);

  const assigned = agentProtocol.validateWorkerSlot(workerSlot({
    generation: 7,
    state: 'working',
    assignment: {
      repository: 'netkeep80/alpha',
      role_issue: 10,
      work_item: 'netkeep80/alpha#42',
    },
    current_branch: 'agent/42-work',
    current_pr: 'netkeep80/alpha#43',
    progress: {
      phase: 'ci',
      next_action: 'Inspect the first failing check',
    },
  }), coverage.roleMap);
  assert.equal(assigned.assignment.work_item, 'netkeep80/alpha#42');
  assert.equal(assigned.current_branch, 'agent/42-work');
  assert.equal(assigned.current_pr, 'netkeep80/alpha#43');
});

test('validateWorkerSlot rejects invalid identity and ambiguous idle state', () => {
  assert.equal(typeof agentProtocol.validateWorkerSlot, 'function');
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role('alpha', 10)]);

  assert.throws(() => agentProtocol.validateWorkerSlot(workerSlot({ slot: 0 }), coverage.roleMap), /slot.*1.*5/i);
  assert.throws(() => agentProtocol.validateWorkerSlot(workerSlot({ slot: 6 }), coverage.roleMap), /slot.*1.*5/i);
  assert.throws(() => agentProtocol.validateWorkerSlot(workerSlot({ generation: -1 }), coverage.roleMap), /generation/i);
  assert.throws(() => agentProtocol.validateWorkerSlot(workerSlot({
    assignment: {
      repository: 'netkeep80/alpha',
      role_issue: 10,
      work_item: 'netkeep80/alpha#42',
    },
  }), coverage.roleMap), /idle|assignment/i);
});

test('validateWorkerSlot requires assignment role and work item to match repository', () => {
  assert.equal(typeof agentProtocol.validateWorkerSlot, 'function');
  const coverage = validateRoleCoverage(
    ['alpha', 'beta'],
    ['alpha', 'beta'],
    [role('alpha', 10), role('beta', 11)],
  );

  assert.throws(() => agentProtocol.validateWorkerSlot(workerSlot({
    state: 'working',
    assignment: {
      repository: 'netkeep80/alpha',
      role_issue: 11,
      work_item: 'netkeep80/alpha#42',
    },
  }), coverage.roleMap), /role|repository/i);

  assert.throws(() => agentProtocol.validateWorkerSlot(workerSlot({
    state: 'working',
    assignment: {
      repository: 'netkeep80/alpha',
      role_issue: 10,
      work_item: 'netkeep80/beta#42',
    },
  }), coverage.roleMap), /work_item|repository/i);
});

test('validateRoleCoverage accepts exact one-role-per-public-repository coverage', () => {
  const result = validateRoleCoverage(['alpha', 'beta'], ['alpha', 'beta'], [role('alpha', 10), role('beta', 11)]);
  assert.deepEqual(result.missing, []);
  assert.equal(result.roleMap.get(10).repository, 'netkeep80/alpha');
});

test('validateRoleCoverage rejects duplicate and out-of-scope roles', () => {
  assert.throws(
    () => validateRoleCoverage(['alpha'], ['alpha'], [role('alpha', 10), role('alpha', 11)]),
    /duplicate/i,
  );
  assert.throws(
    () => validateRoleCoverage(['alpha'], ['alpha'], [role('beta', 11)]),
    /public|registry|scope/i,
  );
});

test('validateRoleCoverage supports advisory missing-role diagnostics but enforcement rejects gaps', () => {
  const advisory = validateRoleCoverage(['alpha', 'beta'], ['alpha', 'beta'], [role('alpha', 10)], { enforceComplete: false });
  assert.deepEqual(advisory.missing, ['beta']);
  assert.throws(
    () => validateRoleCoverage(['alpha', 'beta'], ['alpha', 'beta'], [role('alpha', 10)], { enforceComplete: true }),
    /missing/i,
  );
});

test('validateRoleCoverage rejects registry/public visibility mismatch', () => {
  assert.throws(
    () => validateRoleCoverage(['alpha', 'beta'], ['alpha'], [role('alpha', 10)], { enforceComplete: false }),
    /public.*registry|registry.*public|coverage/i,
  );
});

test('validateSession requires matching role/repository and local claims', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role('alpha', 10)]);
  assert.doesNotThrow(() => validateSession(session({ claims: ['netkeep80/alpha#7'] }), coverage.roleMap));
  assert.throws(
    () => validateSession(session({ repository: 'beta' }), coverage.roleMap),
    /repository|role/i,
  );
  assert.throws(
    () => validateSession(session({ claims: ['netkeep80/beta#7'] }), coverage.roleMap),
    /claim/i,
  );
});

test('validateSession rejects active claims on terminal sessions', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role('alpha', 10)]);
  assert.throws(
    () => validateSession(session({ state: 'completed', claims: ['netkeep80/alpha#7'] }), coverage.roleMap),
    /claim|terminal|completed/i,
  );
});

test('validateMessage requires valid role endpoints and public refs', () => {
  const coverage = validateRoleCoverage(['alpha', 'beta'], ['alpha', 'beta'], [role('alpha', 10), role('beta', 11)]);
  const valid = {
    number: 200,
    state: 'open',
    body: block({
      protocol: 'roadmap-agent-message/v1',
      from_role_issue: 10,
      to_role_issues: [11],
      kind: 'dependency-ready',
      requires_ack: true,
      state: 'open',
      refs: ['netkeep80/alpha#1', 'netkeep80/beta#2'],
    }),
  };
  assert.doesNotThrow(() => validateMessage(valid, coverage.roleMap));

  const invalidTarget = structuredClone(valid);
  invalidTarget.body = block({ ...parseProtocolBlock(valid.body), to_role_issues: [999] });
  assert.throws(() => validateMessage(invalidTarget, coverage.roleMap), /target|role/i);

  const invalidRef = structuredClone(valid);
  invalidRef.body = block({ ...parseProtocolBlock(valid.body), refs: ['other/private#1'] });
  assert.throws(() => validateMessage(invalidRef, coverage.roleMap), /public|reference|registered/i);
});

test('validateCheckpoint accepts public refs and repository-scoped commit evidence', () => {
  const coverage = validateRoleCoverage(['roadmap', 'alpha'], ['roadmap', 'alpha'], [role('roadmap', 20), role('alpha', 10)]);
  const sessionData = validateSession(session(), coverage.roleMap);
  const parsed = validateCheckpoint(checkpoint(), coverage.roleMap, sessionData);
  assert.equal(parsed.protocol, 'roadmap-agent-checkpoint/v1');
  assert.equal(parsed.state, 'working');
});

test('validateCheckpoint rejects private/unknown refs and malformed commit evidence', () => {
  const coverage = validateRoleCoverage(['roadmap', 'alpha'], ['roadmap', 'alpha'], [role('roadmap', 20), role('alpha', 10)]);
  const sessionData = validateSession(session(), coverage.roleMap);

  assert.throws(
    () => validateCheckpoint(checkpoint({ refs: ['netkeep80/beta#7'] }), coverage.roleMap, sessionData),
    /registered|public|reference/i,
  );
  assert.throws(
    () => validateCheckpoint(checkpoint({ refs: ['commit:not-a-sha'] }), coverage.roleMap, sessionData),
    /commit|sha/i,
  );
  assert.throws(
    () => validateCheckpoint(checkpoint({ messages: ['netkeep80/beta#9'] }), coverage.roleMap, sessionData),
    /registered|public|reference/i,
  );
});

test('validateCheckpoint requires finite state and string arrays', () => {
  const coverage = validateRoleCoverage(['roadmap', 'alpha'], ['roadmap', 'alpha'], [role('roadmap', 20), role('alpha', 10)]);
  const sessionData = validateSession(session(), coverage.roleMap);

  assert.throws(() => validateCheckpoint(checkpoint({ state: 'unknown' }), coverage.roleMap, sessionData), /state/i);
  assert.throws(() => validateCheckpoint(checkpoint({ next: [42] }), coverage.roleMap, sessionData), /next|string/i);
  assert.throws(() => validateCheckpoint(checkpoint({ completed: 'done' }), coverage.roleMap, sessionData), /completed|array/i);
});

test('compareClaimPriority deterministically prefers earlier session then lower issue number', () => {
  const earlier = session({ number: 30, createdAt: '2026-08-24T10:00:00Z' });
  const later = session({ number: 20, createdAt: '2026-08-24T10:00:01Z' });
  assert.equal(compareClaimPriority(earlier, later), -1);
  assert.equal(compareClaimPriority(later, earlier), 1);

  const sameTimeLow = session({ number: 20, createdAt: '2026-08-24T10:00:00Z' });
  const sameTimeHigh = session({ number: 30, createdAt: '2026-08-24T10:00:00Z' });
  assert.equal(compareClaimPriority(sameTimeLow, sameTimeHigh), -1);
  assert.equal(compareClaimPriority(sameTimeHigh, sameTimeLow), 1);
});