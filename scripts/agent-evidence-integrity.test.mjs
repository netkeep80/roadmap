import test from 'node:test';
import assert from 'node:assert/strict';
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
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  assert.match(workflow, /scripts\/agent-evidence-integrity\.mjs/);
  assert.match(workflow, /Validate changed checkpoint commit evidence/i);
  assert.match(workflow, /github\.event_name == 'issue_comment'/);
  assert.match(workflow, /node scripts\/agent-evidence-integrity\.mjs --validate-event/);
  assert.doesNotMatch(workflow, /node scripts\/agent-evidence-integrity\.mjs --validate-live/);
  assert.match(workflow, /if:\s*failure\(\)/);
  assert.match(workflow, /CONTROL PLANE INVALID/);
  assert.match(workflow, /issues\/103/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /\|\|\s*true/);
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
