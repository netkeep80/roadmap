# Control Plane Evidence Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make structured Checkpoint commit evidence live-verifiable, prevent stale healthy Agent Status after integrity failure, and avoid control-plane self-DoS from redundant GitHub history scans.

**Architecture:** Validate commit evidence at the GitHub `issue_comment` write boundary. On `created` / `edited` structured Checkpoint comments, resolve only that changed Checkpoint's unique `commit:<sha>` refs in the exact registered Session repository. Do not add another automatic full-history commit-resolution pass; the existing Agent Status structural history scan remains the historical validator, while `--validate-live` is retained only as an explicit forensic baseline audit. Protocol comments do not trigger a full Agent Status rebuild. Any integrity/status failure publishes a constant-safe `CONTROL PLANE INVALID` body to issue #103 without converting the failed workflow to success.

**Compatibility baseline:** branch-lifecycle PR #124 is already merged into `main`; this change is verified on top of that model and preserves durable `current_branch` behavior.

**Tech Stack:** Node.js ESM, node:test, GitHub REST API, GitHub Actions.

**Spec:** https://github.com/netkeep80/roadmap/issues/131

## Global Constraints

- A syntactically valid but nonexistent `commit:<sha>` must fail closed.
- Bare `commit:` evidence is scoped to the Session repository only.
- Resolve only registered public Session repositories.
- Deduplicate repeated repository+SHA lookups within one validation call.
- Non-Checkpoint/deleted-comment events perform zero commit-resolution calls.
- Automatic workflows must not add a second complete historical comments+commit scan.
- Protocol Checkpoint comments must not trigger a full Agent Status rebuild.
- INVALID status must not echo raw malformed payload or out-of-scope/private identifiers.
- Publishing INVALID must not turn a failed workflow green.
- Preserve Role/Session/Message/Checkpoint validation, PR reconciliation and branch lifecycle semantics.

---

### Task 1: Commit-evidence boundary

**Files:**
- `scripts/agent-evidence-integrity.test.mjs`
- `scripts/agent-evidence-integrity.mjs`
- `.github/workflows/agent-evidence-integrity.yml`

**Interfaces:**
- `validateCommitEvidence(records, resolveCommit)` validates `{ repository, sha }` records and deduplicates lookups.
- `validateCheckpointEventEvidence({ event, registry, resolveCommit })` validates only one changed Checkpoint event.
- `node scripts/agent-evidence-integrity.mjs --validate-event` is the automatic write-boundary path.
- `node scripts/agent-evidence-integrity.mjs --validate-live` remains manual/forensic only.

- [x] **Step 1: RED contract for nonexistent well-formed SHA**
- [x] **Step 2: GREEN repository-scoped commit resolution**
- [x] **Step 3: Deduplicate repository+SHA lookups**
- [x] **Step 4: RED contract for missing event-scoped boundary**
- [x] **Step 5: GREEN changed-Checkpoint-only validation**
- [x] **Step 6: Prove non-Checkpoint/deleted events make zero commit API calls**
- [x] **Step 7: Remove automatic full-history `--validate-live` from PR/status cadence**

### Task 2: Fail-visible Agent Status without comment-triggered rebuilds

**Files:**
- `.github/workflows/agent-status.yml`
- `scripts/agent-evidence-integrity.test.mjs`

**Interfaces:**
- `renderInvalidAgentStatus({ checkedAt, runUrl })` returns constant-safe markdown containing `CONTROL PLANE INVALID`.
- Checkpoint comment events execute event evidence validation but skip `sync-agent-status.mjs` full rebuild.
- Schedule / workflow-dispatch / push and protocol issue lifecycle events retain the normal Agent Status rebuild path.

- [x] **Step 1: RED renderer/workflow contract**
- [x] **Step 2: Publish safe INVALID status on failure**
- [x] **Step 3: Preserve red workflow conclusion after fallback publication**
- [x] **Step 4: Filter `issue_comment` trigger on the comment marker, not the parent issue marker**
- [x] **Step 5: Skip full Agent Status rebuild for protocol comment events**

### Task 3: Historical repair and integration verification

- [x] Repair foreign bare `commit:` ref in roadmap Session #130 without losing provenance.
- [x] Repair foreign `mts_visual` bare commit ref in anum_docs Session #123 without losing provenance.
- [x] Repair foreign roadmap status-snapshot bare commit ref in anum_docs Session #56 without losing provenance.
- [x] Reconcile branch with merged branch-lifecycle PR #124.
- [x] Verify `behind_by=0` against current `main` before final merge gate.
- [x] Verify exact-head `Agent evidence integrity` GREEN.
- [x] Verify exact-head `Portfolio validate` GREEN, including live GitHub coverage and Agent Status inputs.
- [x] Verify exact-head `repo-guard advisory` GREEN.

Before merge, re-read fresh `main`, unchanged PR head, review/thread state and exact-head workflow results; merge only with `expected_head_sha`.
