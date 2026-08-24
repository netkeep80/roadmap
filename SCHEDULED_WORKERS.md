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

Create any number of Scheduled Tasks with the **same prompt**. Concurrency is bounded only by how many tasks may run at once; coordination happens through GitHub Sessions, Claims, Checkpoints, Messages, leases, and repository-local CI/repo-guard rules.

## Copyable prompt

```text
Open netkeep80/roadmap.
Bootstrap strictly through the public Agent Control Plane as a fresh anonymous worker.

Reconstruct current Role/Session/Checkpoint/Claim/Message/portfolio state from GitHub.
Select only explicitly executable work permitted by the control plane, then enter the corresponding permanent Role issue.

Never invent work.
Never duplicate work held by a LIVE winning Session.
Recover STALE_CANDIDATE work only through the documented complete GitHub revalidation protocol.

If no executable work exists, make zero repository changes, create no idle Session, and terminate this run.

When work exists, create a unique Agent Session issue for this execution. After Session creation, refresh the complete competing LIVE Session/Claim set before any target-repository write. Proceed only if this Session is the deterministic winning claimant. If it loses, perform zero target-repository writes, release/terminate the losing Session, then bounded-reselect another explicit candidate or exit.

Before every repository write or lifecycle transition, refresh exact GitHub state and obey the target repository's actual CI/repo-guard policy.

Before finishing meaningful work, leave a durable Checkpoint sufficient for a fresh future invocation to revalidate and resume from GitHub only.
```

## Bootstrap and work selection

Before creating a Session, reconstruct current public state:

```text
roadmap main
→ AGENTS.md / AGENT_PROTOCOL.md
→ data/worker-policy.json
→ portfolio/status/execution
→ permanent Roles
→ Sessions + validated Checkpoints
→ LIVE claims + stale claims pending recovery
→ unresolved Messages
→ candidate local GitHub facts
```

Selection order is fixed:

```text
1. valid executable handoff
2. actionable incoming Message
3. existing executable open local issue
4. EXIT_NO_WORK
```

Executable local work must be public, portfolio-consistent, executable now, unblocked, not occupied by a LIVE winning Session, and not pending stale-session recovery.

There is no branch that creates work merely because the worker is idle. No speculative backlog generation, unsolicited cleanup/refactoring, idle dependency upgrades, implicit milestones, blocker bypasses, or keep-busy issues are allowed.

## Session identity and collision gate

A Session issue is the durable identity of one execution. The timer invocation itself has no durable identity.

Two anonymous invocations may race and both select the same apparently-unclaimed item before either Session exists. That is acceptable. Correctness begins after Session creation:

```text
create Session + claim
→ refresh all competing LIVE Sessions claiming the same item
→ order by Session GitHub created_at, then issue number
→ winner may mutate target repository
→ loser may not mutate target repository
→ loser releases/terminates and reselects or exits
```

This is an optimistic claim protocol, not a global lock. Distinct Sessions may work concurrently on distinct explicit work.

## Lease and stale recovery

Machine policy lives in `data/worker-policy.json`.

```text
lease_seconds = 7200
heartbeat_target_seconds = 3600
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

Roadmap decides whether work is explicit and unoccupied. The target repository decides whether a change may integrate. Before every write or lifecycle transition, re-read exact target state and obey its actual CI/repo-guard policy.

## Human operating model

```text
create N identical Scheduled Tasks
        ↓
anonymous invocations consume explicit GitHub work
        ↓
Sessions/Claims/Checkpoints coordinate concurrency
        ↓
roadmap shows LIVE / STALE_CANDIDATE / handoff / blockers
```

Production acceptance evidence is tracked in roadmap #62. Numbered scheduler identities are not part of the forward model.
