import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRoleCoverage, validateSession } from './agent-protocol.mjs';

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

const handoffWithClaim = {
  number: 100,
  state: 'open',
  created_at: '2026-08-24T10:00:00Z',
  body: block({
    protocol: 'roadmap-agent-session/v1',
    role_issue: 10,
    repository: 'netkeep80/alpha',
    state: 'handoff',
    claims: ['netkeep80/alpha#7'],
    current_pr: null,
    blocked_by: [],
  }),
};

test('validateSession rejects claims on handoff sessions', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role]);
  assert.throws(
    () => validateSession(handoffWithClaim, coverage.roleMap),
    /handoff|claim/i,
  );
});
