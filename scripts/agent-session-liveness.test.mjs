import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoleCoverage, validateSession } from './agent-protocol.mjs';
import { buildAgentSnapshot } from './agent-status.mjs';

const block = (value) => `before\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\nafter`;

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

function sessionIssue(data, number = 100) {
  return {
    number,
    state: 'open',
    created_at: '2026-08-24T10:00:00Z',
    updated_at: '2026-08-24T10:01:00Z',
    body: block(data),
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

test('scheduled Session accepts a positive integer worker_slot as observability metadata', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);
  const data = validateSession(sessionIssue(sessionData({ worker_slot: 7 })), coverage.roleMap);
  assert.equal(data.worker_slot, 7);
});

test('worker_slot rejects values that are not positive integers', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);
  for (const workerSlot of [0, -1, 1.5, '1']) {
    assert.throws(
      () => validateSession(sessionIssue(sessionData({ worker_slot: workerSlot })), coverage.roleMap),
      /worker_slot|positive integer/i,
    );
  }
});

test('generated Session status exposes worker_slot without changing Role or claim authority', () => {
  const session = {
    number: 101,
    html_url: 'https://github.com/netkeep80/roadmap/issues/101',
    created_at: '2026-08-24T10:00:00Z',
    updated_at: '2026-08-24T10:01:00Z',
    data: sessionData({ worker_slot: 7 }),
  };
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T10:02:00Z',
    roles: [{ issue_number: 10, repository: 'netkeep80/alpha', portfolio_authority: 'propose' }],
    sessions: [session],
    messages: [],
  });
  assert.equal(snapshot.active_sessions[0].worker_slot, 7);
  assert.equal(snapshot.active_sessions[0].role_issue, 10);
});
