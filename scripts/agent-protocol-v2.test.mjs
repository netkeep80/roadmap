import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCheckpoint, validateSession } from './agent-protocol.mjs';

const START = '<!-- roadmap-agent:start -->';
const END = '<!-- roadmap-agent:end -->';

function block(data) {
  return `${START}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n${END}`;
}

const roleMap = new Map([[49, {
  protocol: 'roadmap-agent-role/v1',
  repository: 'netkeep80/roadmap',
  scope: 'public-only',
  state: 'active',
  role_kind: 'repository-developer',
  portfolio_authority: 'coordinate',
  issue_number: 49,
}]]);

function sessionIssue(overrides = {}) {
  const data = {
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: 'netkeep80/roadmap#139',
    work_phase: 'implementation',
    state: 'working',
    claims: ['netkeep80/roadmap#139'],
    current_branch: null,
    current_pr: null,
    blocked_by: [],
    ...overrides,
  };
  return {
    number: 900,
    state: ['completed', 'abandoned'].includes(data.state) ? 'closed' : 'open',
    created_at: '2026-08-24T19:50:13Z',
    body: block(data),
  };
}

test('Session v2 accepts one exact work item and implementation phase', () => {
  const data = validateSession(sessionIssue(), roleMap);
  assert.equal(data.protocol, 'roadmap-agent-session/v2');
  assert.equal(data.work_item, 'netkeep80/roadmap#139');
  assert.equal(data.work_phase, 'implementation');
});

test('Session v2 claim must be empty or exactly its work_item', () => {
  assert.throws(
    () => validateSession(sessionIssue({ claims: ['netkeep80/roadmap#140'] }), roleMap),
    /v2 claim must equal session work_item/,
  );
  assert.throws(
    () => validateSession(sessionIssue({ claims: ['netkeep80/roadmap#139', 'netkeep80/roadmap#140'] }), roleMap),
    /v2 Session can claim at most one work item/,
  );
});

test('Session v2 work_item must belong to the Session repository', () => {
  assert.throws(
    () => validateSession(sessionIssue({ work_item: 'netkeep80/other#1', claims: [] }), roleMap),
    /work_item .* must belong to repository roadmap/,
  );
});

test('Session v2 phase is implementation or acceptance only', () => {
  assert.throws(
    () => validateSession(sessionIssue({ work_phase: 'review' }), roleMap),
    /work_phase must be implementation or acceptance/,
  );
});

test('acceptance Session v2 cannot own an implementation branch', () => {
  assert.throws(
    () => validateSession(sessionIssue({
      work_phase: 'acceptance',
      current_branch: { repository: 'netkeep80/roadmap', name: 'agent/example' },
    }), roleMap),
    /acceptance Session cannot retain current_branch/,
  );
});

test('Checkpoint v2 mirrors work_item and validates an implementation candidate shape', () => {
  const sessionData = validateSession(sessionIssue({ current_pr: 'netkeep80/roadmap#150' }), roleMap);
  const checkpoint = {
    body: block({
      protocol: 'roadmap-agent-checkpoint/v2',
      state: 'working',
      work_item: 'netkeep80/roadmap#139',
      completed: ['candidate sealed'],
      refs: [],
      blockers: [],
      next: ['independent acceptance'],
      messages: [],
      review_candidate: {
        work_item: 'netkeep80/roadmap#139',
        pr: 'netkeep80/roadmap#150',
        head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        base_sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    }),
  };
  const data = validateCheckpoint(checkpoint, roleMap, sessionData);
  assert.equal(data.review_candidate.head_sha, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
});

test('Checkpoint v2 cannot drift from Session work_item', () => {
  const sessionData = validateSession(sessionIssue(), roleMap);
  const checkpoint = {
    body: block({
      protocol: 'roadmap-agent-checkpoint/v2',
      state: 'working',
      work_item: 'netkeep80/roadmap#140',
      completed: [], refs: [], blockers: [], next: [], messages: [],
    }),
  };
  assert.throws(
    () => validateCheckpoint(checkpoint, roleMap, sessionData),
    /checkpoint work_item must match Session work_item/,
  );
});

test('v1 Session remains readable without v2 fields', () => {
  const issue = sessionIssue({
    protocol: 'roadmap-agent-session/v1',
    work_item: undefined,
    work_phase: undefined,
    claims: ['netkeep80/roadmap#139'],
  });
  const parsed = JSON.parse(issue.body.match(/```json\n([\s\S]*?)\n```/)[1]);
  delete parsed.work_item;
  delete parsed.work_phase;
  issue.body = block(parsed);
  const data = validateSession(issue, roleMap);
  assert.equal(data.protocol, 'roadmap-agent-session/v1');
});
