import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { validateCheckpointEventEvidence } from './agent-evidence-integrity.mjs';

const HEAD = '0123456789abcdef0123456789abcdef01234567';
const BASE = '89abcdef0123456789abcdef0123456789abcdef';
const REGISTRY = {
  owner: 'netkeep80',
  control_repository: 'roadmap',
  repositories: [{ name: 'roadmap' }],
};

function block(data) {
  return `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n<!-- roadmap-agent:end -->`;
}

function attestationBlock(data) {
  return `<!-- roadmap-agent-validation-attestation:start -->\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\n<!-- roadmap-agent-validation-attestation:end -->`;
}

function sha256(body) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
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

function sessionBody({ phase, state, claims }) {
  return block({
    protocol: 'roadmap-agent-session/v2',
    role_issue: 49,
    repository: 'netkeep80/roadmap',
    work_item: 'netkeep80/roadmap#139',
    work_phase: phase,
    state,
    claims,
    current_branch: null,
    current_pr: 'netkeep80/roadmap#142',
    blocked_by: [],
  });
}

const candidateBody = block({
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
});

const acceptanceBody = block({
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
    decision: 'accepted',
  },
});

const attestationBody = attestationBlock({
  protocol: 'roadmap-agent-validation-attestation/v1',
  candidate_session: 900,
  candidate_checkpoint_comment_id: 7001,
  candidate_checkpoint_body_sha256: sha256(candidateBody),
  work_item: 'netkeep80/roadmap#139',
  pr: 'netkeep80/roadmap#142',
  head_sha: HEAD,
  base_sha: BASE,
});

test('REST bot identity remains authoritative when GraphQL provenance uses API-specific author spelling', async () => {
  const acceptanceIssue = {
    number: 901,
    state: 'open',
    created_at: '2026-08-24T20:20:00Z',
    body: sessionBody({
      phase: 'acceptance',
      state: 'working',
      claims: ['netkeep80/roadmap#139'],
    }),
  };

  const result = await validateCheckpointEventEvidence({
    event: {
      action: 'created',
      issue: acceptanceIssue,
      comment: {
        id: 7002,
        created_at: '2026-08-24T20:30:00Z',
        body: acceptanceBody,
      },
    },
    registry: REGISTRY,
    resolvePullRequest: async (_repository, number) => ({
      number,
      state: 'open',
      head: { sha: HEAD },
      base: { sha: BASE },
    }),
    resolveControlIssue: async (number) => {
      if (number === 49) return roleIssue();
      if (number === 900) {
        return {
          number: 900,
          state: 'open',
          created_at: '2026-08-24T20:00:00Z',
          body: sessionBody({ phase: 'implementation', state: 'handoff', claims: [] }),
        };
      }
      throw new Error(`control issue #${number} not found`);
    },
    resolveControlComment: async (_issueNumber, commentId) => {
      if (commentId === 7001) {
        return {
          id: 7001,
          issue_number: 900,
          created_at: '2026-08-24T20:10:00Z',
          updated_at: '2026-08-24T20:10:00Z',
          body: candidateBody,
        };
      }
      if (commentId === 7003) {
        return {
          id: 7003,
          issue_number: 900,
          created_at: '2026-08-24T20:11:00Z',
          updated_at: '2026-08-24T20:11:00Z',
          user: { login: 'github-actions[bot]', type: 'Bot' },
          body: attestationBody,
        };
      }
      throw new Error(`control comment #${commentId} not found`);
    },
    resolveControlCommentProvenance: async () => ({
      databaseId: 7003,
      issueNumber: 900,
      repository: 'netkeep80/roadmap',
      authorLogin: 'github-actions',
      editorLogin: null,
      lastEditedAt: null,
    }),
    resolveOpenControlIssues: async () => [acceptanceIssue],
  });

  assert.equal(result.checked, true);
  assert.equal(result.acceptance_checked, true);
});
