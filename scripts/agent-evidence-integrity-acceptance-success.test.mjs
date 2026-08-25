import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { validateAcceptanceValidationEventEvidence } from './agent-acceptance-validation.mjs';
import {
  parseAcceptanceValidationAttestation,
  renderAcceptanceValidationAttestation,
} from './acceptance-validation-attestation.mjs';

const START = '<!-- roadmap-agent:start -->';
const END = '<!-- roadmap-agent:end -->';
const VALIDATION_START = '<!-- roadmap-agent-validation-attestation:start -->';
const VALIDATION_END = '<!-- roadmap-agent-validation-attestation:end -->';
const ACCEPTANCE_ATTESTATION_START = '<!-- roadmap-agent-acceptance-validation-attestation:start -->';
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

function validationBlock(data) {
  return `${VALIDATION_START}\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n${VALIDATION_END}`;
}

function roleIssue() {
  return {
    number: 49,
    state: 'open',
    body: block({
      protocol: 'roadmap-agent-role/v1',
      repository: 'netkeep80/roadmap',
      scope: 'public-only',
      state: 'active',
      role_kind: 'repository-developer',
      portfolio_authority: 'coordinate',
    }),
  };
}

function sessionBody({ phase = 'implementation', state = 'working', claims } = {}) {
  const workItem = 'netkeep80/roadmap#139';
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

function candidateData() {
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
  };
}

function acceptanceData(decision = 'accepted') {
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
      candidate_validation_attestation_comment_id: 7003,
      work_item: 'netkeep80/roadmap#139',
      pr: 'netkeep80/roadmap#142',
      head_sha: HEAD,
      base_sha: BASE,
      decision,
    },
  };
}

function eventFor(decision = 'accepted') {
  return {
    action: 'created',
    issue: {
      number: 901,
      state: 'open',
      created_at: '2026-08-24T20:20:00Z',
      body: sessionBody({ phase: 'acceptance' }),
    },
    comment: {
      id: 7002,
      issue_number: 901,
      created_at: '2026-08-24T20:30:00Z',
      updated_at: '2026-08-24T20:30:00Z',
      body: block(acceptanceData(decision)),
    },
  };
}

function resolvers(event) {
  const candidateBody = block(candidateData());
  const candidateIssue = {
    number: 900,
    state: 'open',
    created_at: '2026-08-24T20:00:00Z',
    body: sessionBody({ state: 'handoff', claims: [] }),
  };
  const candidateComment = {
    id: 7001,
    issue_number: 900,
    created_at: '2026-08-24T20:10:00Z',
    updated_at: '2026-08-24T20:10:00Z',
    body: candidateBody,
  };
  const candidateAttestation = {
    id: 7003,
    issue_number: 900,
    created_at: '2026-08-24T20:11:00Z',
    updated_at: '2026-08-24T20:11:00Z',
    user: { login: 'github-actions[bot]', type: 'Bot' },
    body: validationBlock({
      protocol: 'roadmap-agent-validation-attestation/v1',
      candidate_session: 900,
      candidate_checkpoint_comment_id: 7001,
      candidate_checkpoint_body_sha256: createHash('sha256').update(candidateBody, 'utf8').digest('hex'),
      work_item: 'netkeep80/roadmap#139',
      pr: 'netkeep80/roadmap#142',
      head_sha: HEAD,
      base_sha: BASE,
    }),
  };
  return {
    resolvePullRequest: async (_repository, number) => ({ number, state: 'open', head: { sha: HEAD }, base: { sha: BASE } }),
    resolveControlIssue: async (number) => {
      if (number === 49) return roleIssue();
      if (number === 900) return candidateIssue;
      throw new Error(`control issue #${number} not found`);
    },
    resolveControlComment: async (_issueNumber, commentId) => {
      if (commentId === 7001) return candidateComment;
      if (commentId === 7003) return candidateAttestation;
      throw new Error(`control comment #${commentId} not found`);
    },
    resolveControlCommentProvenance: async () => ({
      databaseId: 7003,
      issueNumber: 900,
      repository: 'netkeep80/roadmap',
      authorLogin: 'github-actions[bot]',
      editorLogin: null,
      lastEditedAt: null,
    }),
    resolveOpenControlIssues: async () => [event.issue],
  };
}

test('successful created final acceptance emits acceptance-success attestation only after validation', async () => {
  const event = eventFor('accepted');
  const result = await validateAcceptanceValidationEventEvidence({ event, registry: REGISTRY, ...resolvers(event) });
  assert.equal(result.acceptance_checked, true);
  assert.equal(typeof result.acceptance_validation_attestation_body, 'string');
  const attestation = parseAcceptanceValidationAttestation(result.acceptance_validation_attestation_body);
  assert.equal(attestation.acceptance_session, 901);
  assert.equal(attestation.acceptance_checkpoint_comment_id, 7002);
  assert.equal(attestation.candidate_session, 900);
  assert.equal(attestation.candidate_checkpoint_comment_id, 7001);
  assert.equal(attestation.candidate_validation_attestation_comment_id, 7003);
  assert.equal(attestation.work_item, 'netkeep80/roadmap#139');
  assert.equal(attestation.pr, 'netkeep80/roadmap#142');
  assert.equal(attestation.head_sha, HEAD);
  assert.equal(attestation.base_sha, BASE);
  assert.equal(attestation.decision, 'accepted');
});

test('changes_requested acceptance never emits acceptance-success attestation', async () => {
  const event = eventFor('changes_requested');
  const result = await validateAcceptanceValidationEventEvidence({ event, registry: REGISTRY, ...resolvers(event) });
  assert.equal(result.acceptance_checked, true);
  assert.equal(result.acceptance_validation_attestation_body, undefined);
});

test('ordinary creation of acceptance-success bot attestation does not recurse into checkpoint handling', async () => {
  const body = renderAcceptanceValidationAttestation({
    acceptanceSession: { number: 901 },
    acceptanceComment: { id: 7002, body: block(acceptanceData()) },
    acceptance: acceptanceData().acceptance,
  });
  const result = await validateAcceptanceValidationEventEvidence({
    event: { action: 'created', issue: { number: 901, body: sessionBody({ phase: 'acceptance' }) }, comment: { id: 8000, body } },
    registry: REGISTRY,
  });
  assert.deepEqual(result, { checked: false, unique_commit_evidence: 0 });
});

test('acceptance-success attestation edit and delete fail closed as append-only authority violations', async () => {
  const body = renderAcceptanceValidationAttestation({
    acceptanceSession: { number: 901 },
    acceptanceComment: { id: 7002, body: block(acceptanceData()) },
    acceptance: acceptanceData().acceptance,
  });
  for (const action of ['edited', 'deleted']) {
    await assert.rejects(
      () => validateAcceptanceValidationEventEvidence({
        event: {
          action,
          issue: { number: 901, body: sessionBody({ phase: 'acceptance' }) },
          comment: { id: 8000, body },
          ...(action === 'edited' ? { changes: { body: { from: body } } } : {}),
        },
        registry: REGISTRY,
      }),
      /acceptance.*attestation|append-only|cannot be (edited|deleted)/i,
    );
  }
});

test('Agent Status runtime routes, fetches, outputs and publishes acceptance-success attestation without recursion', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes(ACCEPTANCE_ATTESTATION_START));
  assert.match(workflow, /scripts\/acceptance-validation-attestation\.mjs/);
  assert.match(workflow, /scripts\/agent-acceptance-validation\.mjs/);
  assert.match(workflow, /acceptance_validation_attestation_body_b64/);
  assert.match(workflow, /Publish successful acceptance validation attestation/);
  assert.match(workflow, /roadmap-agent-acceptance-validation-attestation:start/);
});
