# Universal Workers Independent Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the public Agent Control Plane to duration-independent execution, normalized finish-first selection and independently attested exact-candidate acceptance without rewriting v1 history or reintroducing automatic historical scans.

**Architecture:** Dual-read Session/Checkpoint v1+v2, with immutable v2 `work_item`/`work_phase`, event-local candidate/acceptance validation, a bot-authenticated successful-validation attestation bound to the exact candidate-seal body digest, and transient WorkCandidate ranking. Target repositories may later enforce acceptance through a bounded pointer chain; until proven blocking, automated material merge remains forbidden.

**Tech Stack:** Node.js ESM, `node:crypto`, GitHub Issues/Contents/Actions APIs, existing roadmap protocol/status/runtime scripts and node:test suites.

**Spec:** `docs/superpowers/specs/2026-08-24-universal-workers-independent-acceptance-design.md`

## Global Constraints

- Preserve all historical v1 Role/Session/Message/Checkpoint evidence without rewriting it.
- New automatic validation must be local/write-boundary; `--validate-live` remains manual/baseline forensic operation only.
- Successful v2 candidate validation must leave durable bot-authenticated evidence before later acceptance can trust the seal.
- Timestamp metadata proves chronology only; exact seal-body authority comes from SHA-256 attestation binding.
- `unknown = material`; no global docs-only exemption.
- No scheduler/model/slot/time-budget authority.
- One LIVE winning Claim per explicit work item.
- Scheduled external waits release the Claim through handoff.
- No target automated material merge until actual target enforcement is proven fail-closed and no-bypass.

---

### Task 1: Dual-read Session/Checkpoint v2 protocol

**Files:**
- Modify: `scripts/agent-protocol.mjs`
- Modify: `scripts/agent-protocol.test.mjs`
- Modify: `scripts/agent-session-liveness.test.mjs`

**Interfaces:**
- Produces Session protocols `roadmap-agent-session/v1|v2` and Checkpoint protocols `roadmap-agent-checkpoint/v1|v2`.
- v2 Session produces validated `work_item` and `work_phase`.

- [ ] Add RED tests proving a valid v2 implementation Session is rejected by current parser.
- [ ] Add RED tests for v2 invariants: exact same-repository `work_item`, phase in `implementation|acceptance`, at most one claim and it equals `work_item`, acceptance branch must be null.
- [ ] Add RED tests proving v1 Session/Checkpoint fixtures remain accepted unchanged.
- [ ] Implement dual protocol classification and v2 validation minimally.
- [ ] Add checkpoint v2 validation requiring matching `work_item` and validating optional `review_candidate` / `acceptance` structure syntactically.
- [ ] Run `node --test scripts/agent-protocol.test.mjs scripts/agent-session-liveness.test.mjs` to GREEN.

### Task 2: Event-local v2 evidence validation

**Files:**
- Modify: `scripts/agent-evidence-integrity.mjs`
- Modify: `scripts/agent-evidence-integrity.test.mjs`
- Modify: `.github/workflows/agent-evidence-integrity.yml`

**Interfaces:**
- Produces event validation for changed v2 Checkpoint only.
- Candidate validation resolves attached Session + exact target PR + current open claimant set.
- Acceptance validation resolves attached acceptance Session + exact candidate Session/comment + exact target PR.

- [ ] Add RED tests showing candidate head/base mismatch fails closed.
- [ ] Add RED tests showing same Session cannot final-accept its own candidate.
- [ ] Add RED tests showing stale H/B and forged candidate comment pointer fail closed.
- [ ] Add regression asserting event mode never calls historical Session/comment collection.
- [ ] Implement bounded resolvers and exact relation checks.
- [ ] Keep `--validate-live` explicit/manual only; do not call it from automatic status/event workflows.
- [ ] Run `node --test scripts/agent-evidence-integrity.test.mjs` to GREEN.

### Task 2A: Durable successful-validation attestation (H9)

**Files:**
- Modify: `scripts/agent-protocol-v2.test.mjs`
- Modify: `scripts/agent-protocol.mjs`
- Modify: `scripts/agent-evidence-integrity-acceptance.test.mjs`
- Modify: `scripts/agent-evidence-integrity.test.mjs`
- Modify: `scripts/agent-evidence-integrity.mjs`
- Modify: `.github/workflows/agent-status.yml`
- Modify: `docs/superpowers/specs/2026-08-24-universal-workers-independent-acceptance-design.md`
- Modify: `docs/superpowers/plans/2026-08-24-universal-workers-independent-acceptance.md`

**Interfaces:**
- `acceptance.candidate_validation_attestation_comment_id`: required positive integer in v2 final acceptance.
- `candidateCheckpointBodySha256(body: string) -> string`: SHA-256 lowercase hex over exact UTF-8 seal body.
- `renderValidationAttestation({ candidateSession, candidateComment, candidate }) -> string`: renders exactly one `roadmap-agent-validation-attestation/v1` block using the separate attestation marker.
- `parseValidationAttestation(body: string) -> object`: strict single-block parser for the attestation protocol.
- `validateCheckpointEventEvidence(...)`: when a newly-created `review_candidate` succeeds, returns `validation_attestation_body`; final acceptance bounded-fetches and verifies the exact referenced attestation.
- CLI `--validate-event`: writes one-line base64 `validation_attestation_body_b64` to `$GITHUB_OUTPUT` only when successful new candidate validation produced an attestation.
- Agent Status workflow: decodes that output and posts one comment to `github.event.issue.number` with `GITHUB_TOKEN`; the resulting GitHub author must be `github-actions[bot]` / `Bot`.

- [ ] **Step 1: Add RED protocol-schema coverage.** In `scripts/agent-protocol-v2.test.mjs`, require an acceptance fixture without `candidate_validation_attestation_comment_id` to reject and an otherwise valid fixture with value `7002` to remain structurally valid.

- [ ] **Step 2: Add RED acceptance-authority coverage.** In `scripts/agent-evidence-integrity-acceptance.test.mjs`, extend the positive resolver with candidate seal comment id `7001` and bot attestation comment id `7002`. Add failing cases for: missing attestation; wrong owning Session; `user.login='netkeep80'`; `user.type='User'`; wrong seal comment id; wrong candidate Session; wrong work item/PR/H/B; and wrong SHA-256. Add a same-second seal-edit fixture whose timestamps stay equal but whose body changes; it must reject on digest mismatch.

- [ ] **Step 3: Add RED mandatory-chronology coverage.** For each of candidate Session, candidate seal, acceptance Session and acceptance checkpoint, delete `created_at` in an otherwise valid final-acceptance fixture and require fail-closed rejection. Repeat with `created_at='not-a-timestamp'`.

- [ ] **Step 4: Add RED workflow-boundary coverage.** In `scripts/agent-evidence-integrity-acceptance.test.mjs`, require `.github/workflows/agent-status.yml` to consume `validation_attestation_body_b64`, decode it and POST the comment only after a successful `issue_comment.created` candidate event. Require attestation edit/delete routing to hit `--validate-event`; require ordinary creation of the distinct attestation marker not to recursively enter candidate handling; require no `--validate-live`.

- [ ] **Step 5: Run RED evidence tests.** Run `node --test scripts/agent-evidence-integrity.test.mjs scripts/agent-evidence-integrity-acceptance.test.mjs`. Expected: only the newly added H9 authority/workflow assertions fail; all existing H1-H8 regressions remain green.

- [ ] **Step 6: Run RED protocol tests.** Run `node --test scripts/agent-protocol-v2.test.mjs`. Expected: the new missing-attestation-pointer acceptance fixture is not rejected by the old schema, proving the schema gap.

- [ ] **Step 7: Implement the protocol field minimally.** In `validateAcceptance()` require `candidate_validation_attestation_comment_id` to be an integer greater than zero. Do not change v1 parsing or Session rules.

- [ ] **Step 8: Implement exact attestation primitives.** In `scripts/agent-evidence-integrity.mjs`, import `createHash` from `node:crypto`; add distinct start/end constants for the attestation marker; strict parser; SHA-256 helper; and renderer with protocol `roadmap-agent-validation-attestation/v1`. The renderer binds candidate Session issue number, candidate seal comment id, exact body digest, work item, PR, head SHA and base SHA.

- [ ] **Step 9: Emit attestation only after successful candidate validation.** For `event.action === 'created'` and a successfully validated `review_candidate`, return `validation_attestation_body`. Do not emit it for v1 checkpoints, acceptance checkpoints, failed evidence, edits or deletes. In CLI mode, write `validation_attestation_body_b64=${Buffer.from(body, 'utf8').toString('base64')}` to `$GITHUB_OUTPUT` when present.

- [ ] **Step 10: Post through the existing event workflow.** Give the validation step `id: evidence`. Add a following step conditioned on `github.event_name == 'issue_comment'`, `github.event.action == 'created'` and non-empty `steps.evidence.outputs.validation_attestation_body_b64`; decode with `base64 --decode`; POST through `gh api --method POST repos/${GITHUB_REPOSITORY}/issues/${{ github.event.issue.number }}/comments -f body="${body}"`. Reuse existing `issues: write`; do not add broader permissions.

- [ ] **Step 11: Verify attestation during final acceptance.** Bounded-fetch the exact attestation comment through the existing control-comment resolver. Require exact id and candidate Session ownership, `user.login === 'github-actions[bot]'`, `user.type === 'Bot'`, exact attestation protocol/fields, and `candidate_checkpoint_body_sha256 === candidateCheckpointBodySha256(candidateComment.body)`. Match the candidate tuple independently against both seal and attestation before granting authority.

- [ ] **Step 12: Replace timestamp immutability with mandatory chronology.** Remove `created_at == updated_at` as the seal trust primitive. Make chronology parsing reject missing or invalid `created_at` for candidate Session, candidate seal, acceptance Session and acceptance checkpoint. Keep strict `candidateSealAt < acceptanceSessionAt` and nondecreasing Session→own-checkpoint ordering. Keep edit/delete mutation rejection as immediate write-boundary defense.

- [ ] **Step 13: Protect attestation append-only evidence.** Treat an edited/deleted attestation marker as authority-bearing mutation and reject it in `--validate-event`. Extend edited-event workflow routing to inspect both current and previous attestation marker bodies. Do not route ordinary attestation creation, preventing recursion.

- [ ] **Step 14: Run H9 GREEN suites.** Run `node --test scripts/agent-protocol-v2.test.mjs scripts/agent-evidence-integrity.test.mjs scripts/agent-evidence-integrity-acceptance.test.mjs`. Expected: all pass.

- [ ] **Step 15: Run full PR CI and exact-head review.** Require Agent evidence integrity, Portfolio validate and repo-guard to complete successfully on one exact H9 SHA; inspect job logs, verify `behind_by=0`, mergeable/not-draft, scope/must-not-touch and PR-local net budget <= 2200. Seal only that exact SHA for a fresh acceptance Session.

### Task 3: Normalized finish-first WorkCandidate selection

**Files:**
- Modify: `data/worker-policy.json`
- Modify: `scripts/worker-runtime.mjs`
- Modify: `scripts/worker-runtime.test.mjs`
- Modify: `AGENT_PROTOCOL.md`
- Modify: `SCHEDULED_WORKERS.md`

**Interfaces:**
- `validateWorkerPolicy()` accepts schema v3 with `selection_policy: normalized-finish-first-v1` and no `work_source_order` authority.
- Runtime exposes deterministic normalized candidate ranking.

- [ ] Add RED tests where a P0 local issue beats a P1 handoff.
- [ ] Add RED test where an unoccupied continuation beats new work within equal effective rank.
- [ ] Add RED test where occupied top candidate is skipped for next candidate.
- [ ] Add RED test where unresolved mixed priority is non-rankable rather than guessed.
- [ ] Implement transient normalization/ranking with stable repository/name tie-break.
- [ ] Update protocol/worker docs to make Messages state inputs and handoffs continuation evidence, not queues.
- [ ] Run `node --test scripts/worker-runtime.test.mjs` to GREEN.

### Task 4: Phase-aware handoff and acceptance lifecycle helpers

**Files:**
- Modify: `scripts/worker-runtime.mjs`
- Modify: `scripts/worker-runtime.test.mjs`
- Modify: `scripts/current-branch-lifecycle.test.mjs`

**Interfaces:**
- Produces overlap-before-clear implementation takeover decision.
- Produces acceptance transitions: partial handoff, changes requested -> implementation, accepted -> integration revalidation.

- [ ] Add RED test proving predecessor branch is not cleared before successor persists the same ownership.
- [ ] Add RED test proving acceptance Session cannot adopt implementation branch.
- [ ] Add RED tests for `changes_requested` and `accepted but gates pending` release behavior.
- [ ] Implement minimal pure decision helpers.
- [ ] Run affected tests to GREEN.

### Task 5: PR pointer and bounded acceptance verifier foundation

**Files:**
- Create: `scripts/acceptance-pointer.mjs`
- Create: `scripts/acceptance-pointer.test.mjs`
- Modify: `repo-policy.json` only if required by existing governance classification; do not weaken policy.
- Document target contract in `AGENT_PROTOCOL.md`.

**Interfaces:**
- Parses exactly one `roadmap-agent-pr/v1` block from PR body.
- Validates pointers syntactically; roadmap evidence remains authority.

- [ ] Add RED fixtures for missing/duplicate/malformed pointer blocks.
- [ ] Add RED fixture for stale candidate/acceptance references.
- [ ] Implement parser and bounded verifier input model without enabling merges.
- [ ] Run new tests to GREEN.

### Task 6: Rollout gates and worker bootstrap

**Files:**
- Modify: `SCHEDULED_WORKERS.md`
- Modify: `AGENT_PROTOCOL.md`
- Modify: `AGENTS.md` only if bootstrap duplication can be removed without weakening one-URL Role bootstrap.
- Modify: `roadmap#62` through Issues API after merged evidence exists.

**Interfaces:**
- New worker prompt references authoritative protocol instead of duplicating lifecycle details.
- Restart criteria remain explicit and fail closed.

- [ ] Add/update regression tests that new autonomous Sessions are v2 after cutover while historical v1 is readable.
- [ ] Document no-auto-merge behavior for unenforced targets.
- [ ] Keep five Scheduled Workers paused until two-worker pilot and target enforcement proof exist.
- [ ] Run the complete Node test suite used by roadmap CI.
- [ ] Open PR with exact issue binding and candidate evidence; do not merge from the implementation Session.

## Self-review

- Every design requirement is mapped to Tasks 1-6 plus H9 Task 2A.
- H9 successful-validation authority is bounded to one exact Session, seal comment, seal-body digest and candidate tuple; no history scan is introduced.
- Timestamp metadata is chronology-only and cannot substitute for the attestation digest.
- No task introduces persistent quantum/model/fairness/scheduler metadata.
- Target enforcement is staged after protocol evidence; no existing safety is weakened.
- Historical scans remain manual forensic operations only.
