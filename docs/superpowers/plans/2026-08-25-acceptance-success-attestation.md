# Acceptance-Success Attestation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-bot proof that a final accepted v2 checkpoint successfully passed event-local validation, and expose that proof through strict additive `roadmap-agent-pr/v2` bounded verification without changing v1 semantics or granting merge authority.

**Architecture:** Reuse the existing candidate successful-validation attestation pattern in `scripts/agent-evidence-integrity.mjs`: exact body SHA-256, REST bot identity, GraphQL edit provenance, and event-local output consumed by `agent-status.yml`. Extend `scripts/acceptance-pointer.mjs` by dual-reading strict v1/v2 pointer schemas; v2 adds exactly one acceptance-validation attestation comment id and verifies its exact accepted checkpoint digest/tuple. Deployment remains bootstrap-safe: #182 itself is accepted by the already-deployed validator and cannot auto-merge under advisory roadmap policy; the new emitter is proven only after deployment on a fresh downstream acceptance event.

**Tech Stack:** Node.js ESM, `node:test`, GitHub Actions YAML, GitHub REST/GraphQL APIs, SHA-256 via `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-08-25-acceptance-success-attestation-design.md`

## Global Constraints

- `roadmap-agent-pr/v1` remains parseable and foundation-only; do not reinterpret it as automated merge authority.
- New protocol is exactly `roadmap-agent-pr/v2` and adds exactly `acceptance_validation_attestation_comment_id` to the v1 pointer fields.
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
- Modify: `scripts/agent-evidence-integrity.mjs` — add marker/protocol constants plus render/parse/digest/coherence helpers adjacent to existing candidate validation-attestation helpers.
- Modify: `scripts/agent-evidence-integrity-acceptance.test.mjs` — add focused acceptance-success protocol tests.

**Interfaces:**
- Consumes: existing validated v2 acceptance checkpoint shape `{ acceptance: { candidate_session, candidate_checkpoint_comment_id, candidate_validation_attestation_comment_id, work_item, pr, head_sha, base_sha, decision } }`.
- Produces: `acceptanceCheckpointBodySha256(body: string): string` or a shared exact-body SHA helper; `renderAcceptanceValidationAttestation({ acceptanceSession, acceptanceComment, acceptance }): string`; `parseAcceptanceValidationAttestation(body: string): object`.

- [ ] **Step 1: Write RED tests for exact rendering/parsing and closed fields**

Add cases equivalent to:

```js
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
assert.equal(parsed.acceptance_checkpoint_body_sha256, sha256(exactCheckpointBody));
assert.equal(parsed.decision, 'accepted');
```

Also assert fail-closed behavior for duplicate markers, malformed JSON, missing/unknown fields, non-positive ids, malformed SHA-256, malformed H/B, and `decision !== 'accepted'`.

- [ ] **Step 2: Run focused test and record RED**

Run:

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs
```

Expected: FAIL because the new exports/protocol do not exist yet. Record the exact RED commit SHA and failing assertion/import in Session #183.

- [ ] **Step 3: Implement the minimal pure protocol helpers**

Add constants:

```js
const ACCEPTANCE_VALIDATION_ATTESTATION_PROTOCOL = 'roadmap-agent-acceptance-validation-attestation/v1';
const ACCEPTANCE_VALIDATION_ATTESTATION_START = '<!-- roadmap-agent-acceptance-validation-attestation:start -->';
const ACCEPTANCE_VALIDATION_ATTESTATION_END = '<!-- roadmap-agent-acceptance-validation-attestation:end -->';
```

Render a closed JSON object with exactly:

```js
{
  protocol,
  acceptance_session,
  acceptance_checkpoint_comment_id,
  acceptance_checkpoint_body_sha256,
  candidate_session,
  candidate_checkpoint_comment_id,
  candidate_validation_attestation_comment_id,
  work_item,
  pr,
  head_sha,
  base_sha,
  decision: 'accepted',
}
```

Use SHA-256 over the exact UTF-8 checkpoint body. Parsing must reject unknown/missing fields rather than silently ignore them.

- [ ] **Step 4: Run focused test to GREEN**

Run:

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs
```

Expected: PASS with all new contract cases green and existing acceptance validation regressions unchanged.

- [ ] **Step 5: Commit the minimal GREEN slice**

```bash
git add scripts/agent-evidence-integrity.mjs scripts/agent-evidence-integrity-acceptance.test.mjs
git commit -m "feat: define acceptance validation attestation"
```

---

### Task 2: Event-local emission, bot identity, provenance, and non-recursion

**Files:**
- Modify: `scripts/agent-evidence-integrity.mjs` — emit an output only after successful exact accepted v2 checkpoint validation; validate edit/delete provenance for the new bot marker.
- Modify: `scripts/agent-evidence-integrity-provenance.test.mjs` — new edit/delete/wrong-author/no-edit cases.
- Modify: `scripts/agent-evidence-integrity-acceptance.test.mjs` — event emission/non-emission cases.
- Modify: `.github/workflows/agent-status.yml` — route the new marker and publish the new output using `GITHUB_TOKEN`.
- Modify: `.github/workflows/portfolio-validate.yml` only if the new/expanded test file is not already executed by the existing test glob/list.

**Interfaces:**
- Consumes: existing `--validate-event` path and candidate `validation_attestation_body_b64` output convention.
- Produces: GitHub Actions output `acceptance_validation_attestation_body_b64` containing one exact rendered new-marker comment body, or empty when the event is non-eligible.

- [ ] **Step 1: Write RED event tests before workflow/production changes**

Cover these exact cases:

```js
assert.equal(result.acceptance_validation_attestation_body_b64, expectedBase64); // created + v2 + accepted + complete validator success
assert.equal(nonAcceptedResult.acceptance_validation_attestation_body_b64 ?? '', '');
assert.equal(v1Result.acceptance_validation_attestation_body_b64 ?? '', '');
assert.equal(editedResult.acceptance_validation_attestation_body_b64 ?? '', '');
assert.equal(candidateSealResult.acceptance_validation_attestation_body_b64 ?? '', '');
```

Add a marker-routing regression proving a created bot acceptance-attestation comment does not enter ordinary checkpoint validation or recursively produce another attestation.

- [ ] **Step 2: Write RED provenance tests**

Use the established provenance fixture pattern:

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
  authorLogin: 'github-actions', // allowed spelling difference; REST owns identity
  editorLogin: null,
  lastEditedAt: null,
};
```

Assert success for the above and failure for user-authored REST identity, wrong issue/comment/repository, non-null editor, or non-null `lastEditedAt`. Add edited/deleted event tests that fail closed for the new marker.

- [ ] **Step 3: Run focused tests and record RED**

Run:

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs scripts/agent-evidence-integrity-provenance.test.mjs
```

Expected: FAIL only on the intentionally missing new emission/provenance behavior.

- [ ] **Step 4: Implement minimal event output and provenance validation**

After the complete existing acceptance validator has accepted the exact created checkpoint, render the attestation and write:

```js
core.setOutput(
  'acceptance_validation_attestation_body_b64',
  Buffer.from(renderedBody, 'utf8').toString('base64'),
);
```

If the script does not use `@actions/core`, preserve the existing `$GITHUB_OUTPUT` helper convention used for `validation_attestation_body_b64`; do not introduce a new output mechanism.

Add REST author checks:

```js
if (comment.user?.login !== 'github-actions[bot]' || comment.user?.type !== 'Bot') {
  fail('acceptance validation attestation must be authored by github-actions[bot] / Bot');
}
```

Reuse/refactor the existing GraphQL provenance resolver so the acceptance path proves exact database id, acceptance Session issue number, control repository, `editorLogin === null`, and `lastEditedAt === null` without requiring exact GraphQL `authorLogin` spelling.

- [ ] **Step 5: Wire `.github/workflows/agent-status.yml`**

Extend the job-level event marker predicate with:

```yaml
contains(github.event.comment.body || '', '<!-- roadmap-agent-acceptance-validation-attestation:start -->')
```

and the edited previous-body predicate likewise.

Add a publication step after evidence validation:

```yaml
- name: Publish successful acceptance validation attestation
  if: >-
    ${{
      github.event_name == 'issue_comment' &&
      github.event.action == 'created' &&
      steps.evidence.outputs.acceptance_validation_attestation_body_b64 != ''
    }}
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

Do not alter candidate-attestation publication semantics.

- [ ] **Step 6: Run focused tests to GREEN**

```bash
node --test scripts/agent-evidence-integrity-acceptance.test.mjs scripts/agent-evidence-integrity-provenance.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the minimal GREEN slice**

```bash
git add scripts/agent-evidence-integrity.mjs scripts/agent-evidence-integrity-acceptance.test.mjs scripts/agent-evidence-integrity-provenance.test.mjs .github/workflows/agent-status.yml .github/workflows/portfolio-validate.yml
git commit -m "feat: emit accepted checkpoint validation attestation"
```

---

### Task 3: Strict additive `roadmap-agent-pr/v2` bounded verifier

**Files:**
- Modify: `scripts/acceptance-pointer.test.mjs` — v2 parser/verifier and v1 regression tests.
- Modify: `scripts/acceptance-pointer.mjs` — dual-read exact v1/v2 schemas and v2 acceptance-attestation coherence checks.

**Interfaces:**
- Consumes: v1 pointer fields plus exact `acceptance_validation_attestation_comment_id`; resolved acceptance-validation attestation evidence including REST bot identity/provenance facts or a prevalidated normalized representation supplied by the target verifier.
- Produces: `parseAcceptancePointer(body)` returning strict v1 or v2 data; `verifyAcceptancePointerInput(input)` returning bounded acceptance facts with no `integration_allowed` field.

- [ ] **Step 1: Write RED v2 parser tests while preserving v1 fixtures**

Replace the old assertion that v2 is always invalid with explicit dual-read cases:

```js
const v2 = pointerV2({
  acceptance_validation_attestation_comment_id: 8202,
});
assert.deepEqual(parseAcceptancePointer(block(v2)), v2);
assert.deepEqual(parseAcceptancePointer(block(pointerV1())), pointerV1());
```

Assert v1 rejects the extra field and v2 requires it; both reject all other unknown fields.

- [ ] **Step 2: Write RED v2 verifier tests**

Extend resolved input with:

```js
acceptanceValidationAttestation: {
  id: 8202,
  protocol: 'roadmap-agent-acceptance-validation-attestation/v1',
  acceptance_session: 178,
  acceptance_checkpoint_comment_id: 8201,
  acceptance_checkpoint_body_sha256: ACCEPTANCE_BODY_SHA256,
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

Add failures for missing attestation, wrong id, wrong acceptance Session/checkpoint, wrong acceptance body digest, wrong candidate chain ids, wrong work item/PR/H/B, wrong protocol, and wrong decision.

- [ ] **Step 3: Run pointer tests and record RED**

```bash
node --test scripts/acceptance-pointer.test.mjs
```

Expected: FAIL because v2 is not yet supported.

- [ ] **Step 4: Implement dual strict schemas**

Use explicit field arrays:

```js
const POINTER_FIELDS_V1 = [/* current fields unchanged */];
const POINTER_FIELDS_V2 = [
  ...POINTER_FIELDS_V1,
  'acceptance_validation_attestation_comment_id',
];
```

Select schema strictly from `pointer.protocol`; unknown protocols fail. Preserve v1 verification behavior exactly. For v2, require the new positive id and verify the acceptance attestation against the exact pointer and accepted checkpoint. The accepted checkpoint exact-body SHA-256 supplied/resolved by the verifier must equal `acceptance_checkpoint_body_sha256`.

- [ ] **Step 5: Keep result explicitly non-merge-authoritative**

Return bounded facts only, for example:

```js
return {
  protocol: pointer.protocol,
  work_item: pointer.work_item,
  pr: pointer.pr,
  head_sha: pointer.head_sha,
  base_sha: pointer.base_sha,
  candidate_session: pointer.candidate_session,
  acceptance_session: pointer.acceptance_session,
  acceptance_checkpoint_comment_id: pointer.acceptance_checkpoint_comment_id,
  ...(pointer.protocol === 'roadmap-agent-pr/v2'
    ? { acceptance_validation_attestation_comment_id: pointer.acceptance_validation_attestation_comment_id }
    : {}),
};
```

Tests must continue to assert `Object.hasOwn(result, 'integration_allowed') === false` for both versions.

- [ ] **Step 6: Run pointer tests to GREEN**

```bash
node --test scripts/acceptance-pointer.test.mjs
```

Expected: PASS for both historical/current v1 and strict v2.

- [ ] **Step 7: Commit the minimal GREEN slice**

```bash
git add scripts/acceptance-pointer.mjs scripts/acceptance-pointer.test.mjs
git commit -m "feat: verify acceptance pointer v2"
```

---

### Task 4: Protocol documentation, full regression, PR/seal, bootstrap-safe integration

**Files:**
- Modify: `AGENT_PROTOCOL.md` — document new acceptance-success marker and strict v2 pointer chain; keep v1 foundation-only language explicit.
- Modify: `.github/workflows/portfolio-validate.yml` only if needed to execute all new tests.
- Existing changed files from Tasks 1-3.
- Do not modify: `SCHEDULED_WORKERS.md`, Scheduled Task prompts, `repo-policy.json` enforcement mode.

**Interfaces:**
- Consumes: all Task 1-3 functions and workflow outputs.
- Produces: exact-head independently reviewable #182 candidate plus a documented post-deploy proof gate for `repo-guard#351`.

- [ ] **Step 1: Document exact protocol examples**

Add one canonical acceptance-validation attestation example and one `roadmap-agent-pr/v2` example. State explicitly:

```text
roadmap-agent-pr/v1 = bounded foundation/index only; never sufficient for automated material merge.
roadmap-agent-pr/v2 = independently validated roadmap acceptance evidence only; target protection/ruleset + real worker-credential no-bypass proof remain separately mandatory.
```

Describe the bootstrap boundary: #182's own pre-deployment acceptance is validated by deployed main; candidate code cannot self-attest. After manual/non-automated deployment, a fresh downstream acceptance must produce the new bot proof before the target pilot can claim success.

- [ ] **Step 2: Run all targeted tests**

```bash
node --test \
  scripts/acceptance-pointer.test.mjs \
  scripts/agent-evidence-integrity-acceptance.test.mjs \
  scripts/agent-evidence-integrity-provenance.test.mjs \
  scripts/agent-evidence-integrity.test.mjs \
  scripts/agent-protocol-v2.test.mjs \
  scripts/agent-protocol.test.mjs
```

Expected: all PASS.

- [ ] **Step 3: Run the repository validation command used by Portfolio validate**

Read `.github/workflows/portfolio-validate.yml` from the exact branch and execute the same Node validation/test commands locally where possible. If local GitHub-network-dependent checks cannot run, rely only on the actual GitHub Actions exact-head run and record that limitation; never substitute an assumed green result.

- [ ] **Step 4: Commit docs/wiring cleanup**

```bash
git add AGENT_PROTOCOL.md .github/workflows/portfolio-validate.yml
git commit -m "docs: define acceptance pointer v2 authority chain"
```

- [ ] **Step 5: Reconcile stacked topology before candidate sealing**

Fresh-read `main`, PR #177, #182, Session #183, all Claims, branch custody, open PRs, repo policy/workflows/messages. #177 must be integrated before final #182 integration. If #177/main moved, reconcile `agent/182-acceptance-success-attestation` onto exact new main without clobbering #182 commits, then rerun exact-head CI. Any earlier H/B evidence becomes stale.

- [ ] **Step 6: Open/update the single canonical #182 PR**

PR body must bind exactly: work item #182, Session #183, canonical branch, current H/B, TDD RED/GREEN SHAs, exact changed files, compatibility boundary, bootstrap/manual-integration boundary, and `SCHEDULED_WORKERS.md` unchanged. Ensure there is no duplicate #182 PR.

- [ ] **Step 7: Require exact-head CI GREEN**

Require all applicable exact-head checks, including Portfolio validate and repo-guard advisory, plus `behind_by=0`, mergeable, not draft, and stable exact H/B after final refresh.

- [ ] **Step 8: Seal exact #182 candidate**

Only after the complete fresh gate, add a `roadmap-agent-checkpoint/v2` `review_candidate` binding exact #182 PR/H/B. Observe event-local Agent Status SUCCESS and the existing candidate `github-actions[bot]` validation attestation. Then transition implementation Session #183 to claim-free handoff while retaining branch custody until safe transfer/reconciliation.

- [ ] **Step 9: Perform fresh independent acceptance**

Create a different v2 acceptance Session only after the candidate seal predates it. Acceptance Session has `current_branch=null`, claims #182, wins the deterministic collision gate, independently revalidates exact H/B/diff/tests/protocol compatibility, and posts one final `decision=accepted` checkpoint only if all evidence is exact. Because the new acceptance-success emitter is not deployed yet, do not require #182's own acceptance comment to receive the new attestation and do not let candidate branch code self-prove it.

- [ ] **Step 10: Integrate #182 only through the bootstrap-safe path**

Roadmap policy is advisory, so automated material merge remains forbidden. After exact independent acceptance, integration is human/manual/non-automated. Immediately after manual merge, fresh-read exact new main, observe post-merge workflows on that exact merge SHA, and require a valid Agent Status before claiming deployment success.

- [ ] **Step 11: Prove the new deployed emitter downstream**

Resume `repo-guard#351` only after #182 is on main. Use a fresh acceptance event executed against the deployed roadmap main and require a real `github-actions[bot]` `roadmap-agent-acceptance-validation-attestation/v1` comment with exact accepted-checkpoint body digest/tuple. Only after that proof may the target v2 required-check/no-bypass pilot proceed.

- [ ] **Step 12: Final verification checkpoint**

Record exact merge/main SHA, post-merge run ids/conclusions, downstream acceptance-attestation comment id, and the still-paused Scheduled Worker state. Do not declare target automated merge enabled until repo-guard#351 separately proves required-check enforcement and negative no-bypass behavior with the real worker credential.
