import test from 'node:test';
import assert from 'node:assert/strict';

import { computeMissingRoles } from './reconcile-agent-roles.mjs';

const block = (value) => `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->`;

const role = (repository, number) => ({
  number,
  state: 'open',
  created_at: '2026-08-24T10:00:00Z',
  body: block({
    protocol: 'roadmap-agent-role/v1',
    repository: `netkeep80/${repository}`,
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: repository === 'roadmap' ? 'coordinate' : 'propose',
  }),
});

test('reconciler computes only genuinely missing public roles', () => {
  const missing = computeMissingRoles(
    ['alpha', 'beta', 'roadmap'],
    ['alpha', 'beta', 'roadmap'],
    [role('alpha', 10), role('roadmap', 11)],
  );
  assert.deepEqual(missing, ['beta']);
});

test('reconciler is idempotent when exact coverage already exists', () => {
  const missing = computeMissingRoles(
    ['alpha', 'roadmap'],
    ['alpha', 'roadmap'],
    [role('alpha', 10), role('roadmap', 11)],
  );
  assert.deepEqual(missing, []);
});

test('reconciler refuses public/registry drift before creating anything', () => {
  assert.throws(
    () => computeMissingRoles(['alpha', 'roadmap'], ['alpha', 'roadmap', 'unexpected-public'], [role('alpha', 10), role('roadmap', 11)]),
    /coverage mismatch/i,
  );
});
