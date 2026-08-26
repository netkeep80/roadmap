import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { validateMessage, validateRoleCoverage, validateSession } from './agent-protocol.mjs';
import { buildAgentSnapshot, renderAgentStatus } from './agent-status.mjs';

const block = (value) => `before\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\nafter`;

const workerPolicy = {
  schema_version: 1,
  scope: 'public-owner-repositories',
  lease_seconds: 7200,
  heartbeat_target_seconds: 3600,
  work_source_order: ['handoff', 'message', 'local-issue'],
  no_work_action: 'exit',
  allow_speculative_work: false,
  coordinator_requires_declared_trigger: true,
  pr_reconciliation_required: true,
};

const role = {
  number: 10,
  state: 'open',
  created_at: '2026-08-24T09:00:00Z',
  body: block({
    protocol: 'roadmap-agent-role/v1',
    repository: 'netkeep80/alpha',
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: 'propose',
  }),
};

function sessionData(overrides = {}) {
  return {
    protocol: 'roadmap-agent-session/v1',
    role_issue: 10,
    repository: 'netkeep80/alpha',
    state: 'working',
    claims: [],
    current_pr: null,
    blocked_by: [],
    ...overrides,
  };
}

function sessionIssue(data, number = 100, issueState = 'open') {
  return {
    number,
    state: issueState,
    created_at: '2026-08-24T10:00:00Z',
    updated_at: '2026-08-24T10:01:00Z',
    body: block(data),
  };
}

function messageIssue(protocolState, issueState) {
  return {
    number: 200,
    state: issueState,
    body: block({
      protocol: 'roadmap-agent-message/v1',
      from_role_issue: 10,
      to_role_issues: [10],
      kind: 'coordination',
      requires_ack: false,
      state: protocolState,
      refs: ['netkeep80/alpha#7'],
    }),
  };
}

const handoffWithClaim = sessionIssue(sessionData({
  state: 'handoff',
  claims: ['netkeep80/alpha#7'],
}));

test('validateSession rejects claims on handoff sessions', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);
  assert.throws(
    () => validateSession(handoffWithClaim, coverage.roleMap),
    /handoff|claim/i,
  );
});

test('historical worker_slot remains parseable but has no generated operational surface', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);
  const parsed = validateSession(sessionIssue(sessionData({ worker_slot: 7 })), coverage.roleMap);
  assert.equal(parsed.worker_slot, 7);

  const session = {
    number: 101,
    html_url: 'https://github.com/netkeep80/roadmap/issues/101',
    created_at: '2026-08-24T10:00:00Z',
    updated_at: '2026-08-24T10:01:00Z',
    data: parsed,
  };
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T10:02:00Z',
    roles: [{ issue_number: 10, repository: 'netkeep80/alpha', portfolio_authority: 'propose' }],
    sessions: [session],
    messages: [],
    workerPolicy,
  });

  assert.equal('worker_slot' in snapshot.active_sessions[0], false);
  const markdown = renderAgentStatus(snapshot);
  assert.doesNotMatch(markdown, /worker[_ ]slot/i);
});

test('Session protocol state must match GitHub issue lifecycle', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);

  assert.doesNotThrow(() => validateSession(sessionIssue(sessionData({ state: 'completed' }), 101, 'closed'), coverage.roleMap));
  assert.doesNotThrow(() => validateSession(sessionIssue(sessionData({ state: 'handoff' }), 102, 'open'), coverage.roleMap));

  assert.throws(
    () => validateSession(sessionIssue(sessionData({ state: 'completed' }), 103, 'open'), coverage.roleMap),
    /terminal|closed|lifecycle/i,
  );
  assert.throws(
    () => validateSession(sessionIssue(sessionData({ state: 'working' }), 104, 'closed'), coverage.roleMap),
    /active|open|lifecycle/i,
  );
  assert.throws(
    () => validateSession(sessionIssue(sessionData({ state: 'handoff' }), 105, 'closed'), coverage.roleMap),
    /handoff|open|lifecycle/i,
  );
});

test('resolved Messages close while unresolved Messages stay open', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);

  assert.doesNotThrow(() => validateMessage(messageIssue('resolved', 'closed'), coverage.roleMap));
  assert.doesNotThrow(() => validateMessage(messageIssue('acknowledged', 'open'), coverage.roleMap));

  assert.throws(
    () => validateMessage(messageIssue('resolved', 'open'), coverage.roleMap),
    /resolved|closed|lifecycle/i,
  );
  assert.throws(
    () => validateMessage(messageIssue('open', 'closed'), coverage.roleMap),
    /unresolved|open|lifecycle/i,
  );
});

test('forward policy bounds orphaned working Sessions and tells long executions to refresh the existing Checkpoint heartbeat', async () => {
  const policy = JSON.parse(await readFile(new URL('../data/worker-policy.json', import.meta.url), 'utf8'));
  assert.equal(policy.lease_seconds, 3600);
  assert.equal(policy.heartbeat_target_seconds, 1800);

  const scheduledWorkers = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  assert.match(
    scheduledWorkers,
    /meaningful work continues for longer than `heartbeat_target_seconds`[\s\S]*structured Checkpoint/i,
  );

  const protocol = await readFile(new URL('../AGENT_PROTOCOL.md', import.meta.url), 'utf8');
  assert.match(protocol, /lease_seconds = 3600[\s\S]*heartbeat_target_seconds = 1800/);
});
