# Scheduled Worker Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make timer-driven worker invocations safe, bounded, lease-aware, idempotent, and able to exit without inventing work.

**Architecture:** Keep GitHub Agent Control Plane objects authoritative. Add one machine policy and one pure runtime decision module for lease/work/recovery decisions; strengthen Session/Checkpoint validation; document the pool bootstrap separately from permanent Role bootstrap. Scheduled timers remain external wake-up mechanisms only.

**Tech Stack:** Node.js ESM, `node:test`, GitHub Issues/Comments, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-24-scheduled-worker-runtime-design.md`

## Global Constraints

- Scope remains exactly `public-owner-repositories`; structured unknown/non-public references fail closed.
- `Timer != Agent identity`, `Timer != context storage`, and `Timer != scheduler authority`.
- `lease_seconds = 7200` and `heartbeat_target_seconds = 3600` for the first accepted policy.
- `handoff` is resumable but is not a running executor and must hold zero claims.
- No explicit executable work means `exit_no_work`; there is no work-invention transition.
- `roadmap` coordinator remains bounded by existing declared goals/invariants and real drift/transition/blocker/message/control-plane work.
- Local repository CI/repo-guard remains the only integration-correctness authority.
- No global repository lock.

---

### Task 1: Lease classifier and bounded decision kernel

**Files:**
- Create: `data/worker-policy.json`
- Create: `scripts/worker-runtime.mjs`
- Create: `scripts/worker-runtime.test.mjs`
- Modify: `scripts/agent-protocol.mjs`
- Modify: `scripts/agent-protocol.test.mjs`

**Interfaces:**
- Consumes: validated Session/Checkpoint objects from `agent-protocol.mjs` and explicit candidate facts collected from GitHub.
- Produces:
  - `validateWorkerPolicy(policy) -> normalized policy`
  - `classifySessionLease({ session, checkpoints, now, policy }) -> { status, heartbeat_at, age_seconds }`
  - `selectBoundedWork({ handoffs, messages, issues }) -> { action, candidate|null }`
  - `decideStaleRecovery({ leaseStatus, revalidation }) -> { action, reason }`

- [ ] **Step 1: Write failing lease and bounded-autonomy tests**

Create `scripts/worker-runtime.test.mjs` with tests equivalent to:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySessionLease,
  decideStaleRecovery,
  selectBoundedWork,
  validateWorkerPolicy,
} from './worker-runtime.mjs';

const policy = validateWorkerPolicy({
  schema_version: 1,
  scope: 'public-owner-repositories',
  lease_seconds: 7200,
  heartbeat_target_seconds: 3600,
  work_source_order: ['handoff', 'message', 'local-issue'],
  no_work_action: 'exit',
  allow_speculative_work: false,
  coordinator_requires_declared_trigger: true,
});

test('latest valid checkpoint server timestamp controls LIVE versus STALE_CANDIDATE', () => {
  const session = { number: 10, created_at: '2026-08-24T09:00:00Z', data: { state: 'working', claims: ['netkeep80/alpha#1'] } };
  const checkpoints = [{ created_at: '2026-08-24T10:00:00Z', data: { state: 'working' } }];
  assert.equal(classifySessionLease({ session, checkpoints, now: '2026-08-24T11:59:59Z', policy }).status, 'live');
  assert.equal(classifySessionLease({ session, checkpoints, now: '2026-08-24T12:00:01Z', policy }).status, 'stale_candidate');
});

test('handoff is resumable and terminal states are not live executors', () => {
  assert.equal(classifySessionLease({ session: { created_at: '2026-08-24T09:00:00Z', data: { state: 'handoff', claims: [] } }, checkpoints: [], now: '2026-08-24T18:00:00Z', policy }).status, 'resumable_handoff');
  assert.equal(classifySessionLease({ session: { created_at: '2026-08-24T09:00:00Z', data: { state: 'completed', claims: [] } }, checkpoints: [], now: '2026-08-24T18:00:00Z', policy }).status, 'terminal');
});

test('no explicit executable candidate returns exit_no_work', () => {
  assert.deepEqual(selectBoundedWork({ handoffs: [], messages: [], issues: [] }), {
    action: 'exit_no_work',
    candidate: null,
  });
});

test('bounded selection never chooses blocked, live-occupied or stale-recovery issues', () => {
  const result = selectBoundedWork({
    handoffs: [],
    messages: [],
    issues: [
      { ref: 'netkeep80/alpha#1', open: true, portfolio_consistent: true, executable_now: true, blocked: true, occupied_by_live_winner: false, stale_recovery_required: false },
      { ref: 'netkeep80/alpha#2', open: true, portfolio_consistent: true, executable_now: true, blocked: false, occupied_by_live_winner: true, stale_recovery_required: false },
      { ref: 'netkeep80/alpha#3', open: true, portfolio_consistent: true, executable_now: true, blocked: false, occupied_by_live_winner: false, stale_recovery_required: true },
    ],
  });
  assert.equal(result.action, 'exit_no_work');
});

test('stale work cannot resume before complete GitHub revalidation', () => {
  assert.equal(decideStaleRecovery({ leaseStatus: 'stale_candidate', revalidation: null }).action, 'revalidate');
  assert.equal(decideStaleRecovery({ leaseStatus: 'stale_candidate', revalidation: { complete: true, work_still_executable: false, occupied_by_live_winner: false } }).action, 'abandon_without_resume');
  assert.equal(decideStaleRecovery({ leaseStatus: 'stale_candidate', revalidation: { complete: true, work_still_executable: true, occupied_by_live_winner: false } }).action, 'abandon_then_replace');
});
```

Also extend `agent-protocol.test.mjs`:

```js
test('validateSession rejects claims on handoff sessions', () => {
  const coverage = validateRoleCoverage(['alpha'], ['alpha'], [role('alpha', 10)]);
  assert.throws(
    () => validateSession(session({ state: 'handoff', claims: ['netkeep80/alpha#7'] }), coverage.roleMap),
    /handoff|claim/i,
  );
});
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
node --test scripts/worker-runtime.test.mjs scripts/agent-protocol.test.mjs
```

Expected: FAIL because `worker-runtime.mjs`/exports do not exist and current `validateSession` permits handoff claims.

- [ ] **Step 3: Implement minimal policy/runtime**

Create `data/worker-policy.json` exactly:

```json
{
  "schema_version": 1,
  "scope": "public-owner-repositories",
  "lease_seconds": 7200,
  "heartbeat_target_seconds": 3600,
  "work_source_order": ["handoff", "message", "local-issue"],
  "no_work_action": "exit",
  "allow_speculative_work": false,
  "coordinator_requires_declared_trigger": true
}
```

Implement `scripts/worker-runtime.mjs` with no I/O and no work creation. Lease heartbeat is latest valid Checkpoint `created_at`, else Session issue `created_at`; do not use Session `updated_at`. `selectBoundedWork` accepts only caller-provided candidates and checks explicit booleans. `decideStaleRecovery` returns `revalidate` until `revalidation.complete === true`.

Modify `validateSession` so:

```js
if (data.state === 'handoff' && claims.length) {
  fail('handoff session cannot retain claims');
}
```

- [ ] **Step 4: Run GREEN verification**

Run:

```bash
node --test scripts/worker-runtime.test.mjs scripts/agent-protocol.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add data/worker-policy.json scripts/worker-runtime.mjs scripts/worker-runtime.test.mjs scripts/agent-protocol.mjs scripts/agent-protocol.test.mjs
git commit -m "feat: add bounded scheduled worker runtime"
```

---

### Task 2: Validate Checkpoint history for every protocol Session

**Files:**
- Create: `scripts/sync-agent-status.test.mjs`
- Modify: `scripts/sync-agent-status.mjs`

**Interfaces:**
- Consumes: all validated protocol Sessions, not only live/resumable projection states.
- Produces: `buildLiveAgentSnapshot(..., listComments?)` that validates marked Checkpoint comments on every Session while `buildAgentSnapshot` continues projecting only active states.

- [ ] **Step 1: Write failing terminal-history test**

Create a test fixture with one valid Role and one terminal Session containing a marked malformed/non-checkpoint comment. Inject a fake comment loader into `buildLiveAgentSnapshot` and assert rejection:

```js
await assert.rejects(
  () => buildLiveAgentSnapshot({
    registry,
    repositories,
    issues: [roleIssue, terminalSessionIssue],
    checkedAt: '2026-08-24T12:00:00Z',
    listComments: async () => [{ id: 999, body: block({ protocol: 'roadmap-agent-message/v1' }), created_at: '2026-08-24T11:00:00Z' }],
  }),
  /not a checkpoint|checkpoint/i,
);
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
node --test scripts/sync-agent-status.test.mjs
```

Expected: FAIL because current `buildLiveAgentSnapshot` ignores injected loader and fetches/validates comments only for active Session states.

- [ ] **Step 3: Implement minimal historical validation**

Change signature:

```js
export async function buildLiveAgentSnapshot({
  registry,
  repositories,
  issues,
  checkedAt = new Date().toISOString(),
  listComments = listIssueComments,
})
```

Then iterate **all** `sessions` when fetching/validating protocol-marked comments:

```js
for (const session of sessions) {
  const comments = await listComments(registry.owner, registry.control_repository, session.number);
  // existing strict protocol + validateCheckpoint path
}
```

Do not change `buildAgentSnapshot` active projection filtering.

- [ ] **Step 4: Run GREEN verification**

Run:

```bash
node --test scripts/sync-agent-status.test.mjs scripts/agent-protocol.test.mjs scripts/worker-runtime.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-agent-status.mjs scripts/sync-agent-status.test.mjs
git commit -m "fix: validate all session checkpoint history"
```

---

### Task 3: Scheduled-worker bootstrap docs and blocking CI wiring

**Files:**
- Create: `SCHEDULED_WORKERS.md`
- Modify: `AGENTS.md`
- Modify: `AGENT_PROTOCOL.md`
- Modify: `.github/workflows/portfolio-validate.yml`

**Interfaces:**
- Consumes: `data/worker-policy.json` and runtime semantics from Tasks 1–2.
- Produces: one minimal pool-worker bootstrap path and CI execution of all new tests.

- [ ] **Step 1: Add documented runtime contract**

`SCHEDULED_WORKERS.md` must contain this exact minimal prompt block:

```text
Open netkeep80/roadmap.
Bootstrap strictly through the Agent Control Plane.
Reconstruct current Role/Session/Claim/Message/portfolio state from GitHub.
Perform only explicitly executable work permitted by the Agent Control Plane.
Never invent work.
Never duplicate work held by a live winning Session.
Recover a stale Session only through the documented lease/revalidation protocol.
Before every repository write or lifecycle transition, refresh exact GitHub state and obey local CI/repo-guard.
If no executable unclaimed work exists, make no repository changes and terminate this run.
Before finishing meaningful work, leave a durable Checkpoint.
```

It must explicitly say pool workers create no Session on an idle run and scan eligible Roles before Role entry.

- [ ] **Step 2: Update permanent bootstrap/protocol docs**

In `AGENTS.md`, add scheduled-worker link and hard rule:

```text
absence of work != permission to invent work
NO EXPLICIT EXECUTABLE WORK => EXIT
```

In `AGENT_PROTOCOL.md`, add Session liveness classification and two-phase stale recovery; refine `handoff` as resumable/non-running with zero claims; state that all protocol Session Checkpoints validate even for terminal history.

- [ ] **Step 3: Wire blocking CI**

Add paths:

```yaml
- "data/worker-policy.json"
- "scripts/worker-runtime.mjs"
- "scripts/worker-runtime.test.mjs"
- "scripts/sync-agent-status.test.mjs"
- "SCHEDULED_WORKERS.md"
```

Extend the test command to include:

```text
scripts/worker-runtime.test.mjs
scripts/sync-agent-status.test.mjs
```

- [ ] **Step 4: Run full verification**

Run:

```bash
node --test scripts/agent-protocol.test.mjs scripts/validate-agents.test.mjs scripts/agent-role-template.test.mjs scripts/reconcile-agent-roles.test.mjs scripts/agent-status.test.mjs scripts/agent-status-privacy.test.mjs scripts/worker-runtime.test.mjs scripts/sync-agent-status.test.mjs
node scripts/sync-roadmap.mjs --validate
node scripts/validate-agents.mjs --enforce
node scripts/sync-agent-status.mjs --validate-live
```

Expected: all tests and live validations pass.

- [ ] **Step 5: Commit**

```bash
git add SCHEDULED_WORKERS.md AGENTS.md AGENT_PROTOCOL.md .github/workflows/portfolio-validate.yml
git commit -m "docs: define scheduled worker bootstrap"
```

---

### Task 4: Acceptance evidence and production gate update

**Files / GitHub state:**
- Update: roadmap issue #62
- Update: parent roadmap issue #55
- Reuse evidence: #56–#61 and Message #60

**Interfaces:**
- Consumes: green PR CI and real Agent Control Plane Issues.
- Produces: explicit accepted/not-yet-accepted A10 matrix; no real Scheduled Tasks are enabled by this task.

- [ ] **Step 1: Verify PR lifecycle gates on exact head**

Required:

```text
exact current main
open PR set
exact PR head SHA
behind_by=0
mergeable=true
draft=false
full Portfolio validate green on exact head
```

Merge only with `expected_head_sha` and then confirm exact new `main`.

- [ ] **Step 2: Run practical acceptance**

Use current A8 evidence for collision/handoff and add synthetic deterministic runtime tests for elapsed lease time (do not wait two real hours). Verify a real no-work worker decision by inspecting an explicitly idle candidate set and making zero repository writes in that worker path.

- [ ] **Step 3: Update #62**

Mark only evidenced acceptance items complete. Record exact PR, CI run/head, merged main SHA, A8 Issue references, and any remaining production blocker.

- [ ] **Step 4: Reconcile #55**

Mark A7 factual snapshot items complete, record accepted A8 evidence, and add A10 child #62 as the scheduled-worker production gate.

- [ ] **Step 5: Leave durable checkpoint**

Create/update the `roadmap` developer Session only if an explicit executable control-plane Session is needed. Before ending meaningful implementation work, leave a structured Checkpoint that contains public issue/PR/SHA evidence and the exact next executable action. Do not store private reasoning.
