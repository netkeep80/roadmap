# Agent bootstrap — one URL protocol

`netkeep80/roadmap` is the public Agent Control Plane for the public repositories owned by `netkeep80`.

## Bootstrap contract

A compatible AI agent may be given only one URL:

```text
https://github.com/netkeep80/roadmap/issues/<role-issue>
```

That permanent issue identifies exactly one public repository-developer Role. No pasted chat checkpoint, separate role name, scheduler identity, or hidden repository list is required.

Before repository mutation:

1. Read the complete Role issue through GitHub Issues API and parse its `roadmap-agent-role/v1` block.
2. Confirm public scope and repository identity.
3. Read current `roadmap` main control-plane inputs through GitHub Contents API: `OPERATING_MODEL.md`, `data/portfolio.json`, `data/status.json`, `EXECUTION.md`, and worker policy as needed.
4. Treat Agent Status Issue #103 only as a human-readable convenience projection; reconstruct authoritative Role / Session / Checkpoint / Claim / Message state directly from GitHub Issues.
5. Confirm the Role repository is still in current public-owner scope and the central registry.
6. Inspect current Sessions, Checkpoints, claims, Messages, liveness, and resumable handoffs.
7. Read the target repository's current default-branch SHA, open issues/PRs, workflows, repo-policy/repo-guard, and actual blocking checks.
8. Resume a valid handoff or select the next explicit executable unclaimed local issue.
9. Create or continue one Session.
10. After creating a claiming Session, refresh all competing LIVE claimers before any target-repository write.
11. Before every repository write or lifecycle transition, refresh relevant GitHub source-of-truth state.
12. Send a durable Message only for real cross-repository coordination.
13. Finish with a durable Checkpoint and correct Session lifecycle transition.

The structured protocols are defined in [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md). Timer-driven anonymous pool bootstrap is in [`SCHEDULED_WORKERS.md`](SCHEDULED_WORKERS.md).

## API-only control-plane access

For an ordinary worker, `netkeep80/roadmap` is a remote control plane, **not a repository that must be cloned for bootstrap**.

```text
Role / Session / Checkpoint / Claim / Message
        ↓
GitHub Issues API

portfolio intent / worker policy / control-plane docs
        ↓
GitHub Contents API

selected executable repository
        ↓
checkout / clone only when implementation work requires it
```

Hard invariant:

```text
DO NOT clone or checkout netkeep80/roadmap
for discovery, status, coordination, checkpointing, or work selection.
```

The only exception is real executable work owned by permanent roadmap developer Role #49. Once Role #49 selects an issue in `netkeep80/roadmap`, roadmap itself is the target repository and may be checked out exactly like any other target.

The permanent [Agent Status Issue #103](https://github.com/netkeep80/roadmap/issues/103) is disposable presentation only. It is never claim, lease, collision, lifecycle, or merge authority.

## Hard bounded-autonomy rule

```text
absence of work != permission to invent work

NO EXPLICIT EXECUTABLE WORK
=> NO WORK
=> EXIT
```

Repository-developer agents may start work only from a valid handoff, an actionable incoming Message, or an existing open local issue that is portfolio-consistent, executable, unblocked, not held by a LIVE winning Session, and not pending stale recovery.

Do not generate speculative backlog, cleanup work, unrelated refactors, dependency upgrades, architecture redesigns, new milestones, or issues merely to remain busy.

A scheduled worker starts anonymous, reconstructs GitHub state, then enters the selected permanent Role. An idle invocation creates no Session. A collision loser performs zero target-repository writes, clears its claim, becomes terminal, closes its Session issue, and may bounded-reselect or exit.

## Roadmap management is also role-bound

`netkeep80/roadmap` is itself a managed repository. Control-plane and portfolio maintenance is performed only under permanent **roadmap developer Role #49**.

Valid maintenance requires:

```text
concrete current roadmap/control-plane fact
+
existing declared invariant / goal / open roadmap issue / actionable Message
+
executable bounded action
```

Examples include terminal Sessions still open, resolved Messages still open, consumed handoffs still open, stale Sessions requiring protocol recovery, generated-status/portfolio drift against a declared invariant, or existing roadmap acceptance/governance issues whose already-proven evidence needs reconciliation.

Where the maintenance target is itself an open roadmap issue, claim that issue directly. Do not create a second housekeeping issue just to track the repair.

Roadmap maintenance uses ordinary Session/Claim collision ordering. Different roadmap issues can be maintained concurrently; the same issue has one LIVE winning claimant. `portfolio_authority=coordinate` does not permit speculative strategy invention.

No concrete trigger means no roadmap housekeeping work.

## Issue lifecycle keeps active state small

The open issue set is the current control surface; closed issues are the historical audit trail.

```text
Role active                              => OPEN
Session starting/working/waiting/blocked => OPEN
Session handoff                          => OPEN only while resumable
Session completed/abandoned              => CLOSED
Message open/acknowledged                => OPEN while unresolved
Message resolved                         => CLOSED
```

When a successor consumes a handoff, complete/close the predecessor. One-shot acceptance observations finish terminal instead of accumulating as handoffs.

Closed historical Sessions and their Checkpoints remain fail-closed auditable, but do not stay in generated active state.

## Public-only privacy firewall

This control plane is intentionally blind to non-public repositories. Do not write any non-public repository name, URL, issue/PR, SHA, lifecycle, role, dependency, blocker, or indirect identifier into Role/Session/Message/generated state.

Every structured repository reference must resolve to the current public `data/portfolio.json` registry. Unknown or non-public references fail closed.

## Authority boundaries

```text
roadmap
  owns portfolio direction, ownership map, priorities, cross-repo gates,
  Role identity and public coordination

local repository
  owns implementation backlog, code-level design, tests and releases

repo-guard / local CI
  owns integration correctness where configured

GitHub live state
  owns observed facts
```

An agent may propose a portfolio transition, but must not infer a new priority, canonical owner, lifecycle, or dependency direction merely because an issue closed or a PR merged.

## Work selection and claims

A claim prevents duplicate effort on one local issue/PR; it never locks an entire repository and never grants merge authority.

Two fresh workers may select the same apparently-unclaimed candidate before either Session exists. After Session creation, each contender refreshes the complete LIVE claimant set.

Winner order:

1. earlier Session issue `created_at`;
2. if equal, lower Session issue number.

A handoff is resumable context, not a running executor, and has zero claims. A stale Session does not automatically release a claim; stale recovery requires full current-GitHub revalidation first.

## Context discipline

Durable context stores only facts and decisions needed for safe resumption: completed gates, accepted decisions, public refs, exact CI/repo-guard evidence where relevant, blockers, next executable action, and coordination references. Never store private chain-of-thought.

## Integration discipline

Agent Control Plane coordination does not weaken repository gates. Follow the target repository's actual CI/repo-guard lifecycle; never claim protection or checks that do not exist.
