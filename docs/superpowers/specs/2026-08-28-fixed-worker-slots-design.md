# Fixed Scheduled Worker Slots Design

Date: 2026-08-28

## Decision

Scheduled Workers move from the anonymous worker pool to exactly five persistent scheduler slots because the product currently permits five Scheduled Tasks and those invocations are better used as focused executors than as repeated global coordinators.

This change applies to Scheduled Workers only. It does not weaken target-repository correctness: the target Issue remains the requirements authority, Git/branch state remains unfinished-code authority, the PR remains integration state, and CI/repo-guard/branch protection remain verification/integration authority.

The previous anonymous-pool design remains historical context but is superseded for forward Scheduled Worker execution.

## Goal

Maximize useful implementation time per scheduled invocation by making ordinary runs O(1)-like resume operations instead of repeated portfolio-wide work-selection/recovery exercises.

A scheduled invocation should normally answer only:

1. What assignment does my slot own?
2. What is the current target-repository state for that assignment?
3. What useful implementation action can I execute now?

Global work selection occurs only when that slot is idle.

## Core model

There are exactly five permanent Worker Slot issues in `netkeep80/roadmap`:

```text
[Worker Slot] 1
[Worker Slot] 2
[Worker Slot] 3
[Worker Slot] 4
[Worker Slot] 5
```

Each Scheduled Task has exactly one positive integer `WORKER_SLOT=1..5` and reads only its own Slot first.

A Slot is a durable assignment owner, not merely observability metadata.

```text
Slot       = durable owner of one current assignment
Invocation = transient execution attempt for that Slot
Generation = identity/fence for one Slot assignment
Snapshot   = mutable best-effort current-state cache
Target GitHub state = execution truth
```

A Slot is never permanently bound to one repository. When its assignment completes or is released because of a real external blocker, the Slot becomes idle and may self-dispatch another explicit executable work item.

## Slot protocol

Canonical Slot state is stored by replacing the permanent Slot issue body. Normal execution MUST NOT append checkpoint/history comments to the Slot issue.

Illustrative assigned state:

```json
{
  "protocol": "roadmap-worker-slot/v1",
  "slot": 3,
  "generation": 18,
  "state": "working",
  "assignment": {
    "repository": "netkeep80/anum_docs",
    "role_issue": 32,
    "work_item": "netkeep80/anum_docs#959"
  },
  "current_branch": "observatory/959-evidence-traceability",
  "current_pr": "netkeep80/anum_docs#966",
  "progress": {
    "phase": "ci",
    "next_action": "Fix the first failing traceability test"
  }
}
```

Illustrative idle state:

```json
{
  "protocol": "roadmap-worker-slot/v1",
  "slot": 3,
  "generation": 18,
  "state": "idle",
  "assignment": null,
  "current_branch": null,
  "current_pr": null,
  "progress": null
}
```

`generation` increases only when a new assignment is acquired. It does not increase for ordinary invocations or progress updates.

Before any Slot issue update, an invocation MUST re-read its Slot and confirm that `slot` and `generation` still match the invocation's assignment. A delayed invocation from an older generation exits without changing Slot state or target-repository state.

## Snapshot semantics

The Slot issue body is operational memory, not execution authority.

The worker SHOULD update the Slot snapshot as useful work progresses, including when branch, PR, phase, or next action becomes clearer. However correctness MUST NOT depend on a final checkpoint or on any update happening before an invocation ends.

The snapshot may be stale.

If target GitHub state is newer than the Slot snapshot, the worker does not enter a special repair/recovery phase. It simply uses current target state, continues useful work, and writes a fresher Slot snapshot naturally at the next meaningful Slot update.

`progress.next_action` is an optimization only. Its absence, staleness, or loss must never prevent resumption.

This gives the crash invariant:

> The invocation may be killed at any point. The next invocation of the same Slot can continue safely from the Slot assignment plus current target Issue/branch/PR/CI state.

## Source-of-truth boundaries

For an assigned Slot:

```text
assignment identity / durable ownership -> Worker Slot issue
requirements / explicit work             -> target repository Issue
unfinished implementation                -> target Git branch
integration state                         -> target PR
verification / merge eligibility         -> target CI, repo-guard, branch protection
progress / next-action hint               -> disposable Slot snapshot
```

Do not duplicate commit history, PR history, CI history, or long completed-step narratives in the Slot issue.

## Normal assigned fast path

When the Slot has an assignment, the Scheduled Worker MUST NOT run global work selection.

```text
read own Slot
-> capture generation
-> read assigned target Issue
-> inspect exact known branch/PR when present
-> inspect current target state needed for the next action
-> continue exactly this assignment
-> update Slot snapshot opportunistically after meaningful transitions
```

If the assigned work is already complete, the worker clears the assignment and may enter the idle self-dispatch path in the same invocation if useful time remains.

A stale snapshot is not itself work and must not cause a metadata-only run.

## Idle self-dispatch path

No dedicated dispatcher Slot exists. Any idle Slot self-dispatches because reserving one of five Scheduled Tasks for rare coordination would waste capacity.

Idle dispatch is deliberately bounded and deterministic:

```text
read own Slot -> idle
-> obtain normalized executable candidates
-> skip work already assigned to another Slot
-> choose the first deterministic candidate
-> resolve only an actual same-candidate assignment race
-> persist new assignment with generation+1
-> immediately enter normal assigned fast path
```

The existing normalized selector remains useful as an algorithm, not as LLM reasoning:

1. explicit priority (`P0`, `P1`, ...);
2. explicit local/dependency order;
3. continuation before new work within the same effective rank;
4. repository lexical order;
5. issue number.

Messages remain inputs to executability/dependency state, not a separate priority queue.

The idle worker must not invent work. No executable candidate means the Slot remains idle and the invocation exits.

## Assignment collision

Two idle Slots may concurrently select the same apparently-free work item. This is the only cross-Slot ownership race that needs arbitration.

Use the smallest possible deterministic assignment-acquisition mechanism. It exists only for the `idle -> assigned` transition and does not become a long-lived execution Claim, lease, or handoff protocol.

After one Slot owns the assignment, later invocations resume by Slot identity; they do not repeat global Claim arbitration.

The implementation should prefer reusing an existing GitHub primitive if it can provide deterministic winner selection without introducing another durable history stream. Do not re-create the full anonymous Session/Claim lifecycle around every invocation.

## Same-Slot overlap

Two invocations of the same `WORKER_SLOT` may overlap. They share one assignment generation.

A minimal same-Slot overlap guard may remain if necessary, but it must be scoped only to that Slot/generation. It must not require portfolio-wide Session/Claim reconstruction.

Generation fencing is mandatory for Slot writes. Target writes must also fail safe when an invocation discovers that its generation is no longer current.

## Waiting and blocked work

A Slot should retain its assignment for short execution-local waits such as CI running, a temporarily non-mergeable PR, or another state expected to change as part of the same active implementation.

A Slot should release an assignment when progress requires a genuine external condition that may remain unresolved across many scheduler cycles, for example:

- human decision required;
- missing external source/evidence;
- dependency work that is not currently executable by this Slot;
- external service/registry prerequisite with no useful local continuation.

Before release, useful durable implementation remains in the target Issue/branch/PR. The Slot snapshot may carry a short current note, but no special handoff Session is required.

When the dependency later becomes executable, the work returns to the normal candidate set and may be assigned to any idle Slot.

## Comments and bounded state

Normal Slot execution creates zero Slot comments.

The Slot issue body is replaced in place and therefore remains bounded regardless of how many invocations execute the assignment.

Diagnostic comments, if ever permitted, are exceptional human-facing evidence only and must not participate in worker bootstrap or recovery. The implementation should not require periodic comment cleanup for normal operation because normal operation does not create them.

Historical execution evidence remains naturally in target Issues, commits, PRs, CI, and existing historical protocol issues.

## Relationship to current Session/Checkpoint/Handoff machinery

The existing Session/Checkpoint/Handoff system remains readable historical compatibility data during migration.

Forward Scheduled Worker correctness must stop depending on:

- anonymous invocation work affinity;
- global Session lease classification for ordinary resume;
- stale-Session ownership recovery for assigned work;
- resumable handoff discovery between ordinary scheduled invocations;
- branch-custody transfer between predecessor/successor Sessions;
- global Claim arbitration on every scheduled invocation.

Do not delete historical evidence as part of the first implementation slice. First establish Slot-based forward execution, then simplify status/runtime surfaces that no longer serve forward Scheduled Workers.

Permanent repository Roles may remain as repository metadata/directory authority unless a later bounded simplification proves them unnecessary. This refactor does not need to redesign the entire public portfolio model.

## Status projection

Agent Status should make the five Slots the primary current Scheduled Worker surface:

```text
Slot | Generation | State | Repository | Work item | Branch | PR | Progress
```

Historical Sessions/handoffs may remain in a compatibility/history section while migration is in progress, but workers must not use that history as their normal bootstrap path.

A generated dispatch-candidate cache is allowed as a performance optimization, provided it is explicitly disposable and every selected candidate is revalidated before assignment. Correctness must not require the cache to be perfectly current.

## Scheduled worker prompt

All five Scheduled Tasks use the same prompt except `WORKER_SLOT=N`.

The prompt should be short and execution-oriented:

- read own permanent Slot first;
- if assigned, continue exactly that assignment and do not globally select work;
- use current target GitHub state for decisions;
- update Slot snapshot opportunistically as work progresses;
- if idle, run bounded deterministic self-dispatch and acquire one explicit work item;
- never invent work;
- never use Slot comments as execution history;
- before Slot/target mutation, ensure the invocation still belongs to the current Slot generation;
- target CI/repo-guard/branch protection remain integration authority.

## Migration

Migration should be intentionally small:

1. Add `roadmap-worker-slot/v1` parsing/validation and runtime helpers.
2. Create exactly five permanent Slot issues.
3. Add assigned fast-path and idle self-dispatch behavior, with generation fencing and bounded assignment collision handling.
4. Change status projection and Scheduled Worker documentation/prompt to Slot-first operation.
5. Reconcile the currently resumable unfinished work into Slot assignments or return it to executable candidate state using current GitHub facts.
6. Only after the Slot model is operational, remove forward Scheduled Worker dependencies on anonymous Session/handoff/stale-recovery machinery while preserving historical read compatibility.

## Non-goals

- no sixth coordinator worker;
- no persistent dispatcher service;
- no scheduler UUID system;
- no per-repository permanent worker binding;
- no long-lived assignment Claim separate from the Slot;
- no growing Slot comment/checkpoint log;
- no requirement for a final worker checkpoint;
- no metadata-repair ceremony before useful work;
- no new merge authority in roadmap;
- no weakening of target CI/repo-guard/branch protection;
- no cleanup framework for all historical control-plane artifacts.

## Acceptance invariants

The refactor is accepted when all of the following hold:

- exactly five permanent Slot issues exist and validate;
- every Scheduled Task has a stable `WORKER_SLOT=1..5`;
- an assigned invocation can start from its Slot without global work selection;
- multiple consecutive invocations continue the same assignment generation;
- killing an invocation before any final Slot update does not prevent the next invocation from continuing;
- stale Slot snapshots converge naturally during useful work without a repair phase;
- ordinary Slot execution creates no comments;
- a completed assignment leaves a small idle Slot body with no accumulated execution history;
- idle Slots self-dispatch only explicit executable work;
- two idle Slots racing for one candidate produce exactly one assignment owner;
- an old invocation cannot overwrite a newer generation;
- a real long-lived external blocker can release a Slot without losing target-repository work;
- target Issue/Git/PR/CI remain execution truth;
- forward Scheduled Workers no longer need portfolio-wide Session/Claim/handoff recovery on every invocation.
