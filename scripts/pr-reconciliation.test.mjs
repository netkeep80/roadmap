import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeOpenPullRequests,
  decidePullRequestPlan,
  extractPullRequestWorkItems,
  extractSupersededPullRequests,
} from './pr-reconciliation.mjs';

const repository = 'netkeep80/alpha';

function pr(number, body, overrides = {}) {
  return {
    number,
    state: 'open',
    body,
    changed_files: [],
    ...overrides,
  };
}

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
