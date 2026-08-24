# Scheduled workers

This is the timer-driven entrypoint for the public Agent Control Plane.

A Scheduled Task is only a wake-up mechanism:

```text
Scheduled Task != identity
invocation != durable context
Role issue = authority identity
Session issue = execution identity
GitHub = coordination source of truth
```

Every invocation starts as a **fresh anonymous worker**. No per-task parameter, UUID, repository binding, persistent timer identity, or scheduler-owned context participates in correctness.

## Provisioning

Create any number of Scheduled Tasks with the **same prompt**. Concurrency is bounded only by how many tasks may run at once; coordination happens through GitHub Sessions, Claims, Checkpoints, Messages, open-PR reconciliation, leases, and repository-local CI/repo-guard rules.

## Copyable prompt

```text
Access netkeep80/roadmap through GitHub API only and bootstrap strictly through the public Agent Control Plane as a fresh anonymous worker.

Do NOT clone or checkout netkeep80/roadmap for discovery, status, coordination, checkpointing, work selection, or reading control-plane files. Read Issues through GitHub Issues API and control-plane files through GitHub Contents API. Agent Status Issue #103 is convenience presentation only; reconstruct authoritative Role/Session/Checkpoint/Claim/Message state directly from live GitHub Issues.

Reconstruct current Role/Session/Checkpoint/Claim/Message/portfolio state from GitHub.
Select only explicitly executable work permitted by the control plane, then enter the corresponding permanent Role issue.

Treat netkeep80/roadmap itself as a normal managed repository. Roadmap/control-plane maintenance is allowed only through permanent roadmap Role #49, only for a concrete current management trigger or explicit roadmap work item, and uses ordinary Session/Claim collision rules. Only if Role #49 actually selects executable work in netkeep80/roadmap does roadmap become the target repository and may be cloned/checked out.

For any other Role, clone/checkout only the selected target repository when implementation work requires it. Never clone roadmap merely because it is the control plane.

Never invent work.
Never create housekeeping work merely because the worker is idle.
Never duplicate work held by a LIVE winning Session.
Recover STALE_CANDIDATE work only through the documented complete GitHub revalidation protocol.

If no executable work exists, make zero repository changes, create no idle Session, and terminate this run.

When work exists, create a unique Agent Session issue for this execution. After Session creation, refresh the complete competing LIVE Session/Claim set before any target-repository write. Proceed only if this Session is the deterministic winning claimant. If it loses, perform zero target-repository writes, transition the losing Session to terminal state, close it, then bounded-reselect another explicit candidate or exit.

After winning the claim and before any target-repository code write, branch creation, or new PR creation, refresh all open PRs in the selected target repository. If exactly one open PR explicitly implements/closes the same work item, reuse that PR instead of creating another. If multiple open PRs explicitly implement/close the same work item, perform zero target code writes until the duplicate PR state is reconciled to one canonical open PR. A replacement PR must explicitly declare `Supersedes: #N` and the superseded PR must be closed/reconciled; do not leave both open. Shared changed-file overlap alone does not serialize independent work.

Before every repository write or lifecycle transition, refresh exact GitHub state and obey the target repository's actual CI/repo-guard policy.

Before finishing meaningful work, leave a durable Checkpoint. If work is complete or abandoned, clear claims and close the Session issue. Keep a handoff issue open only while it is genuinely resumable; when a successor consumes it, complete/close the predecessor.
```

## Bootstrap and work selection

Before creating a Session, reconstruct current public state without cloning roadmap:

```text
roadmap main via GitHub API
→ AGENTS.md / AGENT_PROTOCOL.md via Contents API
→ data/worker-policy.json via Contents API
→ portfolio/status/execution via Contents + Issues API
→ permanent Roles via Issues API
→ Sessions + validated Checkpoints via Issues API
→ LIVE claims + stale claims pending recovery
→ unresolved Messages
→ candidate local GitHub facts
→ open target PRs before target mutation/integration work
```

Permanent Agent Status Issue #103 may be used as a quick human-oriented dashboard, but workers must not use it as coordination authority or as a substitute for live issue reconstruction.

Selection order is fixed:

```text
1. valid executable handoff
2. actionable incoming Message
3. existing executable open local issue
4. EXIT_NO_WORK
```

Executable local work must be public, portfolio-consistent, executable now, unblocked, not occupied by a LIVE winning Session, and not pending stale-session recovery.

There is no branch that creates work merely because the worker is idle. No speculative backlog generation, unsolicited cleanup/refactoring, idle dependency upgrades, implicit milestones, blocker bypasses, or keep-busy issues are allowed.

## Roadmap management lane

`netkeep80/roadmap` participates in the same pool as every other repository. Management work always enters permanent Role #49.

A roadmap maintenance candidate requires both a concrete current fact and declared authority, for example:

- terminal Session still open;
- resolved Message still open;
- consumed handoff predecessor still open;
- stale Session requiring protocol recovery;
- generated status / validator / portfolio drift against an existing invariant;
- existing roadmap umbrella/acceptance/governance issue whose already-proven evidence needs reconciliation.

Where the maintenance target is itself an open roadmap issue, claim that exact issue. Do not create another meta-issue just to track the cleanup.

```text
roadmap maintenance trigger
→ Role #49
→ Session
→ claim exact roadmap issue
→ refresh competing LIVE claimers
→ one winner may checkout/mutate roadmap as the selected target repository
```

Different roadmap issues may be maintained in parallel. Two workers targeting the same roadmap issue are resolved by the ordinary post-Session collision gate.

No concrete management trigger means no roadmap housekeeping candidate and therefore no reason to checkout roadmap.

## Session identity, lifecycle and collision gate

A Session issue is the durable identity of one execution. The timer invocation itself has no durable identity.

Two anonymous invocations may race and both select the same apparently-unclaimed item before either Session exists. That is acceptable. Correctness begins after Session creation:

```text
create Session + claim
→ refresh all competing LIVE Sessions claiming the same item
→ order by Session GitHub created_at, then issue number
→ winner refreshes open target PRs for the work item
→ winner may mutate target repository only after PR reconciliation
→ loser may not mutate target repository
→ loser clears claim, becomes abandoned, closes issue
→ loser reselects or exits
```

Lifecycle must match GitHub issue state:

```text
starting / working / waiting / blocked => OPEN
handoff                               => OPEN only while genuinely resumable
completed / abandoned                 => CLOSED
resolved Message                      => CLOSED
```

Closed protocol issues remain the historical audit trail and are still validated; they do not remain in the active control surface.

## PR reconciliation gate

Claims coordinate work selection; open PRs are integration/occupancy evidence. They do not replace Claims, but a winning worker must reconcile them before target mutation.

```text
0 open PRs explicitly bound to selected work item
  => new PR may be created when implementation reaches that point

1 open PR explicitly bound to selected work item
  => reuse/resume that PR; do not create a second one

>1 open PRs explicitly bound to selected work item
  => fail closed
  => zero target code writes
  => reconcile/close until one canonical open PR remains
```

A semantic replacement uses an explicit `Supersedes: #N` declaration and closes/reconciles the superseded PR. Agent Status reports a replacement that still leaves the named old PR open.

Changed-file overlap by itself is diagnostic only. Independent or stacked work may legitimately touch a shared public API, generated file, manifest, or other common surface. When different work items overlap semantically and current GitHub evidence is insufficient to prove safe parallelism, the worker must fail closed or coordinate durably rather than invent a repository-wide lock.

## Lease and stale recovery

Machine policy lives in `data/worker-policy.json` and is read through GitHub Contents API during bootstrap.

```text
lease_seconds = 7200
heartbeat_target_seconds = 3600
pr_reconciliation_required = true
```

Authoritative heartbeat:

1. GitHub server `created_at` of the latest valid structured Checkpoint;
2. otherwise Session issue `created_at`.

Session `updated_at` is not heartbeat authority.

Classification:

```text
starting / working / waiting / blocked + age <= lease => LIVE
starting / working / waiting / blocked + age >  lease => STALE_CANDIDATE
handoff                                           => RESUMABLE_HANDOFF
completed / abandoned                             => TERMINAL
```

A stale retained claim is **not free**. Recovery requires complete current-GitHub revalidation of target main, open issues/PRs, current PR head/base, actual CI/repo-guard gates, LIVE winners, Messages, and portfolio/dependency state. Only then may the stale Session be abandoned and, if still executable and unoccupied, replaced by a new Session.

## Integration and privacy boundaries

The pool coordinates only registered public owner repositories. Unknown or non-public repository references fail closed.

Roadmap decides whether work is explicit and unoccupied through API-visible control state. The target repository decides whether a change may integrate. Before every write or lifecycle transition, re-read exact target state and obey its actual CI/repo-guard policy.

## Human operating model

```text
create N identical Scheduled Tasks
        ↓
anonymous invocations read roadmap control plane via GitHub API only
        ↓
select explicit executable target
        ↓
checkout only that target repository when required
        ↓
normal repository work + bounded Role #49 roadmap maintenance
        ↓
Sessions/Claims/Checkpoints + PR reconciliation coordinate concurrency
        ↓
open roadmap state reflects current work, closed issues retain history
```

Production acceptance evidence is tracked in roadmap #62. Numbered scheduler identities are not part of the forward model.
