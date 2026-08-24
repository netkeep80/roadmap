import test from 'node:test';
import assert from 'node:assert/strict';

import { updateAgentStatusIssue } from './sync-agent-status.mjs';

test('updateAgentStatusIssue patches only the permanent dashboard issue through the GitHub Issues API', async () => {
  const calls = [];
  const api = async (pathname, options) => {
    calls.push({ pathname, options });
    return { number: 103, html_url: 'https://github.com/netkeep80/roadmap/issues/103' };
  };

  const result = await updateAgentStatusIssue({
    owner: 'netkeep80',
    repository: 'roadmap',
    issueNumber: 103,
    body: '# Agent Control Plane status\n',
    api,
  });

  assert.deepEqual(calls, [{
    pathname: '/repos/netkeep80/roadmap/issues/103',
    options: {
      method: 'PATCH',
      body: { body: '# Agent Control Plane status\n' },
    },
  }]);
  assert.equal(result.number, 103);
});
