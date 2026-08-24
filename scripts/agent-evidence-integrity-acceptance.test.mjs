import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { validateCheckpointEventEvidence } from './agent-evidence-integrity.mjs';

const START = '<!-- roadmap-agent:start -->';
const END = '<!-- roadmap-agent:end -->';
const HEAD = '0123456789abcdef0123456789abcdef01234567';
const BASE = '89abcdef0123456789abcdef0123456789abcdef';
const REGISTRY = {
  owner: 'netkeep80',
  control_repository: 'roadmap',
  repositories: [{ name: 'roadmap' }],
};

function block(data) {
  return `${START}\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n${END}`;
}

function sessionBody({ phase = 'implementation', state = 'working', claims, number = 139 } = {}) {
  const workItem = `netkeep80/roadmap#${number}`;
  return block({
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: workItem,
    work_phase: phase,
    state,
    claims: claims ?? (state === 'working' ? [workItem] : []),
    current_branch: null,
    current_pr: 'netkeep80/roadmap#142',
    blocked_by: [],
  });
}

function candidateData(overrides = {}) {
  return {
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
      pr: 'netkeep80/roadmap#142',
      head_sha: HEAD,
      base_sha: BASE,
    },
    ...overrides,
  };
}

function acceptanceData(overrides = {}) {
  return {
    protocol: 'roadmap-agent-checkpoint/v2',
    state: 'working',
    work_item: 'netkeep80/roadmap#139',
    completed: ['review complete'],
    refs: [],
    blockers: [],
    next: [],
    messages: [],
    acceptance: {
      candidate_session: 900,
      candidate_checkpoint_comment_id: 7001,
      work_item: 'netkeep80/roadmap#139',
      pr: 'netkeep80/roadmap#142',
      head_sha: HEAD,
      base_sha: BASE,
      decision: 'accepted',
      ...overrides,
    },
  };
}

function exactPr(number = 142) {
  return { number, state: 'open', head: { sha: HEAD }, base: { sha: BASE } };
}

function candidateIssue() {
  return {
    number: 900,
    created_at: '2026-08-24T20:00:00Z',
    body: sessionBody({ state: 'handoff', claims: [] }),
  };
}

function candidateComment(createdAt = '2026-08-24T20:10:00Z') {
  return {
    id: 7001,
    issue_number: 900,
    created_at: createdAt,
    body: block(candidateData()),
  };
}

function acceptanceEvent(data = acceptanceData(), {
  sessionCreatedAt = '2026-08-24T20:20:00Z',
  commentCreatedAt = '2026-08-24T20:30:00Z',
  action = 'created',
} = {}) {
  return {
    action,
    issue: {
      number: 901,
      created_at: sessionCreatedAt,
      body: sessionBody({ phase: 'acceptance' }),
    },
    comment: {
      id: 7002,
      created_at: commentCreatedAt,
      body: block(data),
    },
  };
}

function acceptanceResolvers({ candidateCommentCreatedAt } = {}) {
  return {
    resolvePullRequest: async (_repository, number) => exactPr(number),
    resolveControlIssue: async () => candidateIssue(),
    resolveControlComment: async () => candidateComment(candidateCommentCreatedAt),
  };
}

test('event boundary rejects invalid acceptance decision using the common v2 checkpoint schema', async () => {
  await assert.rejects(
    () => validateCheckpointEventEvidence({
      event: acceptanceEvent(acceptanceData({ decision: 'maybe' })),
      registry: REGISTRY,
      ...acceptanceResolvers(),
    }),
    /acceptance decision|decision.*accepted|changes_requested/i,
  );
});

test('event boundary rejects malformed generic checkpoint fields before evidence resolution', async () => {
  await assert.rejects(
    () => validateCheckpointEventEvidence({
      event: {
        action: 'created',
        issue: {
          number: 900,
          created_at: '2026-08-24T20:00:00Z',
          body: sessionBody(),
        },
        comment: {
          id: 7001,
          created_at: '2026-08-24T20:10:00Z',
          body: block(candidateData({ completed: 'not-an-array' })),
        },
      },
      registry: REGISTRY,
      resolvePullRequest: async (_repository, number) => exactPr(number),
    }),
    /checkpoint completed|completed.*array/i,
  );
});

test('editing an authority-bearing v2 checkpoint cannot remove its authority object', async () => {
  const nonAuthority = candidateData();
  delete nonAuthority.review_candidate;
  nonAuthority.completed = ['authority removed'];

  await assert.rejects(
    () => validateCheckpointEventEvidence({
      event: {
        action: 'edited',
        issue: {
          number: 900,
          created_at: '2026-08-24T20:00:00Z',
          body: sessionBody(),
        },
        comment: {
          id: 7001,
          created_at: '2026-08-24T20:10:00Z',
          body: block(nonAuthority),
        },
        changes: { body: { from: block(candidateData()) } },
      },
      registry: REGISTRY,
    }),
    /authority-bearing|immutable|cannot be edited/i,
  );
});

test('deleting an authority-bearing v2 checkpoint fails closed at the changed-event boundary', async () => {
  await assert.rejects(
    () => validateCheckpointEventEvidence({
      event: {
        action: 'deleted',
        issue: {
          number: 900,
          created_at: '2026-08-24T20:00:00Z',
          body: sessionBody(),
        },
        comment: {
          id: 7001,
          created_at: '2026-08-24T20:10:00Z',
          body: block(candidateData()),
        },
      },
      registry: REGISTRY,
    }),
    /authority-bearing|deleted|immutable/i,
  );
});

test('final acceptance requires the candidate seal to predate the fresh acceptance Session', async () => {
  await assert.rejects(
    () => validateCheckpointEventEvidence({
      event: acceptanceEvent(acceptanceData(), {
        sessionCreatedAt: '2026-08-24T20:20:00Z',
        commentCreatedAt: '2026-08-24T20:30:00Z',
      }),
      registry: REGISTRY,
      ...acceptanceResolvers({ candidateCommentCreatedAt: '2026-08-24T20:25:00Z' }),
    }),
    /fresh|chronolog|candidate.*precede|predate/i,
  );
});

test('automatic Agent Status event validator includes issue_comment deletion', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  assert.match(workflow, /github\.event\.action == 'deleted'/);
  assert.match(workflow, /node scripts\/agent-evidence-integrity\.mjs --validate-event/);
  assert.doesNotMatch(workflow, /--validate-live/);
});

test('workflow routing sees previous body when an edited checkpoint removes the entire protocol marker', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  const previousBodyMarkerChecks = workflow.match(/contains\(github\.event\.changes\.body\.from \|\| '', '<!-- roadmap-agent:start -->'\)/g) ?? [];
  assert.ok(previousBodyMarkerChecks.length >= 2, 'both Session and Checkpoint edit routing must inspect changes.body.from');
  assert.match(workflow, /github\.event_name == 'issue_comment'[\s\S]*?github\.event\.action == 'edited'[\s\S]*?changes\.body\.from/);
});

test('workflow routing sees previous body when an edited v2 Session removes the entire protocol marker', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  assert.match(workflow, /github\.event_name == 'issues'[\s\S]*?github\.event\.action == 'edited'[\s\S]*?changes\.body\.from/);
  assert.match(workflow, /name: Publish current worker state to permanent Issue[\s\S]*?github\.event_name != 'issue_comment'/);
  assert.doesNotMatch(workflow, /--validate-live/);
});
