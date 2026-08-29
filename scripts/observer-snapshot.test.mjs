import test from 'node:test';
import assert from 'node:assert/strict';

import { validateObserverSnapshot } from './observer-snapshot.mjs';

function validSnapshot(overrides = {}) {
  return {
    protocol: 'roadmap-observer/v1',
    role: 'ci-sentinel',
    observed_at: '2026-08-29T17:00:00Z',
    status: 'attention',
    items: [
      {
        repository: 'netkeep80/roadmap',
        subject: 'pr:415',
        classification: 'ci-failing',
        evidence: ['check:Portfolio validate'],
        needs_reasoning: true,
      },
    ],
    ...overrides,
  };
}

test('accepts a valid observer snapshot for the expected role', () => {
  const result = validateObserverSnapshot(validSnapshot(), 'ci-sentinel');
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('accepts not-run only with a null observation time and no items', () => {
  const result = validateObserverSnapshot({
    protocol: 'roadmap-observer/v1',
    role: 'pr-watchdog',
    observed_at: null,
    status: 'not-run',
    items: [],
  }, 'pr-watchdog');
  assert.equal(result.ok, true);
});

test('rejects protocol and role mismatches', () => {
  const result = validateObserverSnapshot(validSnapshot({
    protocol: 'roadmap-worker-slot/v1',
    role: 'pr-watchdog',
  }), 'ci-sentinel');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /protocol/);
  assert.match(result.errors.join('\n'), /role/);
});

test('rejects unknown status and invalid observation timestamps', () => {
  const result = validateObserverSnapshot(validSnapshot({
    observed_at: 'yesterday',
    status: 'working',
  }), 'ci-sentinel');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /observed_at/);
  assert.match(result.errors.join('\n'), /status/);
});

test('rejects malformed evidence items and inferred-cause fields', () => {
  const result = validateObserverSnapshot(validSnapshot({
    items: [{
      repository: 'roadmap',
      subject: '',
      classification: 'ci-failing',
      evidence: [],
      root_cause: 'probably flaky',
    }],
  }), 'ci-sentinel');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /repository/);
  assert.match(result.errors.join('\n'), /subject/);
  assert.match(result.errors.join('\n'), /evidence/);
  assert.match(result.errors.join('\n'), /root_cause/);
});

test('rejects more than 100 retained items', () => {
  const item = {
    repository: 'netkeep80/roadmap',
    subject: 'issue:1',
    classification: 'stale',
    evidence: ['issue:1'],
  };
  const result = validateObserverSnapshot(validSnapshot({
    items: Array.from({ length: 101 }, () => ({ ...item })),
    truncated: true,
    total_items: 101,
  }), 'ci-sentinel');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /100/);
});

test('requires coherent truncation metadata', () => {
  const result = validateObserverSnapshot(validSnapshot({
    truncated: true,
    total_items: 0,
  }), 'ci-sentinel');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /total_items/);
});

test('rejects unexpected top-level fields', () => {
  const result = validateObserverSnapshot(validSnapshot({ assignment: { work_item: 'x' } }), 'ci-sentinel');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /assignment/);
});
