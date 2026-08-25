# Acceptance-Success Attestation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-bot proof that a final accepted v2 checkpoint successfully passed event-local validation, and expose that proof through strict additive `roadmap-agent-pr/v2` bounded verification without changing v1 semantics or granting merge authority.

**Architecture:** Reuse the existing candidate successful-validation attestation pattern in `scripts/agent-evidence-integrity.mjs`: exact body SHA-256, REST bot identity, GraphQL edit provenance, and event-local output consumed by `agent-status.yml`. Extend `scripts/acceptance-pointer.mjs` by dual-reading strict v1/v2 pointer schemas; v2 adds exactly one acceptance-validation attestation comment id and verifies its exact accepted checkpoint digest/tuple. Deployment remains bootstrap-safe: #182 itself is accepted by the already-deployed validator and cannot auto-merge under advisory roadmap policy; the new emitter is proven only after deployment on a fresh downstream acceptance event.

**Tech Stack:** Node.js ESM, `node:test`, GitHub Actions YAML, GitHub REST/GraphQL APIs, SHA-256 via `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-08-25-acceptance-success-attestation-design.md`

## Global Constraints

- `roadmap-agent-pr/v1` remains parseable and foundation-only; do not reinterpret it as automated merge authority.
- New pointer protocol is exactly `roadmap-agent-pr/v2` and adds exactly `acceptance_validation_attestation_comment_id` to the v1 pointer fields.
- New bot evidence protocol is exactly `roadmap-agent-acceptance-validation-attestation/v1` with its own marker; it is not an Agent Checkpoint.
- Emit acceptance-success attestation only for a newly-created `roadmap-agent-checkpoint/v2` final `acceptance.decision=accepted` event after the complete existing event-local validator succeeds.
- Never emit for `changes_requested`, partial checkpoints, failed validation, v1 checkpoints, issue edits, comment edits/deletes, candidate seals, or bot-attestation comments.
- REST `github-actions[bot]` / `Bot` is author identity authority. GraphQL provenance proves exact comment/session/repository and no edit; do not require duplicate exact bot-login spelling from GraphQL.
- No historical scan/backfill, no new database/status authority, no `integration_allowed` result, no target protection change.
- `repo-policy.json` remains advisory during #182; automated material merge remains forbidden until target-local required-check/no-bypass proof exists.
- `SCHEDULED_WORKERS.md` and Scheduled Task prompts remain unchanged; workers remain paused.
- TDD is mandatory: each production slice must have an observed RED before the minimal GREEN commit.

---

### Task 1: Acceptance-success attestation contract and pure helpers

**Files:**
- Modify: `scripts/agent-evidence-integrity.mjs` — add acceptance marker/protocol constants plus render/parse/digest helpers adjacent to the existing candidate validation-attestation helpers.
- Modify: `scripts/agent-evidence-integrity-acceptance.test.mjs` — add focused acceptance-success protocol tests.

**Interfaces:**
- Consumes: existing validated v2 acceptance object with `candidate_session`, `candidate_checkpoint_comment_id`, `candidate_validation_attestation_comment_id`, `work_item`, `pr`, `head_sha`, `base_sha`, `decision`.
- Produces: `acceptanceCheckpointBodySha256(body: string): string`, `renderAcceptanceValidationAttestation({ acceptanceSession, acceptanceComment, acceptance }): string`, `parseAcceptanceValidationAttestation(body: string): object`.
- Preserve existing exported `candidateCheckpointBodySha256(body)` behavior exactly.

- [ ] **Step 1: Write RED tests for exact rendering/parsing and closed fields**

Use `createHash` in the test instead of an undefined helper:

```js
import { createHash } from 'node:crypto';

const expectedDigest = createHash('sha256').update(exactCheckpointBody, 'utf8').digest('hex');
const body = renderAcceptanceValidationAttestation({
  acceptanceSession: { number: 200 },
  acceptanceComment: { id: 9001, body: exactCheckpointBody },
  acceptance: {
    candidate_session: 176,
    candidate_checkpoint_comment_id: 8101,
    candidate_validation_attestation_comment_id: 8102,
    work_item: 'netkeep80/roadmap#182',
    pr: 'netkeep80/roadmap#184',
    head_sha: HEAD,
    base_sha: BASE,
    decision: 'accepted',
  },
});
const parsed = parseAcceptanceValidationAttestation(body);
assert.equal(parsed.acceptance_session, 200);
assert.equal(parsed.acceptance_checkpoint_comment_id, 9001);
assert.equal(parsed.acceptance_checkpoint_body_sha256, expectedDigest);
assert.equal(parsed.decision, 'accepted');
```

Also assert fail-closed behavior for duplicate markers, malformed JSON, missing field, extra field, non-positive ids, malformed SHA-256, malformed H/B, and `decision !== 'accepted'`.

- [ ] **Step 2: Run focused test and record RED**

Run:

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs
```

Expected: FAIL because the new exports do not exist. If local execution is unavailable, commit this test-only RED and use the exact-head Portfolio validate run as the observed RED; record the exact failing test and run id in Session #183.

- [ ] **Step 3: Implement minimal pure helpers**

Add constants:

```js
const ACCEPTANCE_VALIDATION_ATTESTATION_PROTOCOL = 'roadmap-agent-acceptance-validation-attestation/v1';
const ACCEPTANCE_VALIDATION_ATTESTATION_START = '<!-- roadmap-agent-acceptance-validation-attestation:start -->';
const ACCEPTANCE_VALIDATION_ATTESTATION_END = '<!-- roadmap-agent-acceptance-validation-attestation:end -->';
```

Use one private digest primitive and preserve the old export:

```js
function checkpointBodySha256(body, label) {
  if (typeof body !== 'string') fail(`${label} body must be a string`);
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function candidateCheckpointBodySha256(body) {
  return checkpointBodySha256(body, 'candidate checkpoint');
}

export function acceptanceCheckpointBodySha256(body) {
  return checkpointBodySha256(body, 'acceptance checkpoint');
}
```

Render and parse exactly these fields, no more and no fewer:

```js
[
  'protocol',
  'acceptance_session',
  'acceptance_checkpoint_comment_id',
  'acceptance_checkpoint_body_sha256',
  'candidate_session',
  'candidate_checkpoint_comment_id',
  'candidate_validation_attestation_comment_id',
  'work_item',
  'pr',
  'head_sha',
  'base_sha',
  'decision',
]
```

`decision` must equal `accepted`.

- [ ] **Step 4: Run focused test to GREEN**

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs
```

Expected: PASS with old acceptance regressions unchanged.

- [ ] **Step 5: Commit the minimal GREEN slice**

```bash
git add scripts/agent-evidence-integrity.mjs scripts/agent-evidence-integrity-acceptance.test.mjs
git commit -m "feat: define acceptance validation attestation"
```

---

### Task 2: Event-local emission, provenance, and non-recursion

**Files:**
- Modify: `scripts/agent-evidence-integrity.mjs` — return new raw attestation body after successful exact accepted v2 validation; encode it only in CLI `$GITHUB_OUTPUT`; validate edit/delete provenance for the new bot marker.
- Modify: `scripts/agent-evidence-integrity-provenance.test.mjs` — new edit/delete/wrong-author/no-edit cases.
- Modify: `scripts/agent-evidence-integrity-acceptance.test.mjs` — emission/non-emission cases.
- Modify: `.github/workflows/agent-status.yml` — route the new marker and publish the new output using `GITHUB_TOKEN`.
- Modify: `.github/workflows/portfolio-validate.yml` only if current validation commands do not already execute the expanded test files.

**Interfaces:**
- `validateCheckpointEventEvidence(...)` produces `acceptance_validation_attestation_body: string` only for eligible created accepted-v2 events.
- CLI `--validate-event` encodes that body and appends `acceptance_validation_attestation_body_b64=<base64>` to the existing `$GITHUB_OUTPUT` file, mirroring candidate `validation_attestation_body_b64`.

- [ ] **Step 1: Write RED event tests at the correct layer**

```js
const accepted = await validateCheckpointEventEvidence(/* accepted created v2 fixture */);
assert.match(
  accepted.acceptance_validation_attestation_body,
  /roadmap-agent-acceptance-validation-attestation\/v1/,
);

const changesRequested = await validateCheckpointEventEvidence(/* changes_requested fixture */);
assert.equal(changesRequested.acceptance_validation_attestation_body, undefined);
```

Repeat non-emission assertions for v1 checkpoints, edited checkpoints, partial checkpoints, and candidate seals. Add a marker-routing regression proving a created acceptance-attestation bot comment is not treated as an Agent Checkpoint and cannot recursively emit another attestation.

- [ ] **Step 2: Write RED provenance tests**

Use the established fixture split:

```js
const restComment = {
  id: 9100,
  issue_url: 'https://api.github.com/repos/netkeep80/roadmap/issues/200',
  user: { login: 'github-actions[bot]', type: 'Bot' },
  body: renderedAttestation,
};
const graphProvenance = {
  databaseId: 9100,
  issueNumber: 200,
  repository: 'netkeep80/roadmap',
  authorLogin: 'github-actions',
  editorLogin: null,
  lastEditedAt: null,
};
```

Assert success for that identity split. Assert failure for wrong REST author/type, wrong comment id, wrong issue number, wrong repository, non-null editor, or non-null `lastEditedAt`. Add edited/deleted event tests that fail closed when the old/current body contains the new marker.

- [ ] **Step 3: Run focused tests and record RED**

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs scripts/agent-evidence-integrity-provenance.test.mjs
```

Expected: FAIL only on missing new behavior. If local execution is unavailable, use a test-only commit plus exact-head Portfolio validate as the RED observation.

- [ ] **Step 4: Implement minimal event result and CLI output**

After `validateAcceptanceEvidence(...)` returns true, only when `event.action === 'created'` and `checkpoint.acceptance.decision === 'accepted'`:

```js
const result = { checked: true, ...commitResult, acceptance_checked: true };
result.acceptance_validation_attestation_body = renderAcceptanceValidationAttestation({
  acceptanceSession: event.issue,
  acceptanceComment: event.comment,
  acceptance: checkpoint.acceptance,
});
return result;
```

In `main()` preserve the existing filesystem output mechanism:

```js
if (result.acceptance_validation_attestation_body) {
  if (!process.env.GITHUB_OUTPUT) fail('GITHUB_OUTPUT is required to publish acceptance validation attestation output');
  const encoded = Buffer.from(result.acceptance_validation_attestation_body, 'utf8').toString('base64');
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `acceptance_validation_attestation_body_b64=${encoded}\n`,
    'utf8',
  );
}
```

- [ ] **Step 5: Implement exact REST identity + GraphQL no-edit provenance**

For an authoritative acceptance-attestation comment require:

```js
if (comment.user?.login !== 'github-actions[bot]' || comment.user?.type !== 'Bot') {
  fail('acceptance validation attestation must be authored by github-actions[bot] / Bot');
}
```

GraphQL provenance must require exact `databaseId`, exact acceptance Session `issueNumber`, exact control repository, `editorLogin === null`, and `lastEditedAt === null`. Do not require `provenance.authorLogin === 'github-actions[bot]'`.

- [ ] **Step 6: Wire `.github/workflows/agent-status.yml`**

Extend both current-body and edited-previous-body marker predicates with:

```yaml
contains(github.event.comment.body || '', '<!-- roadmap-agent-acceptance-validation-attestation:start -->')
```

and the equivalent `github.event.changes.body.from` expression.

Add publication after evidence validation:

```yaml
- name: Publish successful acceptance validation attestation
  if: >-
    ${{
      github.event_name == 'issue_comment' &&
      github.event.action == 'created' &&
      steps.evidence.outputs.acceptance_validation_attestation_body_b64 != ''
    }}
  shell: bash
  env:
    GH_TOKEN: ${{ github.token }}
    ACCEPTANCE_VALIDATION_ATTESTATION_BODY_B64: ${{ steps.evidence.outputs.acceptance_validation_attestation_body_b64 }}
  run: |
    set -euo pipefail
    body="$(printf '%s' "${ACCEPTANCE_VALIDATION_ATTESTATION_BODY_B64}" | base64 --decode)"
    case "${body}" in
      *'<!-- roadmap-agent-acceptance-validation-attestation:start -->'*) ;;
      *) echo 'acceptance validation attestation output is missing its authority marker' >&2; exit 1 ;;
    esac
    gh api --method POST "repos/${GITHUB_REPOSITORY}/issues/${{ github.event.issue.number }}/comments" -f body="${body}"
```

Do not change the existing candidate-attestation publication step.

- [ ] **Step 7: Run focused tests to GREEN and commit**

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs scripts/agent-evidence-integrity-provenance.test.mjs
git add scripts/agent-evidence-integrity.mjs scripts/agent-evidence-integrity-acceptance.test.mjs scripts/agent-evidence-integrity-provenance.test.mjs .github/workflows/agent-status.yml .github/workflows/portfolio-validate.yml
git commit -m "feat: emit accepted checkpoint validation attestation"
```

---

### Task 3: Strict additive `roadmap-agent-pr/v2` bounded verifier

**Files:**
- Modify: `scripts/acceptance-pointer.test.mjs` — v2 parser/verifier and unchanged-v1 regressions.
- Modify: `scripts/acceptance-pointer.mjs` — dual-read exact v1/v2 schemas and v2 acceptance-attestation coherence checks.

**Interfaces:**
- `parseAcceptancePointer(body)` returns a strict v1 or v2 object.
- For v2, `verifyAcceptancePointerInput(input)` additionally consumes `acceptanceCheckpoint.body` and `acceptanceValidationAttestation`.
- Result contains bounded evidence facts only and never `integration_allowed`.

- [ ] **Step 1: Write RED v2 parser tests while preserving v1 fixtures**

Use exact field sets:

```js
const POINTER_FIELDS_V1 = [
  'protocol',
  'work_item',
  'pr',
  'candidate_session',
  'candidate_checkpoint_comment_id',
  'candidate_validation_attestation_comment_id',
  'acceptance_session',
  'acceptance_checkpoint_comment_id',
  'head_sha',
  'base_sha',
];
const POINTER_FIELDS_V2 = [
  ...POINTER_FIELDS_V1,
  'acceptance_validation_attestation_comment_id',
];
```

Test both:

```js
assert.deepEqual(parseAcceptancePointer(block(pointerV1())), pointerV1());
assert.deepEqual(parseAcceptancePointer(block(pointerV2())), pointerV2());
```

Assert v1 plus the v2-only field fails, v2 without the field fails, and either version with any other extra field fails.

- [ ] **Step 2: Write RED v2 verifier tests**

Use an exact acceptance comment body:

```js
const acceptanceBody = 'exact accepted checkpoint body';
const acceptanceDigest = createHash('sha256').update(acceptanceBody, 'utf8').digest('hex');
```

Resolved v2 input includes:

```js
acceptanceCheckpoint: {
  id: 8201,
  body: acceptanceBody,
  acceptance: {
    candidate_session: 176,
    candidate_checkpoint_comment_id: 8101,
    candidate_validation_attestation_comment_id: 8102,
    work_item: value.work_item,
    pr: value.pr,
    head_sha: HEAD,
    base_sha: BASE,
    decision: 'accepted',
  },
},
acceptanceValidationAttestation: {
  id: 8202,
  protocol: 'roadmap-agent-acceptance-validation-attestation/v1',
  acceptance_session: 178,
  acceptance_checkpoint_comment_id: 8201,
  acceptance_checkpoint_body_sha256: acceptanceDigest,
  candidate_session: 176,
  candidate_checkpoint_comment_id: 8101,
  candidate_validation_attestation_comment_id: 8102,
  work_item: value.work_item,
  pr: value.pr,
  head_sha: HEAD,
  base_sha: BASE,
  decision: 'accepted',
},
```

Add failures for missing attestation, wrong attestation id/protocol, wrong acceptance Session/checkpoint id, wrong body digest, wrong candidate chain ids, wrong work item/PR/H/B, and wrong decision.

- [ ] **Step 3: Run pointer tests and record RED**

```bash
node --test scripts/acceptance-pointer.test.mjs
```

Expected: FAIL because v2 is unsupported. If local execution is unavailable, commit test-only RED and use exact-head Portfolio validate.

- [ ] **Step 4: Implement strict dual schemas**

Define:

```js
const PROTOCOL_V1 = 'roadmap-agent-pr/v1';
const PROTOCOL_V2 = 'roadmap-agent-pr/v2';
```

Select the exact field set from `pointer.protocol`; unknown protocol fails. Preserve all v1 checks exactly. For v2 require positive `acceptance_validation_attestation_comment_id` and verify:

```text
attestation id == pointer id
attestation protocol == roadmap-agent-acceptance-validation-attestation/v1
attestation acceptance_session == pointer acceptance_session
attestation acceptance_checkpoint_comment_id == pointer acceptance_checkpoint_comment_id
sha256(acceptanceCheckpoint.body) == attestation.acceptance_checkpoint_body_sha256
candidate_session/checkpoint/validation-attestation ids == pointer candidate chain
work_item/pr/head_sha/base_sha == pointer tuple
decision == accepted
```

- [ ] **Step 5: Keep the result explicitly non-merge-authoritative**

Return:

```js
const result = {
  work_item: pointer.work_item,
  pr: pointer.pr,
  head_sha: pointer.head_sha,
  base_sha: pointer.base_sha,
  candidate_session: pointer.candidate_session,
  acceptance_session: pointer.acceptance_session,
  acceptance_checkpoint_comment_id: pointer.acceptance_checkpoint_comment_id,
};
if (pointer.protocol === PROTOCOL_V2) {
  result.acceptance_validation_attestation_comment_id = pointer.acceptance_validation_attestation_comment_id;
}
return result;
```

Do not add `integration_allowed` or a merge-authority boolean.

- [ ] **Step 6: Run pointer tests to GREEN and commit**

```bash
node --test scripts/acceptance-pointer.test.mjs
git add scripts/acceptance-pointer.mjs scripts/acceptance-pointer.test.mjs
git commit -m "feat: verify acceptance pointer v2"
```

---

### Task 4: Protocol docs, exact-head regression, and bootstrap-safe integration

**Files:**
- Modify: `AGENT_PROTOCOL.md` — document the new marker and strict v2 pointer chain.
- Modify: `.github/workflows/portfolio-validate.yml` only if required to execute all new tests.
- Do not modify: `SCHEDULED_WORKERS.md`, Scheduled Task prompts, `repo-policy.json` enforcement mode.

**Interfaces:**
- Produces: exact-head independently reviewable #182 candidate and a post-deploy proof gate for `repo-guard#351`.

- [ ] **Step 1: Document exact protocol semantics**

Add one canonical acceptance-validation attestation example and one canonical `roadmap-agent-pr/v2` example. State verbatim in substance:

```text
roadmap-agent-pr/v1 is a bounded foundation/index only and is insufficient for automated material merge.
roadmap-agent-pr/v2 proves exact independently validated roadmap acceptance only; target required protection/ruleset and real worker-credential no-bypass proof remain separately mandatory.
```

Document the bootstrap boundary: #182's own pre-deployment acceptance is validated by deployed main; candidate code cannot self-attest. After manual/non-automated deployment, a fresh downstream acceptance must produce the new bot proof before target enforcement can claim success.

- [ ] **Step 2: Run targeted regression suite**

```bash
node --test \
  scripts/acceptance-pointer.test.mjs \
  scripts/agent-evidence-integrity-acceptance.test.mjs \
  scripts/agent-evidence-integrity-provenance.test.mjs \
  scripts/agent-evidence-integrity.test.mjs \
  scripts/agent-protocol-v2.test.mjs \
  scripts/agent-protocol.test.mjs
```

Expected: all PASS. If local execution is unavailable, exact-head GitHub Actions is authoritative; do not infer success.

- [ ] **Step 3: Commit docs/wiring cleanup**

```bash
git add AGENT_PROTOCOL.md .github/workflows/portfolio-validate.yml
git commit -m "docs: define acceptance pointer v2 authority chain"
```

Only add `.github/workflows/portfolio-validate.yml` if it actually changed.

- [ ] **Step 4: Reconcile stacked topology before candidate sealing**

Fresh-read exact `main`, PR #177, #182, Session #183, all relevant Claims, branch custody, open PRs, repo policy/workflows/messages. #177 must be integrated before final #182 integration. If #177/main moved, reconcile `agent/182-acceptance-success-attestation` onto exact new main without clobbering #182 commits. Any prior H/B evidence becomes stale.

- [ ] **Step 5: Open or update the single canonical #182 PR**

Bind exactly: work item #182, Session #183, canonical branch, current H/B, observed RED/GREEN SHAs and workflow run ids, exact changed files, v1 compatibility boundary, bootstrap/manual-integration boundary, and unchanged Scheduled Workers. Confirm no duplicate #182 PR.

- [ ] **Step 6: Require exact-head CI GREEN**

Require every applicable exact-head check including Portfolio validate and repo-guard advisory, plus `behind_by=0`, mergeable, not draft, and stable exact H/B after final refresh.

- [ ] **Step 7: Seal exact #182 candidate**

After the complete fresh gate, add a v2 `review_candidate` checkpoint binding the exact #182 PR/H/B. Require event-local Agent Status SUCCESS and the existing candidate `github-actions[bot]` validation attestation. Then release implementation Claim into safe handoff while retaining branch custody until reconciliation/transfer is complete.

- [ ] **Step 8: Perform fresh independent acceptance**

Create a different v2 acceptance Session after the candidate seal. It has `current_branch=null`, claims #182, wins the collision gate, independently revalidates exact H/B/diff/tests/protocol compatibility, and posts `decision=accepted` only if all evidence is exact. Because the new emitter is not deployed yet, #182's own acceptance does not require the new acceptance-validation attestation and candidate branch code must never self-prove it.

- [ ] **Step 9: Integrate #182 only through the bootstrap-safe path**

Roadmap enforcement remains advisory, so automated material merge is forbidden. After exact independent acceptance, integration is human/manual/non-automated. Immediately after manual merge, fresh-read exact new main and require post-merge workflows and valid Agent Status on that exact merge SHA.

- [ ] **Step 10: Prove the deployed emitter downstream**

Resume `repo-guard#351` only after #182 is on main. A fresh acceptance event executed against deployed roadmap main must produce a real `github-actions[bot]` `roadmap-agent-acceptance-validation-attestation/v1` comment whose body digest and exact tuple match the accepted checkpoint. Only then may the target v2 required-check/no-bypass pilot proceed.

- [ ] **Step 11: Final verification checkpoint**

Record exact merge/main SHA, post-merge run ids/conclusions, downstream acceptance-attestation comment id, and the still-paused Scheduled Worker state. Do not claim automated material merge enabled until repo-guard#351 separately proves required-check enforcement and negative no-bypass behavior with the real worker credential.
