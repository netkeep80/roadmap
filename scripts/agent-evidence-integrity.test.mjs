import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

async function loadIntegrityModule() {
  try {
    return await import(`./agent-evidence-integrity.mjs?test=${Date.now()}`);
  } catch {
    return null;
  }
}

const VALID_SHA = '0123456789abcdef0123456789abcdef01234567';
const OTHER_VALID_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const THIRD_VALID_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const ATTESTATION_START = '<!-- roadmap-agent-validation-attestation:start -->';
const ATTESTATION_END = '<!-- roadmap-agent-validation-attestation:end -->';

function agentBlock(data) {
  return `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n<!-- roadmap-agent:end -->`;
}

function attestationBlock(data) {
  return `${ATTESTATION_START}\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n${ATTESTATION_END}`;
}

function sha256(body) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

const ROADMAP_REGISTRY = {
  owner: 'netkeep80',
  control_repository: 'roadmap',
  repositories: [{ name: 'roadmap' }],
};

function roadmapRoleIssue() {
  return {
    number: 49,
    state: 'open',
    body: agentBlock({
      protocol: 'roadmap-agent-role/v1',
      repository: 'netkeep80/roadmap',
      scope: 'public-only',
      state: 'active',
      role_kind: 'repository-developer',
      portfolio_authority: 'coordinate',
    }),
  };
}

function v2Session({ phase = 'implementation', state = 'working', claims, currentPr = 'netkeep80/roadmap#142', workItem = 'netkeep80/roadmap#139' } = {}) {
  return agentBlock({
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: workItem,
    work_phase: phase,
    state,
    claims: claims ?? (state === 'working' ? [workItem] : []),
    current_branch: null,
    current_pr: currentPr,
    blocked_by: [],
  });
}

function openSessionIssue(number, body, createdAt = '2026-08-24T20:00:00Z') {
  return { number, state: 'open', created_at: createdAt, body };
}

function candidateSessionIssue() {
  return openSessionIssue(900, v2Session({ state: 'handoff', claims: [] }));
}

function candidateCheckpoint({ head = VALID_SHA, base = OTHER_VALID_SHA } = {}) {
  return agentBlock({
    protocol: 'roadmap-agent-checkpoint/v2',
    state: 'working',
    work_item: 'netkeep80/roadmap#139',
    completed: ['candidate sealed'],
    refs: [], blockers: [], next: ['independent acceptance'], messages: [],
    review_candidate: {
      work_item: 'netkeep80/roadmap#139',
      pr: 'netkeep80/roadmap#142',
      head_sha: head,
      base_sha: base,
    },
  });
}

function acceptanceCheckpoint({ candidateSession = 900, candidateComment = 7001, attestationComment = 7003, head = VALID_SHA, base = OTHER_VALID_SHA, decision = 'accepted' } = {}) {
  return agentBlock({
    protocol: 'roadmap-agent-checkpoint/v2',
    state: 'working',
    work_item: 'netkeep80/roadmap#139',
    completed: ['independent review complete'],
    refs: [], blockers: [], next: [], messages: [],
    acceptance: {
      candidate_session: candidateSession,
      candidate_checkpoint_comment_id: candidateComment,
      candidate_validation_attestation_comment_id: attestationComment,
      work_item: 'netkeep80/roadmap#139',
      pr: 'netkeep80/roadmap#142',
      head_sha: head,
      base_sha: base,
      decision,
    },
  });
}

function validationAttestationComment(candidateBody = candidateCheckpoint()) {
  return {
    id: 7003,
    issue_number: 900,
    created_at: '2026-08-24T20:11:00Z',
    updated_at: '2026-08-24T20:11:00Z',
    user: { login: 'github-actions[bot]', type: 'Bot' },
    body: attestationBlock({
      protocol: 'roadmap-agent-validation-attestation/v1',
      candidate_session: 900,
      candidate_checkpoint_comment_id: 7001,
      candidate_checkpoint_body_sha256: sha256(candidateBody),
      work_item: 'netkeep80/roadmap#139',
      pr: 'netkeep80/roadmap#142',
      head_sha: VALID_SHA,
      base_sha: OTHER_VALID_SHA,
    }),
  };
}

function reviewAuthorityResolvers(issue) {
  return {
    resolveControlIssue: async (number) => {
      if (number === 49) return roadmapRoleIssue();
      throw new Error(`control issue #${number} not found`);
    },
    resolveOpenControlIssues: async () => [issue],
  };
}

test('evidence integrity module exposes the required public boundary', async () => {
  const module = await loadIntegrityModule();
  assert.equal(typeof module?.validateCommitEvidence, 'function');
  assert.equal(typeof module?.validateCheckpointEventEvidence, 'function');
  assert.equal(typeof module?.renderInvalidAgentStatus, 'function');
});

test('well-formed but nonexistent commit evidence fails closed', async () => {
  const module = await loadIntegrityModule();
  await assert.rejects(
    () => module.validateCommitEvidence(
      [{ repository: 'netkeep80/roadmap', sha: VALID_SHA }],
      async () => { throw new Error('GitHub API 404'); },
    ),
    /commit evidence.*does not resolve|unable to resolve commit evidence/i,
  );
});

test('valid commit evidence resolves in its exact repository', async () => {
  const module = await loadIntegrityModule();
  const calls = [];
  const result = await module.validateCommitEvidence(
    [{ repository: 'netkeep80/roadmap', sha: VALID_SHA }],
    async (repository, sha) => {
      calls.push([repository, sha]);
      return { sha };
    },
  );
  assert.deepEqual(calls, [['netkeep80/roadmap', VALID_SHA]]);
  assert.deepEqual(result, { unique_commit_evidence: 1 });
});

test('duplicate commit evidence is live-resolved only once per repository and SHA', async () => {
  const module = await loadIntegrityModule();
  const calls = [];
  const records = [
    { repository: 'netkeep80/roadmap', sha: VALID_SHA },
    { repository: 'netkeep80/roadmap', sha: VALID_SHA },
    { repository: 'netkeep80/roadmap', sha: OTHER_VALID_SHA },
  ];
  const result = await module.validateCommitEvidence(records, async (repository, sha) => {
    calls.push([repository, sha]);
    return { sha };
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(new Set(calls.map(([repository, sha]) => `${repository}@${sha}`)), new Set([
    `netkeep80/roadmap@${VALID_SHA}`,
    `netkeep80/roadmap@${OTHER_VALID_SHA}`,
  ]));
  assert.deepEqual(result, { unique_commit_evidence: 2 });
});

test('checkpoint write event resolves only the changed checkpoint evidence', async () => {
  const module = await loadIntegrityModule();
  const calls = [];
  const event = {
    action: 'edited',
    issue: {
      number: 132,
      body: `<!-- roadmap-agent:start -->\n\`\`\`json\n{"protocol":"roadmap-agent-session/v1","role_issue":49,"repository":"netkeep80/roadmap","state":"working","claims":["netkeep80/roadmap#131"],"current_pr":"netkeep80/roadmap#134","blocked_by":[]}\n\`\`\`\n<!-- roadmap-agent:end -->`,
    },
    comment: {
      id: 1,
      body: `<!-- roadmap-agent:start -->\n\`\`\`json\n{"protocol":"roadmap-agent-checkpoint/v1","state":"working","completed":[],"refs":["commit:${VALID_SHA}"],"blockers":[],"next":[],"messages":[]}\n\`\`\`\n<!-- roadmap-agent:end -->`,
    },
  };
  const registry = { owner: 'netkeep80', repositories: [{ name: 'roadmap' }] };

  const result = await module.validateCheckpointEventEvidence({
    event,
    registry,
    resolveCommit: async (repository, sha) => {
      calls.push([repository, sha]);
      return { sha };
    },
  });

  assert.deepEqual(calls, [['netkeep80/roadmap', VALID_SHA]]);
  assert.deepEqual(result, { checked: true, unique_commit_evidence: 1 });
});

test('non-checkpoint events require zero commit API calls', async () => {
  const module = await loadIntegrityModule();
  let calls = 0;
  const result = await module.validateCheckpointEventEvidence({
    event: { action: 'deleted', issue: { body: '' }, comment: null },
    registry: { owner: 'netkeep80', repositories: [{ name: 'roadmap' }] },
    resolveCommit: async () => { calls += 1; },
  });
  assert.equal(calls, 0);
  assert.deepEqual(result, { checked: false, unique_commit_evidence: 0 });
});

test('v2 review candidate validates exact current PR head/base with one bounded PR lookup', async () => {
  const module = await loadIntegrityModule();
  const calls = [];
  const issue = openSessionIssue(900, v2Session());
  const result = await module.validateCheckpointEventEvidence({
    event: {
      action: 'created',
      issue,
      comment: { id: 7001, body: candidateCheckpoint() },
    },
    registry: ROADMAP_REGISTRY,
    resolveCommit: async () => { throw new Error('no commit refs expected'); },
    resolvePullRequest: async (repository, number) => {
      calls.push([repository, number]);
      return { number, state: 'open', head: { sha: VALID_SHA }, base: { sha: OTHER_VALID_SHA } };
    },
    ...reviewAuthorityResolvers(issue),
  });

  assert.deepEqual(calls, [['netkeep80/roadmap', 142]]);
  assert.equal(result.checked, true);
  assert.equal(result.unique_commit_evidence, 0);
  assert.equal(result.review_candidate_checked, true);
  assert.equal(typeof result.validation_attestation_body, 'string');
  assert.match(result.validation_attestation_body, /roadmap-agent-validation-attestation\/v1/);
});

test('v2 review candidate fails closed when current PR head or base moved', async () => {
  const module = await loadIntegrityModule();
  const issue = openSessionIssue(900, v2Session());
  await assert.rejects(
    () => module.validateCheckpointEventEvidence({
      event: {
        action: 'created',
        issue,
        comment: { id: 7001, body: candidateCheckpoint() },
      },
      registry: ROADMAP_REGISTRY,
      resolvePullRequest: async (repository, number) => ({
        number,
        state: 'open',
        head: { sha: THIRD_VALID_SHA },
        base: { sha: OTHER_VALID_SHA },
      }),
      ...reviewAuthorityResolvers(issue),
    }),
    /review candidate.*head|candidate.*head.*mismatch/i,
  );
});

test('v2 final acceptance must use a different Session from its candidate', async () => {
  const module = await loadIntegrityModule();
  await assert.rejects(
    () => module.validateCheckpointEventEvidence({
      event: {
        action: 'created',
        issue: openSessionIssue(900, v2Session({ phase: 'acceptance' }), '2026-08-24T20:20:00Z'),
        comment: { id: 7002, body: acceptanceCheckpoint({ candidateSession: 900 }) },
      },
      registry: ROADMAP_REGISTRY,
      resolvePullRequest: async (repository, number) => ({ number, state: 'open', head: { sha: VALID_SHA }, base: { sha: OTHER_VALID_SHA } }),
      resolveControlIssue: async (number) => {
        if (number === 49) return roadmapRoleIssue();
        throw new Error('same-session rejection must happen before candidate lookup');
      },
      resolveControlComment: async () => { throw new Error('same-session rejection must happen before lookup'); },
    }),
    /different Session|cannot accept its own candidate/i,
  );
});

test('v2 final acceptance fails closed on forged candidate checkpoint ownership', async () => {
  const module = await loadIntegrityModule();
  await assert.rejects(
    () => module.validateCheckpointEventEvidence({
      event: {
        action: 'created',
        issue: openSessionIssue(901, v2Session({ phase: 'acceptance' }), '2026-08-24T20:20:00Z'),
        comment: { id: 7002, body: acceptanceCheckpoint({ candidateSession: 900, candidateComment: 7001 }) },
      },
      registry: ROADMAP_REGISTRY,
      resolvePullRequest: async (repository, number) => ({ number, state: 'open', head: { sha: VALID_SHA }, base: { sha: OTHER_VALID_SHA } }),
      resolveControlIssue: async (number) => {
        if (number === 49) return roadmapRoleIssue();
        if (number === 900) return candidateSessionIssue();
        throw new Error(`control issue #${number} not found`);
      },
      resolveControlComment: async () => ({ id: 7001, issue_number: 999, body: candidateCheckpoint() }),
    }),
    /candidate checkpoint.*Session|ownership/i,
  );
});

test('v2 final acceptance validates exact candidate tuple and target PR', async () => {
  const module = await loadIntegrityModule();
  const calls = { pr: 0, issue: 0, comment: 0 };
  const candidateBody = candidateCheckpoint();
  const result = await module.validateCheckpointEventEvidence({
    event: {
      action: 'created',
      issue: openSessionIssue(901, v2Session({ phase: 'acceptance' }), '2026-08-24T20:20:00Z'),
      comment: {
        id: 7002,
        created_at: '2026-08-24T20:30:00Z',
        body: acceptanceCheckpoint({ candidateSession: 900, candidateComment: 7001, attestationComment: 7003 }),
      },
    },
    registry: ROADMAP_REGISTRY,
    resolvePullRequest: async (repository, number) => {
      calls.pr += 1;
      return { number, state: 'open', head: { sha: VALID_SHA }, base: { sha: OTHER_VALID_SHA } };
    },
    resolveControlIssue: async (number) => {
      calls.issue += 1;
      if (number === 49) return roadmapRoleIssue();
      if (number === 900) return candidateSessionIssue();
      throw new Error(`control issue #${number} not found`);
    },
    resolveControlComment: async (issueNumber, commentId) => {
      calls.comment += 1;
      if (commentId === 7001) {
        return {
          id: commentId,
          issue_number: issueNumber,
          created_at: '2026-08-24T20:10:00Z',
          updated_at: '2026-08-24T20:10:00Z',
          body: candidateBody,
        };
      }
      if (commentId === 7003) return validationAttestationComment(candidateBody);
      throw new Error(`comment #${commentId} not found`);
    },
    resolveControlCommentProvenance: async () => ({
      databaseId: 7003,
      issueNumber: 900,
      authorLogin: 'github-actions[bot]',
      editorLogin: null,
      lastEditedAt: null,
    }),
    resolveOpenControlIssues: async () => [
      openSessionIssue(901, v2Session({ phase: 'acceptance' }), '2026-08-24T20:20:00Z'),
    ],
  });

  assert.equal(calls.pr, 1);
  assert.ok(calls.issue >= 1 && calls.issue <= 3, `expected bounded control-issue lookups, got ${calls.issue}`);
  assert.equal(calls.comment, 2);
  assert.deepEqual(result, { checked: true, unique_commit_evidence: 0, acceptance_checked: true });
});

test('v2 Session work_item and work_phase are immutable across body edits', async () => {
  const module = await loadIntegrityModule();
  await assert.rejects(
    () => module.validateCheckpointEventEvidence({
      event: {
        action: 'edited',
        issue: { number: 901, body: v2Session({ phase: 'acceptance' }) },
        changes: { body: { from: v2Session({ phase: 'implementation' }) } },
      },
      registry: ROADMAP_REGISTRY,
    }),
    /work_phase.*immutable/i,
  );
});

test('authority-bearing v2 checkpoint cannot be edited in place', async () => {
  const module = await loadIntegrityModule();
  await assert.rejects(
    () => module.validateCheckpointEventEvidence({
      event: {
        action: 'edited',
        issue: { number: 900, body: v2Session() },
        comment: { id: 7001, body: candidateCheckpoint() },
        changes: { body: { from: candidateCheckpoint({ head: THIRD_VALID_SHA }) } },
      },
      registry: ROADMAP_REGISTRY,
      resolvePullRequest: async () => ({ number: 142, state: 'open', head: { sha: VALID_SHA }, base: { sha: OTHER_VALID_SHA } }),
    }),
    /authority-bearing.*cannot be edited|immutable/i,
  );
});

test('INVALID status is explicit and never echoes raw failure payload', async () => {
  const module = await loadIntegrityModule();
  const rawFailure = 'SECRET-OR-PRIVATE-RAW-PAYLOAD';
  const body = module.renderInvalidAgentStatus({
    checkedAt: '2026-08-24T18:50:00.000Z',
    runUrl: 'https://github.com/netkeep80/roadmap/actions/runs/123',
    error: rawFailure,
  });
  assert.match(body, /CONTROL PLANE INVALID/);
  assert.match(body, /DO NOT USE THE PREVIOUS SNAPSHOT FOR WORK SELECTION/i);
  assert.match(body, /2026-08-24T18:50:00.000Z/);
  assert.match(body, /https:\/\/github\.com\/netkeep80\/roadmap\/actions\/runs\/123/);
  assert.doesNotMatch(body, /SECRET-OR-PRIVATE-RAW-PAYLOAD/);
});

test('Agent Status validates only changed checkpoint evidence and publishes INVALID on failure', async () => {
  const module = await loadIntegrityModule();
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  assert.match(workflow, /scripts\/agent-evidence-integrity\.mjs/);
  assert.match(workflow, /Validate changed checkpoint commit evidence and v2 Session immutability/i);
  assert.match(workflow, /github\.event_name == 'issue_comment'/);
  assert.match(workflow, /github\.event_name == 'issues' && github\.event\.action == 'edited'/);
  assert.match(workflow, /node scripts\/agent-evidence-integrity\.mjs --validate-event/);
  assert.doesNotMatch(workflow, /node scripts\/agent-evidence-integrity\.mjs --validate-live/);
  assert.match(workflow, /if:\s*failure\(\)/);
  assert.match(workflow, /CONTROL PLANE INVALID/);
  assert.match(workflow, /issues\/103/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /\|\|\s*true/);
  assert.equal(typeof module?.validateCheckpointEventEvidence, 'function');
});

test('checkpoint comments do not trigger a full Agent Status rebuild', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  assert.match(workflow, /contains\(github\.event\.comment\.body \|\| '', '<!-- roadmap-agent:start -->'\)/);
  assert.match(workflow, /name: Publish current worker state to permanent Issue[\s\S]*?if:\s*>-[\s\S]*?github\.event_name != 'issue_comment'/);
});

test('automatic evidence workflow does not rescan complete GitHub history', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-evidence-integrity.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(workflow, /--validate-live/);
  assert.match(workflow, /node --test scripts\/agent-evidence-integrity\.test\.mjs/);
});

test('final acceptance rejects an edited bot-authored attestation from bounded provenance', async () => {
  const module = await loadIntegrityModule();
  const candidateBody = candidateCheckpoint();
  const event = {
    action: 'created',
    issue: openSessionIssue(901, v2Session({ phase: 'acceptance' }), '2026-08-24T20:20:00Z'),
    comment: {
      id: 7002,
      created_at: '2026-08-24T20:30:00Z',
      body: acceptanceCheckpoint(),
    },
  };

  await assert.rejects(
    () => module.validateCheckpointEventEvidence({
      event,
      registry: ROADMAP_REGISTRY,
      resolvePullRequest: async (_repository, number) => ({ number, state: 'open', head: { sha: VALID_SHA }, base: { sha: OTHER_VALID_SHA } }),
      resolveControlIssue: async (number) => {
        if (number === 49) return roadmapRoleIssue();
        if (number === 900) return candidateSessionIssue();
        throw new Error(`control issue #${number} not found`);
      },
      resolveControlComment: async (issueNumber, commentId) => {
        if (commentId === 7001) {
          return {
            id: 7001,
            issue_number: issueNumber,
            created_at: '2026-08-24T20:10:00Z',
            updated_at: '2026-08-24T20:10:00Z',
            body: candidateBody,
          };
        }
        if (commentId === 7003) return validationAttestationComment(candidateBody);
        throw new Error(`comment #${commentId} not found`);
      },
      resolveControlCommentProvenance: async () => ({
        databaseId: 7003,
        issueNumber: 900,
        authorLogin: 'github-actions[bot]',
        editorLogin: 'netkeep80',
        lastEditedAt: '2026-08-24T20:12:00Z',
      }),
      resolveOpenControlIssues: async () => [event.issue],
    }),
    /attestation.*(edit|provenance|immutable)|edited.*attestation/i,
  );
});