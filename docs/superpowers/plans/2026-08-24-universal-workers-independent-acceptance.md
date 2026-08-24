# Universal Workers Independent Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the public Agent Control Plane to duration-independent execution, normalized finish-first selection and independent exact-candidate acceptance without rewriting v1 history or reintroducing automatic historical scans.

**Architecture:** Dual-read Session/Checkpoint v1+v2, with immutable v2 `work_item`/`work_phase`, event-local candidate/acceptance validation and transient WorkCandidate ranking. Target repositories may later enforce acceptance through a bounded pointer chain; until proven blocking, automated material merge remains forbidden.

**Tech Stack:** Node.js ESM, GitHub Issues/Contents/Actions APIs, existing roadmap protocol/status/runtime scripts and node:test suites.

**Spec:** `docs/superpowers/specs/2026-08-24-universal-workers-independent-acceptance-design.md`

## Global Constraints

- Preserve all historical v1 Role/Session/Message/Checkpoint evidence without rewriting it.
- New automatic validation must be local/write-boundary; `--validate-live` remains manual/baseline forensic operation only.
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
- Candidate validation resolves attached Session + exact target PR.
- Acceptance validation resolves attached acceptance Session + exact candidate Session/comment + exact target PR.

- [ ] Add RED tests showing candidate head/base mismatch fails closed.
- [ ] Add RED tests showing same Session cannot final-accept its own candidate.
- [ ] Add RED tests showing stale H/B and forged candidate comment pointer fail closed.
- [ ] Add regression asserting event mode never calls historical Session/comment collection.
- [ ] Implement bounded resolvers and exact relation checks.
- [ ] Keep `--validate-live` explicit/manual only; do not call it from automatic status/event workflows.
- [ ] Run `node --test scripts/agent-evidence-integrity.test.mjs` to GREEN.

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

- Every design requirement is mapped to Tasks 1-6.
- No task introduces persistent quantum/model/fairness/scheduler metadata.
- Target enforcement is staged after protocol evidence; no existing safety is weakened.
- Historical scans remain manual forensic operations only.
