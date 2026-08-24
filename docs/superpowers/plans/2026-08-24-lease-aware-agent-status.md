# Lease-Aware Agent Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated Agent status classify leased Sessions with the accepted runtime lease policy and distinguish LIVE claims from stale recovery-required claims.

**Architecture:** Reuse `classifySessionLease` from `scripts/worker-runtime.mjs` inside `scripts/agent-status.mjs` rather than duplicating lease arithmetic. `buildAgentSnapshot` will project LIVE Sessions, STALE_CANDIDATE Sessions, resumable handoffs, ordinary LIVE claim winners, and stale retained claims separately.

**Tech Stack:** Node.js ES modules, `node:test`, GitHub Actions, roadmap Agent Control Plane.

**Spec:** `docs/superpowers/specs/2026-08-24-anonymous-scheduled-worker-design.md`

## Global Constraints

- `lease_seconds = 7200` and `heartbeat_target_seconds = 3600` remain unchanged.
- GitHub server Checkpoint `created_at`, else Session `created_at`, is authoritative heartbeat.
- `updated_at` must not determine liveness.
- A stale claim is recovery-required, never automatically free.
- No Session mutation from status generation.
- No portfolio semantic changes in this plan.

---

### Task 1: RED lease-aware projection

**Files:**
- Modify: `scripts/agent-status.test.mjs`

**Interfaces:**
- Consumes: `buildAgentSnapshot({ checkedAt, roles, sessions, messages, checkpointsBySession, workerPolicy })`
- Produces: failing behavior expectations for `stale_candidate_sessions` and stale retained claims.

- [ ] Add a test with one Session exactly at lease boundary and one just beyond it.
- [ ] Assert the boundary Session remains LIVE and the expired Session moves to `stale_candidate_sessions`.
- [ ] Assert only the LIVE Session contributes to ordinary `claims`.
- [ ] Assert the expired Session's retained claim appears in `stale_claims` as recovery-required.
- [ ] Push the test-only commit and observe exact-head `Portfolio validate` fail because current production projection lacks this behavior.

### Task 2: GREEN production projection

**Files:**
- Modify: `scripts/agent-status.mjs`
- Modify if required for call sites: `scripts/sync-agent-status.mjs`

**Interfaces:**
- Consumes: `classifySessionLease` and validated `workerPolicy`.
- Produces: `active_sessions`, `stale_candidate_sessions`, `resumable_handoffs`, `claims`, `stale_claims`.

- [ ] Import and call the existing lease classifier for every leased protocol Session.
- [ ] Keep LIVE Sessions in `active_sessions`; project expired leased Sessions separately.
- [ ] Build ordinary claim collision winners only from LIVE Sessions.
- [ ] Project retained claims from stale Sessions separately without declaring them free or choosing them as LIVE winners.
- [ ] Render explicit STALE_CANDIDATE and stale-claim sections in `AGENTS_STATUS.md`.
- [ ] Run exact-head CI and repo-guard until green.

### Task 3: Final exact-head verification and lifecycle

**Files:**
- No new production scope.

- [ ] Refresh exact `main`, PR head/base, behind status, mergeability, draft state, changed files, checks, and policy before lifecycle transition.
- [ ] Confirm full `Portfolio validate` green and advisory repo-guard green on the same exact head.
- [ ] Mark PR ready only after exact-head gates are green.
- [ ] Merge only with expected head SHA.
- [ ] Confirm exact new `main` SHA.
- [ ] Update #87 acceptance and leave Session #90 as claim-free handoff/completed state.
