import test from 'node:test';
import assert from 'node:assert/strict';

import { parseProtocolBlock } from './agent-protocol.mjs';
import { assertRoleTemplate, roleIssueBody, roleIssueTitle } from './agent-role-template.mjs';

test('role template is a stable one-URL repository developer entrypoint', () => {
  const body = roleIssueBody('netkeep80', 'roadmap', 'alpha');
  const parsed = parseProtocolBlock(body);
  assert.deepEqual(parsed, {
    protocol: 'roadmap-agent-role/v1',
    repository: 'netkeep80/alpha',
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: 'propose',
  });
  assert.equal(roleIssueTitle('alpha'), '[Agent Role] alpha developer');
  assert.match(body, /AGENTS\.md/);
  assert.match(body, /AGENT_PROTOCOL\.md/);
  assert.doesNotMatch(body, /head_sha|current_pr|exact current SHA/i);
  assert.doesNotThrow(() => assertRoleTemplate('alpha', body));
});

test('roadmap role gets coordinate authority but remains repository-developer', () => {
  const parsed = parseProtocolBlock(roleIssueBody('netkeep80', 'roadmap', 'roadmap'));
  assert.equal(parsed.portfolio_authority, 'coordinate');
  assert.equal(parsed.role_kind, 'repository-developer');
});

test('role template rejects cross-owner and qualified repository input', () => {
  assert.throws(() => roleIssueBody('someone-else', 'roadmap', 'alpha'), /netkeep80/);
  assert.throws(() => roleIssueBody('netkeep80', 'roadmap', 'netkeep80\/alpha'), /unqualified/);
});
