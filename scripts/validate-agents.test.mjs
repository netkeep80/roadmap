import test from 'node:test';
import assert from 'node:assert/strict';

import { publicRepositoryNames, validateLiveAgentState } from './validate-agents.mjs';

const block = (value) => `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->`;

const roleIssue = (repository, number) => ({
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

test('publicRepositoryNames excludes every non-public inventory object before projection', () => {
  const names = publicRepositoryNames([
    { name: 'alpha', private: false, visibility: 'public' },
    { name: 'should-not-leak', private: true, visibility: 'private' },
    { name: 'beta', private: false, visibility: 'public' },
  ]);
  assert.deepEqual(names, ['alpha', 'beta']);
});

test('live validation is advisory during role bootstrap', async () => {
  const result = await validateLiveAgentState({
    registry: {
      scope: 'public-owner-repositories',
      repositories: [{ name: 'alpha' }, { name: 'roadmap' }],
    },
    repositories: [
      { name: 'alpha', private: false, visibility: 'public' },
      { name: 'roadmap', private: false, visibility: 'public' },
    ],
    issues: [roleIssue('roadmap', 10)],
    enforce: false,
  });

  assert.deepEqual(result.missing_roles, ['alpha']);
  assert.equal(result.role_count, 1);
  assert.equal(result.enforcement, 'advisory');
});

test('live validation becomes blocking only after rollout', async () => {
  await assert.rejects(
    () => validateLiveAgentState({
      registry: {
        scope: 'public-owner-repositories',
        repositories: [{ name: 'alpha' }, { name: 'roadmap' }],
      },
      repositories: [
        { name: 'alpha', private: false, visibility: 'public' },
        { name: 'roadmap', private: false, visibility: 'public' },
      ],
      issues: [roleIssue('roadmap', 10)],
      enforce: true,
    }),
    /missing/i,
  );
});

test('live validation never treats a non-public repository as role coverage', async () => {
  await assert.rejects(
    () => validateLiveAgentState({
      registry: {
        scope: 'public-owner-repositories',
        repositories: [{ name: 'alpha' }, { name: 'should-not-leak' }],
      },
      repositories: [
        { name: 'alpha', private: false, visibility: 'public' },
        { name: 'should-not-leak', private: true, visibility: 'private' },
      ],
      issues: [roleIssue('alpha', 10)],
      enforce: false,
    }),
    /coverage mismatch|public.*registry|registry.*public/i,
  );
});
