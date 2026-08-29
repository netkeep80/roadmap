# Scheduled Observers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the autonomous scheduled developer pool with five fixed, non-overlapping observer/reconciler roles that never modify target repositories.

**Architecture:** Keep deterministic portfolio synchronization as the Roadmap Reconciler. Add a small `roadmap-observer/v1` validator for the four diagnostic snapshots, remove the forward Worker Slot execution runtime and slot integration, and make current documentation point only to observer roles. Historical agent evidence remains readable but is not a scheduled hot path.

**Tech Stack:** Node.js `.mjs`, GitHub Actions, GitHub Issues, Markdown, JSON.

**Spec:** `docs/superpowers/specs/2026-08-29-scheduled-observers-design.md`

## Global Constraints

- Scheduled tasks must never write target repositories.
- Scheduled tasks must never select engineering work, change architecture/priority/ownership/lifecycle, infer fixes, perform migrations, or create successor work.
- Roadmap Reconciler may update only generated `STATUS.md` / `data/status.json` through the existing deterministic sync path.
- CI Sentinel, PR Watchdog, Dependency Watchdog, and Portfolio Auditor may each replace only their own permanent roadmap issue body.
- Historical Role / Session / Checkpoint / Claim / Message evidence remains readable.
- Remove obsolete forward Worker Slot machinery rather than preserving a compatibility layer.

---

### Task 1: Observer snapshot protocol

**Files:**
- Create: `scripts/observer-snapshot.mjs`
- Create: `scripts/observer-snapshot.test.mjs`
- Modify: `.github/workflows/portfolio-validate.yml`

**Interfaces:**
- Produces: `validateObserverSnapshot(snapshot, expectedRole)` returning `{ ok, errors }`.
- Allowed roles: `ci-sentinel`, `pr-watchdog`, `dependency-watchdog`, `portfolio-auditor`.
- Allowed top-level status: `not-run`, `ok`, `degraded`, `attention`.
- Each item must contain `repository`, `subject`, `classification`, `evidence`; `needs_reasoning` is optional boolean.
- Maximum `items.length`: 100. If truncated, top-level `truncated` must be `true` and `total_items` must be an integer >= retained item count.

- [ ] Write tests rejecting wrong protocol/role, invalid timestamps, unknown status, malformed items, inferred-cause fields, and >100 unmarked items.
- [ ] Run the new test and confirm failure before implementation.
- [ ] Implement the minimal pure validator with no GitHub writes.
- [ ] Run the new test and confirm pass.
- [ ] Add the test to `portfolio-validate.yml`.

### Task 2: Remove autonomous scheduled-worker runtime

**Files:**
- Delete: `data/worker-policy.json`
- Delete: `scripts/worker-runtime.mjs`
- Delete: `scripts/worker-runtime.test.mjs`
- Delete: `scripts/worker-runtime-forward.test.mjs`
- Delete: `scripts/worker-slot-runtime.mjs`
- Delete: `scripts/worker-slot-runtime.test.mjs`
- Delete: `scripts/worker-slot-status.mjs`
- Delete: `scripts/agent-status-slots.test.mjs`
- Modify: `.github/workflows/portfolio-validate.yml`
- Modify only if required by imports: `scripts/agent-status.mjs`, `scripts/agent-status.test.mjs`, `scripts/sync-agent-status.mjs`, `scripts/sync-agent-status.test.mjs`, `.github/workflows/agent-status.yml`

**Interfaces:**
- Preserves historical/manual Role / Session / Checkpoint / Claim / Message parsing and projection where still independently useful.
- Removes Slot assignment/generation/acquisition/self-dispatch from the forward runtime.

- [ ] Search current branch references/imports to every file scheduled for deletion.
- [ ] First adjust tests/workflow expectations so current slot-specific behavior is no longer required.
- [ ] Remove slot-only branches/imports from shared agent-status code while preserving historical evidence handling.
- [ ] Delete files that have no remaining non-slot consumer.
- [ ] Run remaining agent protocol/status tests plus observer snapshot tests.

### Task 3: Replace current scheduled-worker documentation

**Files:**
- Replace: `SCHEDULED_WORKERS.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `AGENT_PROTOCOL.md`
- Modify: `OPERATING_MODEL.md`
- Modify if current wording requires it: `DECISIONS.md`

**Interfaces:**
- Permanent observer references: Roadmap Reconciler #421, CI Sentinel #416, PR Watchdog #417, Dependency Watchdog #418, Portfolio Auditor #419.
- Historical Worker Slots #385-#389 must be explicitly described as retired historical evidence, never active coordination surfaces.

- [ ] Replace `SCHEDULED_WORKERS.md` with the observer role contract, fixed write boundaries, schedules, and copyable prompts.
- [ ] Remove current Worker Slot bootstrap/authority diagrams from README.
- [ ] Remove scheduled Slot execution requirements from AGENTS/AGENT_PROTOCOL/OPERATING_MODEL while retaining clearly marked historical protocol material only where useful.
- [ ] Search current docs for `#385`, `#386`, `#387`, `#388`, `#389`, `WORKER_SLOT`, `self-dispatch`, and `Worker Slot`; verify every remaining occurrence is explicitly historical or removed.

### Task 4: Repository acceptance and migration cleanup

**Files:** repository-wide verification only.

- [ ] Run the exact `portfolio-validate` local test command after obsolete tests are removed.
- [ ] Run `node scripts/sync-roadmap.mjs --validate`.
- [ ] Inspect PR #415 workflow results and repo-guard.
- [ ] Fix only migration regressions until all required checks are green.
- [ ] Mark PR #415 ready and merge with expected-head protection.
- [ ] Confirm `main` contains the merged commit and generated portfolio state remains healthy.
- [ ] Close Worker Slot issues #385-#389 as completed/retired without rewriting their historical bodies.
- [ ] Close implementation issue #420 when the repository-side migration is complete.

### Task 5: Reconfigure ChatGPT scheduled tasks

**External state:** five existing ChatGPT tasks `Roadmap Worker 1` through `Roadmap Worker 5`, currently disabled.

- [ ] Reconfigure Worker 1 as Roadmap Reconciler, hourly, referencing #421 and deterministic portfolio sync only.
- [ ] Reconfigure Worker 2 as CI Sentinel, hourly, writing only issue #416.
- [ ] Reconfigure Worker 3 as PR Watchdog, hourly, writing only issue #417.
- [ ] Reconfigure Worker 4 as Dependency Watchdog, every 6 hours, writing only issue #418.
- [ ] Reconfigure Worker 5 as Portfolio Auditor, every 6 hours after observer refreshes, writing only issue #419.
- [ ] Keep all tasks disabled until repository-side migration is merged and green.
- [ ] Enable the five fixed observer roles only after the merge confirmation.
- [ ] Verify task prompts contain explicit prohibition of target-repository writes and engineering decisions.
