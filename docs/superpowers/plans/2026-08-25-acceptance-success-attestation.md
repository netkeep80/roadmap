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

- [x] **Step 1: Write RED tests for exact rendering/parsing and closed fields**

Use `createHash` in the test instead of an undefined helper.

- [ ] **Step 2: Run focused test and record RED**
- [ ] **Step 3: Implement minimal pure helpers**
- [ ] **Step 4: Run focused test to GREEN**
- [ ] **Step 5: Commit the minimal GREEN slice**

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
- [ ] **Step 2: Write RED provenance tests**
- [ ] **Step 3: Run focused tests and record RED**
- [ ] **Step 4: Implement minimal event result and CLI output**
- [ ] **Step 5: Implement exact REST identity + GraphQL no-edit provenance**
- [ ] **Step 6: Wire `.github/workflows/agent-status.yml`**
- [ ] **Step 7: Run focused tests to GREEN and commit**

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
- [ ] **Step 2: Write RED v2 verifier tests**
- [ ] **Step 3: Run pointer tests and record RED**
- [ ] **Step 4: Implement strict dual schemas**
- [ ] **Step 5: Keep the result explicitly non-merge-authoritative**
- [ ] **Step 6: Run pointer tests to GREEN and commit**

---

### Task 4: Protocol docs, exact-head regression, and bootstrap-safe integration

**Files:**
- Modify: `AGENT_PROTOCOL.md` — document the new marker and strict v2 pointer chain.
- Modify: `.github/workflows/portfolio-validate.yml` only if required to execute all new tests.
- Do not modify: `SCHEDULED_WORKERS.md`, Scheduled Task prompts, `repo-policy.json` enforcement mode.

**Interfaces:**
- Produces: exact-head independently reviewable #182 candidate and a post-deploy proof gate for `repo-guard#351`.

- [ ] **Step 1: Document exact protocol semantics**
- [ ] **Step 2: Run targeted regression suite**
- [ ] **Step 3: Commit docs/wiring cleanup**
- [ ] **Step 4: Reconcile stacked topology before candidate sealing**
- [ ] **Step 5: Open or update the single canonical #182 PR**
- [ ] **Step 6: Require exact-head CI GREEN**
- [ ] **Step 7: Seal exact #182 candidate**
- [ ] **Step 8: Perform fresh independent acceptance**
- [ ] **Step 9: Integrate #182 only through the bootstrap-safe path**
- [ ] **Step 10: Prove the deployed emitter downstream**
- [ ] **Step 11: Final verification checkpoint**
