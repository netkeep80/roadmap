import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  parseProtocolBlock,
  validateCheckpoint,
  validateRoleCoverage,
  validateSession,
} from './agent-protocol.mjs';
import * as workerRuntime from './worker-runtime.mjs';
import { buildAgentSnapshot, renderAgentStatus } from './agent-status.mjs';

const block = (value) => `before\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\nafter`;

const role = (repository, number) => ({
  number,
  state: 'open',
  created_at: '2026-08-24T09:00:00Z',
  body: block({
    protocol: 'roadmap-agent-role/v1',
    repository: `netkeep80/${repository}`,
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: repository === 'roadmap' ? 'coordinate' : 'propose',
  }),
});

const coverage = () => validateRoleCoverage(
  ['roadmap', 'alpha', 'beta'],
  ['roadmap', 'alpha', 'beta'],
  [role('roadmap', 49), role('alpha', 10), role('beta', 11)],
);

function session({
  repository = 'alpha',
  roleIssue = 10,
  state = 'working',
  claims = ['netkeep80/alpha#7'],
  currentBranch = undefined,
  currentPr = null,
  number = 100,
} = {}) {
  const data = {
    protocol: 'roadmap-agent-session/v1',
    role_issue: roleIssue,
    repository: `netkeep80/${repository}`,
    state,
    claims,
    current_pr: currentPr,
    blocked_by: [],
  };
  if (currentBranch !== undefined) data.current_branch = currentBranch;
  return {
    number,
    state: state === 'completed' || state === 'abandoned' ? 'closed' : 'open',
    created_at: '2026-08-24T10:00:00Z',
    body: block(data),
  };
}

function checkpoint(currentBranch, overrides = {}) {
  const data = {
    protocol: 'roadmap-agent-checkpoint/v1',
    state: 'working',
    completed: ['validated exact target state'],
    refs: ['netkeep80/alpha#7'],
    blockers: [],
    next: ['continue exact branch'],
    messages: [],
    ...overrides,
  };
  if (currentBranch !== undefined) data.current_branch = currentBranch;
  return {
    id: 300,
    created_at: '2026-08-24T10:30:00Z',
    body: block(data),
  };
}

const owned = (name = 'agent/issue-7') => ({ repository: 'netkeep80/alpha', name });

test('Session current_branch is a same-repository public branch while historical v1 omission remains valid', () => {
  const roles = coverage().roleMap;
  const parsed = validateSession(session({ currentBranch: owned() }), roles);
  assert.deepEqual(parsed.current_branch, owned());
  assert.doesNotThrow(() => validateSession(session({ currentBranch: undefined }), roles));

  assert.throws(
    () => validateSession(session({ currentBranch: { repository: 'netkeep80/beta', name: 'agent/issue-7' } }), roles),
    /current_branch|repository|same/i,
  );
  assert.throws(
    () => validateSession(session({ currentBranch: { repository: 'other/private', name: 'agent/issue-7' } }), roles),
    /current_branch|public|registered|repository/i,
  );
  assert.throws(
    () => validateSession(session({ currentBranch: { repository: 'netkeep80/alpha', name: 'refs/heads/agent/issue-7' } }), roles),
    /current_branch|branch|name/i,
  );
});

test('terminal Sessions cannot retain current_branch ownership but a genuine handoff may', () => {
  const roles = coverage().roleMap;
  assert.throws(
    () => validateSession(session({ state: 'completed', claims: [], currentBranch: owned() }), roles),
    /current_branch|terminal|completed|ownership/i,
  );
  assert.doesNotThrow(() => validateSession(session({ state: 'handoff', claims: [], currentBranch: owned() }), roles));
});

test('Checkpoint current_branch must preserve exact Session branch ownership when ownership is live', () => {
  const roles = coverage().roleMap;
  const sessionData = validateSession(session({ currentBranch: owned() }), roles);
  const parsed = validateCheckpoint(checkpoint(owned()), roles, sessionData);
  assert.deepEqual(parsed.current_branch, owned());
  assert.throws(
    () => validateCheckpoint(checkpoint(undefined), roles, sessionData),
    /current_branch|checkpoint|ownership/i,
  );
  assert.throws(
    () => validateCheckpoint(checkpoint(owned('agent/other')), roles, sessionData),
    /current_branch|checkpoint|ownership|match/i,
  );
});

test('worker policy explicitly requires branch reconciliation', () => {
  const base = {
    schema_version: 1,
    scope: 'public-owner-repositories',
    lease_seconds: 7200,
    heartbeat_target_seconds: 3600,
    work_source_order: ['handoff', 'message', 'local-issue'],
    no_work_action: 'exit',
    allow_speculative_work: false,
    coordinator_requires_declared_trigger: true,
    pr_reconciliation_required: true,
  };
  assert.equal(workerRuntime.validateWorkerPolicy({ ...base, branch_reconciliation_required: true }).branch_reconciliation_required, true);
  assert.throws(
    () => workerRuntime.validateWorkerPolicy({ ...base, branch_reconciliation_required: false }),
    /branch_reconciliation/i,
  );
});

test('branch preparation persists ownership before create, then reuses an owned pre-PR branch', () => {
  assert.equal(typeof workerRuntime.decideBranchPreparation, 'function');

  const intended = owned();
  assert.deepEqual(workerRuntime.decideBranchPreparation({
    claimWon: true,
    currentBranch: null,
    intendedBranch: intended,
    branchExists: false,
    matchingOpenPr: null,
  }), {
    action: 'persist_current_branch',
    current_branch: intended,
    branch_creation_allowed: false,
    target_writes_allowed: false,
  });

  assert.deepEqual(workerRuntime.decideBranchPreparation({
    claimWon: true,
    currentBranch: intended,
    intendedBranch: intended,
    branchExists: false,
    matchingOpenPr: null,
  }), {
    action: 'create_owned_branch',
    current_branch: intended,
    branch_creation_allowed: true,
    target_writes_allowed: true,
  });

  assert.deepEqual(workerRuntime.decideBranchPreparation({
    claimWon: true,
    currentBranch: intended,
    intendedBranch: intended,
    branchExists: true,
    matchingOpenPr: null,
  }), {
    action: 'reuse_owned_pre_pr_branch',
    current_branch: intended,
    branch_creation_allowed: false,
    target_writes_allowed: true,
  });
});

test('collision loser can never create or reuse a target branch', () => {
  const intended = owned();
  assert.deepEqual(workerRuntime.decideBranchPreparation({
    claimWon: false,
    currentBranch: intended,
    intendedBranch: intended,
    branchExists: true,
    matchingOpenPr: null,
  }), {
    action: 'claim_not_won',
    current_branch: intended,
    branch_creation_allowed: false,
    target_writes_allowed: false,
  });
});

test('Agent Status exposes current branches and reports terminal owned-branch residue as drift', () => {
  const active = {
    number: 100,
    html_url: 'https://github.com/netkeep80/roadmap/issues/100',
    created_at: '2026-08-24T10:00:00Z',
    updated_at: '2026-08-24T10:05:00Z',
    data: {
      role_issue: 10,
      repository: 'netkeep80/alpha',
      state: 'working',
      claims: ['netkeep80/alpha#7'],
      current_branch: owned('agent/active'),
      current_pr: null,
      blocked_by: [],
    },
  };
  const terminal = {
    number: 90,
    html_url: 'https://github.com/netkeep80/roadmap/issues/90',
    created_at: '2026-08-24T08:00:00Z',
    updated_at: '2026-08-24T09:00:00Z',
    data: {
      role_issue: 10,
      repository: 'netkeep80/alpha',
      state: 'completed',
      claims: [],
      current_branch: null,
      current_pr: null,
      blocked_by: [],
    },
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
    pr_reconciliation_required: true,
    branch_reconciliation_required: true,
  };
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T10:20:00Z',
    roles: [
      { issue_number: 49, repository: 'netkeep80/roadmap', portfolio_authority: 'coordinate' },
      { issue_number: 10, repository: 'netkeep80/alpha', portfolio_authority: 'propose' },
    ],
    sessions: [active],
    historicalSessions: [active, terminal],
    messages: [],
    workerPolicy,
    checkpointsBySession: {
      90: [
        { created_at: '2026-08-24T08:30:00Z', data: { state: 'working', refs: [], blockers: [], messages: [], current_branch: owned('agent/orphan') } },
        { created_at: '2026-08-24T08:59:00Z', data: { state: 'completed', refs: [], blockers: [], messages: [], current_branch: null } },
      ],
    },
    branchFactsByRepository: {
      'netkeep80/alpha': [
        { name: 'agent/active', sha: '1111111111111111111111111111111111111111' },
        { name: 'agent/orphan', sha: '2222222222222222222222222222222222222222' },
      ],
    },
  });

  assert.deepEqual(snapshot.active_sessions[0].current_branch, owned('agent/active'));
  assert.equal(snapshot.branch_drift_count, 1);
  assert.deepEqual(snapshot.branch_drift[0], {
    repository: 'netkeep80/alpha',
    branch: 'agent/orphan',
    sha: '2222222222222222222222222222222222222222',
    terminal_session_issue: 90,
    state: 'terminal-branch-residue',
  });
  const markdown = renderAgentStatus(snapshot);
  assert.match(markdown, /Current branch/i);
  assert.match(markdown, /agent\/active/);
  assert.match(markdown, /Branch drift/i);
  assert.match(markdown, /agent\/orphan/);
});

test('anonymous bootstrap documents PR then branch reconciliation and durable pre-create ownership', async () => {
  const scheduled = await readFile(new URL('../SCHEDULED_WORKERS.md', import.meta.url), 'utf8');
  const protocol = await readFile(new URL('../AGENT_PROTOCOL.md', import.meta.url), 'utf8');

  for (const text of [scheduled, protocol]) {
    assert.match(text, /current_branch/);
    assert.match(text, /branch reconciliation/i);
    assert.match(text, /persist[\s\S]*current_branch[\s\S]*before[\s\S]*(create|push)/i);
    assert.match(text, /no open PR[\s\S]*dead branch|no open PR != dead branch/i);
  }
});

test('implementation handoff uses overlap-before-clear with a mandatory post-adoption refresh', () => {
  const branch = owned();
  const predecessor = {
    work_phase: 'implementation',
    state: 'handoff',
    claims: [],
    current_branch: branch,
  };

  assert.deepEqual(workerRuntime.decideImplementationBranchTakeover({
    predecessor,
    successor: {
      work_phase: 'implementation',
      claim_won: true,
      current_branch: null,
    },
  }), {
    action: 'persist_successor_branch',
    current_branch: branch,
    predecessor_clear_allowed: false,
    target_writes_allowed: false,
  });

  assert.deepEqual(workerRuntime.decideImplementationBranchTakeover({
    predecessor,
    successor: {
      work_phase: 'implementation',
      claim_won: true,
      current_branch: branch,
    },
  }), {
    action: 'refresh_before_predecessor_clear',
    current_branch: branch,
    predecessor_clear_allowed: false,
    target_writes_allowed: false,
  });

  assert.deepEqual(workerRuntime.decideImplementationBranchTakeover({
    predecessor,
    successor: {
      work_phase: 'implementation',
      claim_won: true,
      current_branch: branch,
    },
    revalidatedAfterAdoption: true,
  }), {
    action: 'clear_predecessor_branch',
    current_branch: branch,
    predecessor_clear_allowed: true,
    target_writes_allowed: false,
  });
});

test('acceptance branch preparation cannot adopt implementation branch custody', () => {
  assert.deepEqual(workerRuntime.decideBranchPreparation({
    claimWon: true,
    workPhase: 'acceptance',
    currentBranch: null,
    intendedBranch: owned(),
    branchExists: true,
    matchingOpenPr: { number: 8 },
  }), {
    action: 'acceptance_branch_forbidden',
    current_branch: null,
    branch_creation_allowed: false,
    target_writes_allowed: false,
  });
});
