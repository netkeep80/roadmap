import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLiveAgentSnapshot } from './sync-agent-status.mjs';

const block = (value) => `before\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\nafter`;

const registry = {
  schema_version: 1,
  owner: 'netkeep80',
  scope: 'public-owner-repositories',
  control_repository: 'roadmap',
  repositories: [{ name: 'roadmap' }],
};

const workerPolicy = {
  schema_version: 1,
  scope: 'public-owner-repositories',
  lease_seconds: 7200,
  heartbeat_target_seconds: 3600,
  work_source_order: ['handoff', 'message', 'local-issue'],
  no_work_action: 'exit',
  allow_speculative_work: false,
  coordinator_requires_declared_trigger: true,
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
  state: 'open',
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

const closedHistoricalSessionIssue = {
  ...terminalSessionIssue,
  number: 71,
  state: 'closed',
  html_url: 'https://github.com/netkeep80/roadmap/issues/71',
};

test('terminal Session marked comments are still validated fail-closed', async () => {
  let commentReads = 0;
  await assert.rejects(
    () => buildLiveAgentSnapshot({
      registry,
      workerPolicy,
      repositories,
      issues: [roleIssue, terminalSessionIssue],
      checkedAt: '2026-08-24T12:00:00Z',
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

test('valid terminal Checkpoint history is validated but terminal Session is not projected active', async () => {
  const snapshot = await buildLiveAgentSnapshot({
    registry,
    workerPolicy,
    repositories,
    issues: [roleIssue, terminalSessionIssue],
    checkedAt: '2026-08-24T12:00:00Z',
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

test('closed historical protocol Session comments are audited without resurrecting it into current projection', async () => {
  let commentReads = 0;
  await assert.rejects(
    () => buildLiveAgentSnapshot({
      registry,
      workerPolicy,
      repositories,
      issues: [roleIssue],
      historicalIssues: [roleIssue, closedHistoricalSessionIssue],
      checkedAt: '2026-08-24T12:00:00Z',
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
