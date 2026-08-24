import test from 'node:test';
import assert from 'node:assert/strict';

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
  assert.equal(typeof module?.renderInvalidAgentStatus, 'function');
});

test('well-formed but nonexistent commit evidence fails closed', async () => {
  const module = await loadIntegrityModule();
  assert.equal(typeof module?.validateCommitEvidence, 'function');

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
  assert.equal(typeof module?.validateCommitEvidence, 'function');
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
  assert.equal(typeof module?.validateCommitEvidence, 'function');
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

test('INVALID status is explicit and never echoes raw failure payload', async () => {
  const module = await loadIntegrityModule();
  assert.equal(typeof module?.renderInvalidAgentStatus, 'function');
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
