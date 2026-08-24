import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentSnapshot, renderAgentStatus } from './agent-status.mjs';
import {
  analyzeOpenPullRequests,
  decidePullRequestPlan,
  extractPullRequestWorkItems,
  extractSupersededPullRequests,
} from './pr-reconciliation.mjs';
import { buildLiveAgentSnapshot } from './sync-agent-status.mjs';
import { validateWorkerPolicy } from './worker-runtime.mjs';

const repository = 'netkeep80/alpha';
const baseWorkerPolicy = {
  schema_version: 1,
  scope: 'public-owner-repositories',
  lease_seconds: 7200,
  heartbeat_target_seconds: 3600,
  work_source_order: ['handoff', 'message', 'local-issue'],
  no_work_action: 'exit',
  allow_speculative_work: false,
  coordinator_requires_declared_trigger: true,
};
const workerPolicy = { ...baseWorkerPolicy, pr_reconciliation_required: true };

function pr(number, body, overrides = {}) {
  return {
    number,
    state: 'open',
    body,
    changed_files: [],
    ...overrides,
  };
}

const block = (value) => `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->`;

test('extracts explicit local work items from normal PR closing/implementation phrases', () => {
  assert.deepEqual(
    extractPullRequestWorkItems({ repository, body: 'Closes #12\nImplements netkeep80/alpha#14\nParent: #99' }),
    ['netkeep80/alpha#12', 'netkeep80/alpha#14'],
  );
});

test('same work item has one reusable PR and never authorizes a second PR', () => {
  assert.deepEqual(decidePullRequestPlan({
    workItem: 'netkeep80/alpha#12',
    openPullRequests: [pr(20, 'Closes #12')],
  }), {
    action: 'reuse_existing_pr',
    current_pr: 'netkeep80/alpha#20',
    duplicate_prs: [],
    new_pr_allowed: false,
    target_writes_allowed: true,
  });
});

test('multiple open PRs for one work item fail closed until duplicate PRs are reconciled', () => {
  assert.deepEqual(decidePullRequestPlan({
    workItem: 'netkeep80/alpha#12',
    openPullRequests: [pr(20, 'Closes #12'), pr(21, 'Implements #12')],
  }), {
    action: 'reconcile_duplicate_prs',
    current_pr: null,
    duplicate_prs: [20, 21],
    new_pr_allowed: false,
    target_writes_allowed: false,
  });
});

test('shared changed files alone do not serialize independent work items', () => {
  assert.deepEqual(decidePullRequestPlan({
    workItem: 'netkeep80/alpha#12',
    openPullRequests: [pr(20, 'Closes #13', { changed_files: ['src/public.ts'] })],
  }), {
    action: 'create_new_pr',
    current_pr: null,
    duplicate_prs: [],
    new_pr_allowed: true,
    target_writes_allowed: true,
  });
});

test('open PR that declares an open superseded PR is reported as unreconciled', () => {
  assert.deepEqual(extractSupersededPullRequests('Supersedes: #10, #11\nDepends on: #7'), [10, 11]);
  assert.deepEqual(analyzeOpenPullRequests({
    repository,
    pullRequests: [
      pr(10, 'Closes #8'),
      pr(12, 'Closes #9\nSupersedes: #10'),
    ],
  }), {
    duplicate_work_items: [],
    unreconciled_supersessions: [{ replacement_pr: 12, superseded_pr: 10 }],
  });
});

test('worker policy requires PR reconciliation as a fail-closed invariant', () => {
  assert.throws(() => validateWorkerPolicy(structuredClone(baseWorkerPolicy)), /pr_reconciliation/i);
  assert.equal(validateWorkerPolicy(structuredClone(workerPolicy)).pr_reconciliation_required, true);
});

test('Agent Status projects exact duplicate-work and unreconciled-supersession diagnostics', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T12:00:00Z',
    roles: [{ issue_number: 49, repository: 'netkeep80/roadmap', portfolio_authority: 'coordinate' }],
    sessions: [],
    messages: [],
    workerPolicy,
    prDiagnostics: {
      duplicate_work_items: [{ repository: 'netkeep80/alpha', work_item: 'netkeep80/alpha#12', pr_numbers: [20, 21] }],
      unreconciled_supersessions: [{ repository: 'netkeep80/alpha', replacement_pr: 22, superseded_pr: 19 }],
    },
  });

  assert.equal(snapshot.duplicate_work_item_pr_count, 1);
  assert.equal(snapshot.unreconciled_supersession_count, 1);
  assert.deepEqual(snapshot.pr_diagnostics.duplicate_work_items[0].pr_numbers, [20, 21]);

  const markdown = renderAgentStatus(snapshot);
  assert.match(markdown, /Duplicate work-item PRs/i);
  assert.match(markdown, /netkeep80\/alpha#12/);
  assert.match(markdown, /Unreconciled supersessions/i);
});

test('live Agent Status scan reads open PRs for registered public repositories', async () => {
  const registry = {
    schema_version: 1,
    owner: 'netkeep80',
    scope: 'public-owner-repositories',
    control_repository: 'roadmap',
    repositories: [{ name: 'roadmap' }],
  };
  const repositories = [{ name: 'roadmap', private: false, visibility: 'public' }];
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
  const reads = [];
  const snapshot = await buildLiveAgentSnapshot({
    registry,
    workerPolicy,
    repositories,
    issues: [roleIssue],
    historicalIssues: [roleIssue],
    checkedAt: '2026-08-24T12:00:00Z',
    listComments: async () => [],
    listPullRequests: async (_owner, repo) => {
      reads.push(repo);
      return [pr(20, 'Closes #62'), pr(21, 'Implements #62')];
    },
  });

  assert.deepEqual(reads, ['roadmap']);
  assert.deepEqual(snapshot.pr_diagnostics.duplicate_work_items, [{
    repository: 'netkeep80/roadmap',
    work_item: 'netkeep80/roadmap#62',
    pr_numbers: [20, 21],
  }]);
});
