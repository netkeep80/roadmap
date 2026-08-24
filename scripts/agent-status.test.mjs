import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAgentSnapshot, renderAgentStatus } from './agent-status.mjs';

const roles = [
  { issue_number: 49, repository: 'netkeep80/roadmap', portfolio_authority: 'coordinate' },
  { issue_number: 45, repository: 'netkeep80/mts_visual', portfolio_authority: 'propose' },
  { issue_number: 32, repository: 'netkeep80/anum_docs', portfolio_authority: 'propose' },
];

const sessions = [
  {
    number: 101,
    html_url: 'https://github.com/netkeep80/roadmap/issues/101',
    created_at: '2026-08-24T09:00:00Z',
    updated_at: '2026-08-24T09:10:00Z',
    data: {
      role_issue: 45,
      repository: 'netkeep80/mts_visual',
      state: 'working',
      claims: ['netkeep80/mts_visual#8'],
      current_pr: 'netkeep80/mts_visual#9',
      blocked_by: [],
    },
  },
  {
    number: 102,
    html_url: 'https://github.com/netkeep80/roadmap/issues/102',
    created_at: '2026-08-24T09:01:00Z',
    updated_at: '2026-08-24T09:11:00Z',
    data: {
      role_issue: 45,
      repository: 'netkeep80/mts_visual',
      state: 'working',
      claims: ['netkeep80/mts_visual#8'],
      current_pr: null,
      blocked_by: ['netkeep80/anum_docs#700'],
    },
  },
  {
    number: 103,
    html_url: 'https://github.com/netkeep80/roadmap/issues/103',
    created_at: '2026-08-24T08:00:00Z',
    updated_at: '2026-08-24T08:30:00Z',
    data: {
      role_issue: 32,
      repository: 'netkeep80/anum_docs',
      state: 'completed',
      claims: [],
      current_pr: null,
      blocked_by: [],
    },
  },
  {
    number: 104,
    html_url: 'https://github.com/netkeep80/roadmap/issues/104',
    created_at: '2026-08-24T09:02:00Z',
    updated_at: '2026-08-24T09:16:00Z',
    data: {
      role_issue: 45,
      repository: 'netkeep80/mts_visual',
      state: 'handoff',
      claims: [],
      current_pr: null,
      blocked_by: [],
    },
  },
];

const messages = [
  {
    number: 201,
    html_url: 'https://github.com/netkeep80/roadmap/issues/201',
    created_at: '2026-08-24T09:05:00Z',
    updated_at: '2026-08-24T09:06:00Z',
    data: {
      from_role_issue: 32,
      to_role_issues: [45],
      kind: 'dependency-ready',
      requires_ack: true,
      state: 'open',
      refs: ['netkeep80/anum_docs#701'],
    },
  },
  {
    number: 202,
    html_url: 'https://github.com/netkeep80/roadmap/issues/202',
    created_at: '2026-08-24T09:07:00Z',
    updated_at: '2026-08-24T09:08:00Z',
    data: {
      from_role_issue: 45,
      to_role_issues: [32],
      kind: 'blocker',
      requires_ack: true,
      state: 'acknowledged',
      refs: ['netkeep80/mts_visual#10'],
    },
  },
  {
    number: 203,
    html_url: 'https://github.com/netkeep80/roadmap/issues/203',
    created_at: '2026-08-24T09:09:00Z',
    updated_at: '2026-08-24T09:10:00Z',
    data: {
      from_role_issue: 45,
      to_role_issues: [32],
      kind: 'info',
      requires_ack: false,
      state: 'resolved',
      refs: [],
    },
  },
];

const checkpointsBySession = {
  101: [
    {
      created_at: '2026-08-24T09:12:00Z',
      data: {
        state: 'working',
        completed: ['renderer baseline accepted'],
        refs: ['netkeep80/mts_visual#9'],
        blockers: [],
        next: ['finish consumer handoff'],
        messages: [],
      },
    },
    {
      created_at: '2026-08-24T09:15:00Z',
      data: {
        state: 'handoff',
        completed: ['handoff prepared'],
        refs: ['netkeep80/mts_visual#9'],
        blockers: [],
        next: ['fresh agent revalidates exact main'],
        messages: ['netkeep80/roadmap#201'],
      },
    },
  ],
  104: [
    {
      created_at: '2026-08-24T09:17:00Z',
      data: {
        state: 'handoff',
        completed: ['durable handoff ready'],
        refs: ['netkeep80/mts_visual#8'],
        blockers: [],
        next: ['fresh session resumes after revalidation'],
        messages: [],
      },
    },
  ],
};

test('buildAgentSnapshot projects stable roles, leased sessions and resumable handoffs separately', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T09:20:00Z',
    roles,
    sessions,
    messages,
    checkpointsBySession,
  });

  assert.equal(snapshot.schema_version, 1);
  assert.equal(snapshot.role_count, 3);
  assert.deepEqual(snapshot.roles.map((role) => role.repository), [
    'netkeep80/anum_docs',
    'netkeep80/mts_visual',
    'netkeep80/roadmap',
  ]);
  assert.deepEqual(snapshot.active_sessions.map((session) => session.issue_number), [101, 102]);
  assert.equal(snapshot.active_session_count, 2);
  assert.deepEqual(snapshot.resumable_handoffs.map((session) => session.issue_number), [104]);
  assert.equal(snapshot.resumable_handoff_count, 1);
  assert.equal(snapshot.active_sessions[0].latest_checkpoint.created_at, '2026-08-24T09:15:00Z');
  assert.equal(snapshot.active_sessions[0].last_activity_at, '2026-08-24T09:15:00Z');
  assert.equal(snapshot.resumable_handoffs[0].latest_checkpoint.created_at, '2026-08-24T09:17:00Z');
});

test('claim projection resolves collisions deterministically without treating handoff as contender', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T09:20:00Z',
    roles,
    sessions,
    messages,
    checkpointsBySession,
  });

  assert.equal(snapshot.claims.length, 1);
  assert.deepEqual(snapshot.claims[0], {
    ref: 'netkeep80/mts_visual#8',
    winner_session_issue: 101,
    contenders: [101, 102],
    conflict: true,
  });
});

test('unresolved messages and blocker projection exclude resolved messages', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T09:20:00Z',
    roles,
    sessions,
    messages,
    checkpointsBySession,
  });

  assert.deepEqual(snapshot.unresolved_messages.map((message) => message.issue_number), [201, 202]);
  assert.equal(snapshot.blockers.some((blocker) => blocker.source === 'session' && blocker.ref === 'netkeep80/anum_docs#700'), true);
  assert.equal(snapshot.blockers.some((blocker) => blocker.source === 'message' && blocker.message_issue === 202), true);
  assert.equal(snapshot.unresolved_messages.some((message) => message.issue_number === 203), false);
});

test('renderAgentStatus exposes copyable role URLs and separates resumable handoffs', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T09:20:00Z',
    roles,
    sessions,
    messages,
    checkpointsBySession,
  });
  const markdown = renderAgentStatus(snapshot);

  assert.match(markdown, /GENERATED FILE/);
  assert.match(markdown, /netkeep80\/mts_visual/);
  assert.match(markdown, /roadmap\/issues\/45/);
  assert.match(markdown, /claim collision/i);
  assert.match(markdown, /#201/);
  assert.match(markdown, /Resumable handoffs/i);
  assert.match(markdown, /#104/);
});
