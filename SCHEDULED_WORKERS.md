# Scheduled workers

Scheduled Workers use exactly five persistent Worker Slots. Each Scheduled Task is permanently configured with one `WORKER_SLOT=1..5`; the Slot issue owns the current assignment across invocations.

```text
WORKER_SLOT=1 -> roadmap#385
WORKER_SLOT=2 -> roadmap#386
WORKER_SLOT=3 -> roadmap#387
WORKER_SLOT=4 -> roadmap#388
WORKER_SLOT=5 -> roadmap#389
```

A timer invocation is transient. The permanent Worker Slot issue is durable assignment state.

```text
Slot assignment = durable ownership
Slot snapshot   = best-effort operational memory and may be stale
Target Issue    = requirements authority
Target branch   = unfinished implementation authority
Target PR       = integration state
Target CI/repo-guard/branch protection = verification and merge authority
```

Normal Slot execution creates no Slot comments. The Slot body is replaced in place as useful work progresses, so worker bootstrap never has to read a growing execution log.

## Fast path: assigned Slot

An assigned Slot MUST NOT globally select or rank unrelated work.

```text
read own permanent Worker Slot
-> capture slot + generation
-> read assigned target Issue
-> inspect current branch / PR / CI facts needed for useful work
-> continue exactly that assignment
-> update the Slot snapshot opportunistically after meaningful transitions
```

The snapshot is a cache, not execution truth. `progress.next_action` is only a hint. If the previous invocation died before updating Slot state, do not stop to repair or synchronize Slot metadata. Use current target GitHub state, continue useful work, and naturally write fresher Slot information during the next ordinary Slot update.

Before every Slot write and before target mutation, re-read the permanent Slot and confirm both `WORKER_SLOT` and the captured `generation`. A delayed invocation whose generation is no longer current exits without Slot or target writes.

Validate the complete candidate Slot snapshot before every Slot write. Do not persist a candidate that does not satisfy the canonical `roadmap-worker-slot/v1` shape. In particular, `current_pr` must be `null` or a canonical `netkeep80/<repo>#<number>` string, never a bare integer. Validation failure means zero Slot writes; keep using target GitHub state and fix the candidate snapshot instead of publishing malformed coordination state.

When assigned work is already complete, clear the Slot to `idle`. If useful execution time remains, the same invocation may immediately enter idle self-dispatch.

## Cold path: idle self-dispatch

Only an idle Slot performs global work selection. There is no dedicated dispatcher worker.

Idle self-dispatch reuses the deterministic normalized selector as an algorithm, not as free-form LLM priority reasoning:

1. explicit declared priority (`P0` before `P1` before `P2` and so on);
2. explicit local/dependency order when declared;
3. continuation before genuinely new work only within the same effective rank;
4. repository lexical order;
5. issue number.

Source type is not priority. Messages may change executability or dependency state but do not form a separate priority lane.

The idle Slot skips work already assigned to another Slot or currently covered by a pending assignment acquisition. It chooses only an explicit executable candidate. It never invents work, housekeeping, refactoring, milestones, dependency upgrades, or keep-busy tasks merely because it is idle.

If no executable candidate exists, the Slot remains idle and the invocation exits with zero target-repository changes.

Two idle Slots may race for the same candidate. Cross-Slot arbitration exists only for this `idle -> assigned` acquisition. Create a short assignment-acquisition record, refresh competing acquisition records for the exact same work item, and let the earliest GitHub `created_at` win (issue number is the deterministic tie-breaker). The loser performs zero target writes and tries the next bounded candidate or exits. Once the assignment is stored in a permanent Slot, ordinary future invocations do not repeat global Claim/Session arbitration.

`generation` increments exactly once when a new assignment is acquired. Ordinary invocations and progress updates do not increment it.

## Waiting and blockers

Keep an assignment in its Slot for short waits that are part of the same active implementation, such as CI running, review, or a temporarily non-mergeable PR. CI/review waits do not count as external infrastructure blocker runs.

An external infrastructure blocker is a condition outside the target work that prevents every safe useful target step for this invocation, for example target checkout/DNS failure or an unavailable external service. On the first infrastructure-only run with zero meaningful target progress, keep the assignment and record a bounded hint in `progress`: `external_blocker` plus `external_blocker_runs: 1`.

On the second consecutive run with the same external infrastructure blocker and again no safe target progress, release the Slot to `idle`. Do not create a handoff: the target Issue/branch/PR already preserve execution truth. A changed blocker starts again at `external_blocker_runs: 1`; any meaningful target progress clears the blocker counter.

A blocker that is already known to be genuinely long-lived, such as a required human decision, unavailable required evidence, or dependency work that this Slot cannot currently advance, may release the Slot immediately. When the blocker later clears, the work can return to the normal executable candidate set.

## Copyable Scheduled Task prompt

Use the same prompt for all five tasks except the first line.

```text
WORKER_SLOT=N

Open netkeep80/roadmap through the GitHub API only.
Read permanent Worker Slot N first: Slot 1=#385, Slot 2=#386, Slot 3=#387, Slot 4=#388, Slot 5=#389.
Do NOT clone or checkout netkeep80/roadmap merely for coordination.

If the Slot is assigned, continue exactly that assignment. Do not globally select work, inspect unrelated Slots, or reconsider portfolio priority while the assignment remains executable.
Use the target Issue, branch, PR, CI, repo-guard and branch-protection state as current execution truth. Slot progress/current_branch/current_pr are best-effort hints and may be stale. There is no Slot repair phase: continue useful work from current target GitHub state and update the Slot body naturally after meaningful work transitions.

Before every Slot write or target-repository mutation, re-read the permanent Slot and confirm WORKER_SLOT and generation still match this invocation. If generation changed, make zero further Slot or target writes and exit.
Before every Slot write, validate the complete candidate snapshot against canonical roadmap-worker-slot/v1. Never publish malformed Slot state. current_pr is null or a full string netkeep80/<repo>#<number>, never a bare number.

If no safe target progress is possible solely because of an external infrastructure blocker, the first such run keeps the assignment and records progress.external_blocker plus external_blocker_runs=1. On the second consecutive run with the same blocker and again zero safe target progress, release the Slot to idle without a handoff. Meaningful target progress or a changed blocker resets this count. CI running, review, and temporary non-mergeability do not count as infrastructure blocker runs.

If assigned work is complete, clear the Slot to idle. If the Slot is idle, run bounded deterministic self-dispatch: select only explicit executable work using declared priority P0 before P1 before P2 and so on, then declared local/dependency order, continuation within the same rank, repository lexical order, and issue number. Skip work already assigned to another Slot or covered by a pending assignment acquisition. Never invent work.

Resolve a real concurrent idle->assigned race only through the short assignment-acquisition gate. After winning, persist the new assignment with generation+1 and immediately execute it. Ordinary assigned runs do not create transient Session/Claim/Handoff state.

Normal Slot execution creates no Slot comments. Replace the Slot issue body in place with a concise current snapshot only.
Obey the target repository's actual CI/repo-guard/branch-protection rules before integration. Roadmap Slot ownership never grants merge authority.
```

## Historical compatibility

Historical Agent Sessions, Checkpoints, Claims and Handoffs remain readable evidence. They are not part of the forward Scheduled Worker hot path.

For historical Session compatibility only, the old branch reconciliation invariant remains readable: `No open PR != dead branch`; Session flows persisted `current_branch` before branch create/push. Historical Session rule: if meaningful work continues for longer than `heartbeat_target_seconds`, refresh a structured Checkpoint. These are historical Session rules, not requirements for ordinary Slot resume.

Assigned Scheduled Workers do not reconstruct portfolio-wide Session leases, stale candidates, handoffs, or Claim winners. Historical data is consulted only when an idle self-dispatch candidate specifically depends on unfinished historical state during migration or forensic inspection.

The forward operating model is therefore:

```text
scheduled wake
-> read own Slot
   -> assigned: cheap resume
   -> idle: bounded deterministic self-dispatch
-> target repository implementation
-> validate candidate Slot snapshot
-> concise Slot snapshot update
-> exit
```
