# Fixed Scheduled Worker Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anonymous scheduled-worker coordination with five durable assignment Slots so ordinary invocations resume one known assignment and global selection runs only when a Slot is idle.

**Architecture:** Add a small `roadmap-worker-slot/v1` protocol and Slot runtime around permanent GitHub Slot issues. Slot body is a bounded mutable snapshot; target Issue/Git/PR/CI remain execution truth. Idle Slots self-dispatch through the existing deterministic normalized selector, while generation fencing prevents delayed invocations from mutating a newer assignment.

**Tech Stack:** Node.js ESM runtime/tests, GitHub Issues API, existing roadmap control-plane protocol/status scripts.

**Spec:** `docs/superpowers/specs/2026-08-28-fixed-worker-slots-design.md`

## Global Constraints

- Exactly five permanent Worker Slot issues.
- `WORKER_SLOT` is one of `1..5` and identifies the permanent Slot used by that Scheduled Task.
- Slot `generation` increases only when acquiring a new assignment.
- Slot snapshot is best-effort mutable operational memory, not execution truth.
- Target Issue/Git/PR/CI remain execution truth and integration authority.
- Normal Slot execution creates zero Slot comments.
- No final checkpoint is required for crash recovery.
- Assigned Slots do not perform global work selection.
- Idle Slots self-dispatch only explicit executable work and never invent work.
- Do not delete historical Session/Checkpoint/Handoff evidence in the initial cutover.

---

### Task 1: Slot protocol and generation fence

**Files:**
- Modify: `scripts/agent-protocol.mjs`
- Modify: `scripts/agent-protocol.test.mjs`
- Modify: `scripts/worker-runtime.mjs`
- Modify: `scripts/worker-runtime.test.mjs`

**Interfaces:**
- Produces: parsing/validation for `roadmap-worker-slot/v1`.
- Produces: helpers that classify a Slot as idle/assigned and reject stale-generation mutation.
- Consumes: existing registered-public-repository and issue-reference validation.

- [ ] **Step 1: Add failing protocol tests**

Add tests covering exactly five valid slot numbers, idle state, assigned state, same-repository Role/work-item references, nullable branch/PR/progress, positive integer generation, and rejection of unknown fields/state combinations that would make ownership ambiguous.

- [ ] **Step 2: Run protocol tests and confirm RED**

Run:

```bash
node --test scripts/agent-protocol.test.mjs
```

Expected: new Slot protocol cases fail because `roadmap-worker-slot/v1` is unknown.

- [ ] **Step 3: Implement minimal Slot parser/validator**

Extend `ISSUE_PROTOCOLS` with `roadmap-worker-slot/v1` and validate:

```text
slot: integer 1..5
generation: integer >= 0
state: idle | working | waiting | blocked
idle => assignment/current_branch/current_pr/progress are null
non-idle => assignment is present and explicit
assignment.repository is registered public
assignment.work_item belongs to assignment.repository
assignment.role_issue resolves to that repository's permanent Role
```

Keep Slot validation separate from Session lifecycle validation.

- [ ] **Step 4: Add failing runtime generation-fence tests**

Cover:

```text
same slot + same generation => mutation may proceed
same slot + newer generation => stale invocation exits
wrong slot => stale invocation exits
idle slot => dispatcher path
assigned slot => resume path
```

- [ ] **Step 5: Implement minimal Slot runtime helpers**

Add focused helpers to `worker-runtime.mjs`, for example:

```js
classifySlot(slot)
validateSlotInvocation({ slot, workerSlot, generation })
decideSlotEntry({ slot })
```

Keep these pure; they decide actions but do not call GitHub.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test scripts/agent-protocol.test.mjs scripts/worker-runtime.test.mjs
```

Expected: PASS.

---

### Task 2: Slot-first resume and idle self-dispatch

**Files:**
- Modify: `scripts/worker-runtime.mjs`
- Modify: `scripts/worker-runtime.test.mjs`
- Modify: `data/worker-policy.json`
- Modify: `SCHEDULED_WORKERS.md`

**Interfaces:**
- Consumes: Slot parser/helpers from Task 1.
- Consumes: existing normalized candidate ordering.
- Produces: deterministic assigned-fast-path versus idle-dispatch decisions.
- Produces: bounded assignment-acquisition decision for a same-candidate race.

- [ ] **Step 1: Write failing fast-path tests**

Prove that an assigned Slot returns a resume action without inspecting/ranking unrelated candidates and that stale `progress.next_action` never blocks continuation.

- [ ] **Step 2: Write failing idle-dispatch tests**

Prove that idle dispatch:

```text
uses normalized candidate order
skips work already assigned to another Slot
returns exit_no_work when no explicit executable candidate remains
never uses scheduler timing/slot number as priority
```

- [ ] **Step 3: Write failing assignment-race tests**

Model two idle Slots selecting the same candidate and require one deterministic acquisition winner while the loser reselects the next candidate or exits. Scope the arbitration only to `idle -> assigned`; do not create a long-lived execution claim.

- [ ] **Step 4: Run runtime tests and confirm RED**

Run:

```bash
node --test scripts/worker-runtime.test.mjs
```

Expected: the new Slot-first and assignment-acquisition cases fail.

- [ ] **Step 5: Implement Slot-first runtime decisions**

Refactor selection entry so the first decision is:

```text
assigned Slot -> resume assigned work
idle Slot -> normalized bounded dispatch
```

Reuse `selectNormalizedWork` ordering rather than duplicating priority logic.

- [ ] **Step 6: Narrow worker policy**

Update `data/worker-policy.json` to describe fixed Slot execution and remove policy fields whose only forward purpose is anonymous Session lease/recovery in the scheduled-worker hot path. Preserve compatibility where current validators still need historical Session policy semantics until Task 4.

- [ ] **Step 7: Rewrite the copyable Scheduled Worker prompt**

`SCHEDULED_WORKERS.md` should expose the same prompt five times differentiated only by:

```text
WORKER_SLOT=1..5
```

The prompt instructs the agent to read its permanent Slot first, resume if assigned, self-dispatch only when idle, update the Slot body opportunistically, create no Slot comments, and use target GitHub state as execution truth.

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test scripts/worker-runtime.test.mjs scripts/agent-protocol.test.mjs
```

Expected: PASS.

---

### Task 3: Permanent Slot issues and status projection

**Files:**
- Modify: `scripts/agent-status.mjs`
- Modify: `scripts/agent-status.test.mjs`
- Modify: `scripts/sync-agent-status.mjs`
- Modify: `scripts/sync-agent-status.test.mjs`
- Modify: `README.md`
- Modify: `AGENT_PROTOCOL.md`

**GitHub state:**
- Create permanent issues `[Worker Slot] 1` through `[Worker Slot] 5`.

**Interfaces:**
- Consumes: Slot protocol from Task 1.
- Produces: primary current-worker status table keyed by Slot.

- [ ] **Step 1: Create five permanent idle Slot issues**

Create exactly five open issues with canonical `roadmap-worker-slot/v1` blocks, `generation: 0`, `state: idle`, and no comments created by bootstrap.

- [ ] **Step 2: Add failing status tests**

Require generated status to expose:

```text
Slot | Generation | State | Repository | Work item | Branch | PR | Progress
```

and make this the primary Scheduled Worker surface.

- [ ] **Step 3: Implement Slot status projection**

Extend snapshot construction/rendering with validated Slots. Keep historical Session/handoff sections available during migration but clearly compatibility-only.

- [ ] **Step 4: Update protocol/README documentation**

Document Slot ownership, generation fencing, snapshot semantics, no-comment invariant, assigned fast path, idle self-dispatch, and target source-of-truth boundaries. Mark anonymous scheduled-worker selection as superseded for forward Scheduled Workers.

- [ ] **Step 5: Run status/protocol tests**

Run:

```bash
node --test scripts/agent-status.test.mjs scripts/sync-agent-status.test.mjs scripts/agent-protocol.test.mjs
```

Expected: PASS.

---

### Task 4: Migration from anonymous handoffs to Slot assignments

**Files:**
- Modify only if required by tests: `scripts/worker-runtime.mjs`
- Modify only if required by tests: `scripts/agent-status.mjs`
- Modify: `SCHEDULED_WORKERS.md`
- Modify: `AGENT_PROTOCOL.md`

**GitHub state:**
- Revalidate current resumable unfinished work from live GitHub facts.
- Assign up to five executable continuations to the five Slots.
- Return genuinely blocked/non-executable continuations to ordinary candidate state without keeping a Slot occupied.

**Interfaces:**
- Consumes: all Slot runtime/status behavior from Tasks 1-3.
- Produces: operational Slot-first Scheduled Worker state.

- [ ] **Step 1: Re-read current Agent Status and target repositories**

For each current handoff, determine from current target Issue/branch/PR/CI whether it is executable now, completed, or genuinely externally blocked.

- [ ] **Step 2: Seed Slot assignments**

Assign executable continuations deterministically, incrementing each selected Slot from generation 0 to generation 1. Store only concise assignment/branch/PR/progress snapshot data.

- [ ] **Step 3: Verify crash-resume scenarios in tests**

Cover worker death after branch push, PR creation, CI transition, merge, and before Slot update. Every successor must resume from assignment plus target GitHub state without requiring a final checkpoint.

- [ ] **Step 4: Verify no-comment boundedness**

Prove normal runtime/status code does not require or append Slot comments and that completion reduces the Slot body back to bounded idle state.

- [ ] **Step 5: Run the full control-plane test suite**

Run the same Node test command used by `.github/workflows/portfolio-validate.yml` for all control-plane tests.

Expected: PASS.

---

### Task 5: Remove anonymous Session machinery from the Scheduled Worker hot path

**Files:**
- Modify: `scripts/worker-runtime.mjs`
- Modify: `scripts/worker-runtime.test.mjs`
- Modify: `scripts/agent-status.mjs`
- Modify: `AGENT_PROTOCOL.md`
- Modify: `SCHEDULED_WORKERS.md`

**Interfaces:**
- Consumes: operational Slot-first model from Tasks 1-4.
- Produces: simplified forward Scheduled Worker runtime while retaining historical parser compatibility.

- [ ] **Step 1: Add regression tests proving ordinary Slot resume does not require global Session lease reconstruction**

Assigned Slot continuation must not depend on LIVE/STALE/HANDOFF discovery, global Claim arbitration, or branch-custody transfer between transient Sessions.

- [ ] **Step 2: Remove only forward Scheduled Worker dependencies on those paths**

Preserve historical Session/Checkpoint/Handoff parsing and status compatibility. Do not rewrite or delete historical issues.

- [ ] **Step 3: Keep target integration gates unchanged**

Regression tests must continue to require target PR/CI/repo-guard/branch-protection checks where the existing repository workflow requires them.

- [ ] **Step 4: Run the complete control-plane suite and generated-state validation**

Run the repository's existing portfolio/control-plane validation commands used in CI.

Expected: PASS with five valid Slots and no forward dependency on anonymous worker selection for assigned work.
