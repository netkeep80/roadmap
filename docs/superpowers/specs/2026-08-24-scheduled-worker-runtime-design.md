# Scheduled Worker Runtime Design

**Status:** accepted design input, tracked by roadmap #62 and parent #55.

## Goal

Extend the public Agent Control Plane so multiple timer-driven ChatGPT workers can wake independently, reconstruct durable state from GitHub, avoid duplicate work, recover dead workers safely, and terminate without repository writes when no explicit executable work exists.

## Non-negotiable boundary

```text
Timer != Agent identity
Timer != context storage
Timer != scheduler authority
Timer = wake-up mechanism only
```

Correctness remains owned by public GitHub control state:

```text
Role
Session
Checkpoint
Claim
Message
portfolio/status/execution
GitHub live facts
local CI / repo-guard
```

Chat memory is optional convenience only.

## Existing architecture preserved

- one permanent repository-developer Role per public repository;
- Role issue URL remains the canonical repository-role bootstrap identity;
- Session remains a transient execution context;
- Claim remains optimistic work-selection coordination, not a repository lock;
- Message remains durable cross-role coordination;
- local repository owns implementation work;
- repo-guard / local CI owns integration correctness;
- unknown/non-public structured references fail closed.

Scheduled workers add runtime selection/liveness rules; they do not add a second backlog, merge queue, or scheduler authority.

## Worker-pool bootstrap

A scheduled invocation starts from `netkeep80/roadmap`, not from prior chat and not from a permanently assigned repository.

Before creating any Session it must reconstruct:

```text
public portfolio + lifecycle/priority
permanent Roles
live protocol Sessions
validated Checkpoints
claims + deterministic winners
unresolved Messages
local repository exact GitHub state for candidate work
```

A worker creates a Session only after an explicit executable candidate exists. Therefore a no-work run creates no Session merely to record idleness.

Pool-level selection scans eligible public Roles. Once a worker enters a Role/Session it does not opportunistically switch repositories merely because that Role later has no work. A claim-collision loser may release/terminate the losing Session and return to pool selection, or exit.

## Machine worker policy

Canonical machine policy lives in `data/worker-policy.json`:

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

These values are validation inputs, not hints.

## Lease / liveness model

### Authoritative heartbeat

Never trust a timestamp written by an agent inside JSON or prose.

For one Session, `heartbeat_at` is:

1. GitHub server `created_at` of the latest **valid structured Checkpoint comment**;
2. if no valid Checkpoint exists yet, GitHub server `created_at` of the Session issue.

`updated_at` is not a heartbeat because an unrelated issue-body edit could refresh it.

### Classes

```text
completed / abandoned
  => TERMINAL

handoff
  => RESUMABLE_HANDOFF
     not a running executor
     claims MUST be empty

starting / working / waiting / blocked
  + heartbeat age <= lease_seconds
  => LIVE

starting / working / waiting / blocked
  + heartbeat age > lease_seconds
  => STALE_CANDIDATE
```

A new Session should leave an initial Checkpoint immediately. A long-running worker holding execution/claims targets at least one valid Checkpoint every `heartbeat_target_seconds` and at meaningful gate transitions.

### Stale recovery is two-phase

`STALE_CANDIDATE` does not free work automatically.

Phase 1 — revalidate current GitHub facts:

```text
exact target default-branch SHA
open local issues
open PRs
current PR exact head/base if any
actual CI / repo-guard checks
claims / deterministic live winners
Messages
portfolio dependency/lifecycle state
```

Phase 2 — decide:

- if work is completed, superseded, blocked, invalidated, or held by another LIVE winning Session: do not resume;
- otherwise old stale Session is first transitioned to `abandoned` with no claims;
- only after abandonment may a replacement Session claim/resume still-valid work.

This prevents both false duplicate work and permanent locks caused by dead workers.

## Checkpoint history validation

Every structured Checkpoint comment attached to every protocol Session must validate fail-closed, including terminal and historical Sessions.

Generated operational status may project only current live/resumable state, but validation cannot skip malformed terminal history. This is required because stale recovery and future audit depend on durable evidence being structurally trustworthy.

## Bounded autonomy

### Repository-developer work sources

The only sources of new work are finite:

```text
valid handoff
OR actionable incoming Message
OR existing open local issue
   AND portfolio-consistent
   AND executable now
   AND not blocked
   AND not occupied by another LIVE winning Session
   AND not waiting for stale-session recovery
```

Selection order within an eligible Role:

```text
1. valid handoff
2. actionable Message
3. existing executable local issue
4. EXIT_NO_WORK
```

There is no `invent work` transition.

### Hard vetoes

- no speculative backlog generation;
- no unsolicited cleanup/refactoring;
- no dependency upgrades because the worker is idle;
- no architecture redesign without an explicit authorized work item;
- no implicit next milestone;
- no blocker bypass via alternative implementation;
- no issue creation merely to keep a worker busy;
- no reopening completed work without explicit reason/authority;
- no unrelated repository switch after Role entry merely because current Role is idle.

If an unrelated defect is observed during permitted work, branch into it only when it blocks the current authorized work or requires a protocol Message. Otherwise leave it untouched.

### Coordinator is bounded too

`portfolio_authority=coordinate` permits execution of declared portfolio transitions; it does not permit autonomous strategy invention.

Coordinator work requires all of:

```text
observed fact
+ existing declared portfolio goal/invariant/dependency
+ real drift / pending transition / blocker / actionable Message / explicit control-plane work
```

If those triggers are absent, coordinator returns `EXIT_NO_WORK` and makes no strategy change.

## Pure runtime decision layer

`scripts/worker-runtime.mjs` contains no network writes. It provides deterministic classification/decision helpers over already collected validated inputs:

```text
validateWorkerPolicy(policy)
classifySessionLease({ session, checkpoints, now, policy })
selectBoundedWork({ handoffs, messages, issues })
decideStaleRecovery({ leaseStatus, revalidation })
```

The module must never create a candidate. It only filters/selects explicit caller-provided candidates.

### `selectBoundedWork`

Expected result actions:

```text
resume_handoff
process_message
claim_issue
exit_no_work
```

A local issue is admissible only when the caller explicitly supplies current truth flags proving it is open, portfolio-consistent, executable-now, unblocked, not held by a LIVE winner, and not pending stale recovery.

### `decideStaleRecovery`

Expected result actions:

```text
revalidate
abandon_then_replace
abandon_without_resume
```

No `abandon_then_replace` result is possible until a complete revalidation object explicitly says current work remains executable and no LIVE winner occupies it.

## Generated status

`AGENTS_STATUS.md` / `data/agents.json` remain disposable read-only projections. They may expose lease classification for operator visibility, but Scheduled workers must refresh live GitHub before acting because generated status has a `checked_at` time and can become stale.

## Idempotent scheduled prompt

`SCHEDULED_WORKERS.md` publishes a minimal prompt equivalent to:

```text
Open netkeep80/roadmap.
Bootstrap strictly through the Agent Control Plane.
Reconstruct current Role/Session/Claim/Message/portfolio state from GitHub.
Perform only explicitly executable work permitted by the Agent Control Plane.
Never invent work.
Never duplicate work held by a live winning Session.
Recover stale Session only through documented lease/revalidation protocol.
Before every repository write/lifecycle transition refresh exact GitHub state and obey local CI/repo-guard.
If no executable unclaimed work exists, make no repository changes and terminate this run.
Before finishing meaningful work, leave a durable Checkpoint.
```

Target property:

```text
same prompt + same GitHub state => safe idempotent decision
```

Identical chosen work is not required under concurrency; deterministic claim collision handling is required.

## Acceptance matrix

1. LIVE overlap: second worker sees LIVE winner and does not duplicate.
2. Dead worker: STALE_CANDIDATE requires full revalidation before abandonment/replacement.
3. Claim race: earlier Session `created_at`, then lower issue number wins; loser releases and reselects/exits.
4. No work: zero repository writes, zero speculative issues, clean exit.
5. Obvious cleanup without explicit issue: clean exit.
6. Fresh handoff resume: Role URL + GitHub only; no previous chat context.
7. Stale Checkpoint invalidated by current GitHub: current GitHub wins and no stale resume occurs.
8. Coordinator idle: no declared trigger means no strategy mutation and clean exit.

A8 issues #56–#61 and Message #60 are reusable acceptance evidence for collision, cross-role handoff/ACK, independent lane, and Role-URL-only resume. A10 adds lease/no-work/pool semantics on top.

## Production gate

Real Scheduled Tasks must not be treated as production workers until #62 records green evidence for:

```text
lease/stale recovery
bounded-autonomy/no-work
idempotent bootstrap
concurrent acceptance
fresh Role-URL-only resume
```
