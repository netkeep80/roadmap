import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLiveAgentSnapshot,
  collectAgentStatusInputs,
  updateAgentStatusIssue,
} from './sync-agent-status.mjs';

const block = (value) => `before\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\nafter`;

const registry = {
  schema_version: 1,
  owner: 'netkeep80',
  scope: 'public-owner-repositories',
  control_repository: 'roadmap',
  repositories: [{ name: 'roadmap' }],
};

const repositories = [
  { name: 'roadmap', private: false, visibility: 'public' },
];

const roleIssue = {
  number: 49,
  state: 'open',
  html_url: 'https://github.com/netkeep80/roadmap/issues/49',
  created_at: '2026-08-24T09:00:00Z',
  updated_at: '2026-08-24T09:00:00Z',
  body: block({
    protocol: 'roadmap-agent-role/v1',
    repository: 'netkeep80/roadmap',
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: 'coordinate',
  }),
};

const terminalSessionIssue = {
  number: 70,
  state: 'closed',
  html_url: 'https://github.com/netkeep80/roadmap/issues/70',
  created_at: '2026-08-24T09:10:00Z',
  updated_at: '2026-08-24T09:20:00Z',
  body: block({
    protocol: 'roadmap-agent-session/v1',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    state: 'completed',
    claims: [],
    current_pr: null,
    blocked_by: [],
  }),
};

const terminalV2SessionIssue = {
  number: 72,
  state: 'closed',
  html_url: 'https://github.com/netkeep80/roadmap/issues/72',
  created_at: '2026-08-24T09:30:00Z',
  updated_at: '2026-08-24T09:40:00Z',
  body: block({
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: 'netkeep80/roadmap#62',
    work_phase: 'implementation',
    state: 'completed',
    claims: [],
    current_branch: null,
    current_pr: null,
    blocked_by: [],
  }),
};

const closedHistoricalSessionIssue = {
  ...terminalSessionIssue,
  number: 71,
  html_url: 'https://github.com/netkeep80/roadmap/issues/71',
};

const noPullRequests = async () => [];

test('default Agent Status input collection stays on current open operational issues', async () => {
  let historicalReads = 0;
  const live = { repositories, issues: [roleIssue] };
  const result = await collectAgentStatusInputs(registry, {
    collectLive: async () => live,
    listHistorical: async () => {
      historicalReads += 1;
      return [roleIssue, terminalSessionIssue];
    },
  });

  assert.equal(historicalReads, 0);
  assert.deepEqual(result.repositories, repositories);
  assert.deepEqual(result.issues, [roleIssue]);
  assert.strictEqual(result.historicalIssues, result.issues);
});

test('explicit historical audit preserves full Session history collection', async () => {
  let historicalReads = 0;
  const historicalIssues = [roleIssue, terminalSessionIssue, terminalV2SessionIssue];
  const result = await collectAgentStatusInputs(registry, {
    auditHistory: true,
    collectLive: async () => ({ repositories, issues: [roleIssue] }),
    listHistorical: async (owner, repository) => {
      historicalReads += 1;
      assert.equal(owner, 'netkeep80');
      assert.equal(repository, 'roadmap');
      return historicalIssues;
    },
  });

  assert.equal(historicalReads, 1);
  assert.strictEqual(result.historicalIssues, historicalIssues);
});

test('terminal Session marked comments are still validated fail-closed without scheduled-worker policy', async () => {
  let commentReads = 0;
  await assert.rejects(
    () => buildLiveAgentSnapshot({
      registry,
      repositories,
      issues: [roleIssue],
      historicalIssues: [roleIssue, terminalSessionIssue],
      checkedAt: '2026-08-24T12:00:00Z',
      listPullRequests: noPullRequests,
      listComments: async () => {
        commentReads += 1;
        return [{
          id: 999,
          created_at: '2026-08-24T09:15:00Z',
          updated_at: '2026-08-24T09:15:00Z',
          body: block({
            protocol: 'roadmap-agent-message/v1',
            from_role_issue: 49,
            to_role_issues: [49],
            kind: 'info',
            requires_ack: false,
            state: 'open',
            refs: ['netkeep80/roadmap#55'],
          }),
        }];
      },
    }),
    /not a checkpoint|checkpoint/i,
  );
  assert.equal(commentReads, 1);
});

test('valid terminal Checkpoint history is validated but closed Session is not projected active', async () => {
  const snapshot = await buildLiveAgentSnapshot({
    registry,
    repositories,
    issues: [roleIssue],
    historicalIssues: [roleIssue, terminalSessionIssue],
    checkedAt: '2026-08-24T12:00:00Z',
    listPullRequests: noPullRequests,
    listComments: async () => [{
      id: 1000,
      created_at: '2026-08-24T09:15:00Z',
      updated_at: '2026-08-24T09:15:00Z',
      body: block({
        protocol: 'roadmap-agent-checkpoint/v1',
        state: 'completed',
        completed: ['accepted terminal state'],
        refs: ['netkeep80/roadmap#55'],
        blockers: [],
        next: [],
        messages: [],
      }),
    }],
  });

  assert.equal(snapshot.active_session_count, 0);
});

test('historical status audit dual-reads a valid v2 Session and v2 Checkpoint', async () => {
  const snapshot = await buildLiveAgentSnapshot({
    registry,
    repositories,
    issues: [roleIssue],
    historicalIssues: [roleIssue, terminalV2SessionIssue],
    checkedAt: '2026-08-24T12:00:00Z',
    listPullRequests: noPullRequests,
    listComments: async (_owner, _repository, issueNumber) => issueNumber === 72 ? [{
      id: 1002,
      created_at: '2026-08-24T09:35:00Z',
      updated_at: '2026-08-24T09:35:00Z',
      body: block({
        protocol: 'roadmap-agent-checkpoint/v2',
        state: 'completed',
        work_item: 'netkeep80/roadmap#62',
        completed: ['accepted terminal v2 state'],
        refs: ['netkeep80/roadmap#62'],
        blockers: [],
        next: [],
        messages: [],
        current_branch: null,
      }),
    }] : [],
  });

  assert.equal(snapshot.active_session_count, 0);
});

test('closed historical protocol Session comments are audited without resurrecting it into current projection', async () => {
  let commentReads = 0;
  await assert.rejects(
    () => buildLiveAgentSnapshot({
      registry,
      repositories,
      issues: [roleIssue],
      historicalIssues: [roleIssue, closedHistoricalSessionIssue],
      checkedAt: '2026-08-24T12:00:00Z',
      listPullRequests: noPullRequests,
      listComments: async (_owner, _repository, issueNumber) => {
        if (issueNumber !== 71) return [];
        commentReads += 1;
        return [{
          id: 1001,
          created_at: '2026-08-24T09:16:00Z',
          updated_at: '2026-08-24T09:16:00Z',
          body: block({
            protocol: 'roadmap-agent-message/v1',
            from_role_issue: 49,
            to_role_issues: [49],
            kind: 'info',
            requires_ack: false,
            state: 'open',
            refs: ['netkeep80/roadmap#55'],
          }),
        }];
      },
    }),
    /not a checkpoint|checkpoint/i,
  );
  assert.equal(commentReads, 1);
});

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
