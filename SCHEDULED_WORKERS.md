# Scheduled workers

This document defines the **timer-driven worker pool** entrypoint for the public Agent Control Plane.

A scheduled task is only a wake-up mechanism:

```text
Timer != Agent identity
Timer != context storage
Timer != scheduler authority
Timer = wake-up mechanism only
```

Every invocation may be a fresh worker with no useful conversational history. GitHub is the durable source of coordination truth.

## Minimal worker prompt

A Scheduled Task may use this prompt verbatim:

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

The prompt intentionally does not assign a repository. The worker slot is not a repository identity.

## Bootstrap algorithm

A pool invocation MUST reconstruct current public state from GitHub before creating a Session:

```text
roadmap main
→ AGENTS.md / AGENT_PROTOCOL.md
→ data/worker-policy.json
→ portfolio/status/execution
→ permanent Roles
→ protocol Sessions + validated Checkpoints
→ claims + deterministic winners
→ unresolved Messages
→ candidate local GitHub facts
```

Then:

```text
1. find valid executable handoff
2. else find actionable Message
3. else find existing executable open local issue
4. else EXIT with zero repository writes
```

A worker MUST NOT create a Session simply to record that it found no work.

Dynamic repository/Role selection happens before Role entry. Once a worker has entered one Role/Session it MUST NOT switch to another repository merely because the current Role becomes idle. A claim-collision loser releases/terminates the losing Session and may return to pool selection or exit.

## What counts as executable work

For a repository-developer Role:

```text
EXECUTABLE WORK =
    valid handoff
  ∪ actionable incoming Message
  ∪ existing open local issue
      AND portfolio-consistent
      AND executable now
      AND not blocked
      AND not occupied by another LIVE winning Session
      AND not pending stale-session recovery
```

There is no `invent work` branch.

Hard vetoes:

- no speculative backlog generation;
- no unsolicited cleanup or unrelated refactoring;
- no dependency upgrade merely because the worker is idle;
- no architecture redesign without explicit authority/work item;
- no implicit next milestone;
- no switching repositories after Role entry merely to stay busy;
- no bypassing blockers through an alternative implementation;
- no issue creation purely to keep a worker occupied;
- no reopening completed scope without explicit reason/authority.

If a side problem is discovered during authorized work:

```text
if it blocks current work:
    record blocker / Message as the protocol permits
    stop or wait

if it does not block current work:
    do not branch into new work
```

## Lease and liveness

Policy values are machine-readable in `data/worker-policy.json`.

Initial accepted policy:

```text
lease_seconds = 7200
heartbeat_target_seconds = 3600
```

The authoritative heartbeat is never a timestamp written by the agent inside prose or JSON. It is:

1. GitHub server `created_at` of the latest **valid structured Checkpoint comment**;
2. before the first Checkpoint exists, GitHub server `created_at` of the Session issue.

Do not use Session `updated_at` as heartbeat: unrelated issue-body changes can refresh it.

Classification:

```text
completed / abandoned
  => TERMINAL

handoff
  => RESUMABLE_HANDOFF
     not a running executor
     claims must be empty

starting / working / waiting / blocked
  + heartbeat age <= lease
  => LIVE

starting / working / waiting / blocked
  + heartbeat age > lease
  => STALE_CANDIDATE
```

A worker holding active execution/claims SHOULD leave an initial Checkpoint immediately after Session creation and SHOULD refresh durable Checkpoint evidence at meaningful lifecycle gates. For long continuous work, target at least one valid Checkpoint per `heartbeat_target_seconds`.

## Stale recovery

`STALE_CANDIDATE` does **not** mean the claim is free and does **not** authorize immediate resume.

Required flow:

```text
find stale Session
→ inspect last valid Checkpoint
→ refresh target exact main
→ refresh open issues
→ refresh open PRs
→ refresh current PR exact head/base if any
→ refresh actual CI / repo-guard gates
→ refresh claims + deterministic winners
→ refresh Messages
→ refresh portfolio/dependency state
→ decide whether work is still executable
```

Only after complete revalidation:

```text
if completed / superseded / blocked / invalidated / held by LIVE winner:
    old Session -> abandoned with zero claims
    do not resume

if still executable and not held by LIVE winner:
    old Session -> abandoned with zero claims
    create replacement Session
    claim/resume using current GitHub facts
```

Never continue from stale assumptions merely because an old Checkpoint says `next`.

## Claim collisions and overlap

Scheduled tasks are not assumed to serialize.

Example:

```text
12:00 worker A starts
12:40 A still runs
13:00 worker B starts
```

B reconstructs live Sessions and claims. If A is LIVE and wins the relevant claim, B does not duplicate A's work; it selects another explicit candidate or exits.

If two Sessions race for the same claim, existing deterministic ordering remains authoritative:

```text
earlier Session GitHub created_at wins
then lower Session issue number
```

The loser releases the claim and selects another explicit candidate or exits. There is no global repository lock.

## Coordinator worker is bounded too

The `roadmap` Role has `portfolio_authority=coordinate`, but `coordinate != invent strategy`.

Coordinator work requires:

```text
observed fact
+
existing declared portfolio goal/invariant/dependency
+
real drift / pending transition / blocker / actionable Message / explicit control-plane work
```

With no such trigger, the coordinator exits and makes no strategy changes.

## Public-only boundary

The scheduled worker pool is part of the same public-only control plane:

```text
scope = public-owner-repositories
```

Do not query, serialize, mention, infer, or coordinate non-public repositories through this public system. Structured unknown/non-public repository references fail closed.

## Integration boundary

Roadmap decides what work is allowed and occupied. It does not decide whether a code change is safe to integrate.

Before every repository write or lifecycle transition, the worker re-reads exact target state and obeys the target repository's current CI/repo-guard policy. PR integration remains local-repository responsibility.

## Production gate

Real Scheduled Tasks are production-ready only after roadmap #62 demonstrates:

```text
lease/stale recovery
+
bounded autonomy / no-work exit
+
idempotent bootstrap
+
concurrent-worker acceptance
+
fresh Role-URL-only resume
```

Until then, the worker policy and tests are control-plane preparation, not permission to run unattended production workers.
