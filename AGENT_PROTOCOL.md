# Agent Control Plane protocol v1

This document defines the durable public protocol used by AI agents coordinated through `netkeep80/roadmap`.

The permanent Role bootstrap entrypoint is [`AGENTS.md`](AGENTS.md). Timer-driven worker-pool bootstrap is [`SCHEDULED_WORKERS.md`](SCHEDULED_WORKERS.md). All repository references below are public-only and must resolve to `data/portfolio.json`.

A timer never changes protocol authority:

```text
Timer != Role
Timer != Session
Timer != context storage
Timer != scheduler authority
```

## Machine block format

Agent Issues contain one canonical machine block delimited by these markers:

```markdown
<!-- roadmap-agent:start -->
```json
{
  "protocol": "roadmap-agent-role/v1"
}
```
<!-- roadmap-agent:end -->
```

The JSON between the markers is authoritative for protocol parsing. Prose outside the block explains the contract but must not redefine machine fields.

Malformed JSON, multiple canonical blocks, an unknown protocol version, or a repository reference outside the public portfolio fails closed.

## 1. Permanent Role

Title:

```text
[Agent Role] <repository> developer
```

Canonical object:

```json
{
  "protocol": "roadmap-agent-role/v1",
  "repository": "netkeep80/<repository>",
  "scope": "public-only",
  "state": "active",
  "role_kind": "repository-developer",
  "portfolio_authority": "propose"
}
```

For `netkeep80/roadmap` only, `portfolio_authority` is `coordinate`.

Role invariants:

- exactly one open active Role per live public repository;
- Role issue number is the stable role identity;
- the body links to `AGENTS.md`, `AGENT_PROTOCOL.md`, the target repository, and stable portfolio entrypoints;
- Role body does not embed current PR status, current SHA or other fast-changing snapshots.

## 2. Agent Session

Title:

```text
[Agent Session] <repository> / <session-id>
```

Canonical object:

```json
{
  "protocol": "roadmap-agent-session/v1",
  "role_issue": 123,
  "worker_slot": 3,
  "repository": "netkeep80/<repository>",
  "state": "working",
  "claims": ["netkeep80/<repository>#456"],
  "current_pr": null,
  "blocked_by": []
}
```

`worker_slot` is optional. Manual/non-scheduled Sessions omit it. When a Scheduled Task creates a Session, it records the task's positive integer `WORKER_SLOT` as `worker_slot`.

`worker_slot` is observability metadata only:

```text
worker_slot != Role
worker_slot != Session identity
worker_slot != repository assignment
worker_slot != authority
worker_slot != durable context
worker_slot != lease authority
worker_slot != lock
worker_slot != claim priority
```

The same slot may select a different Role on a later invocation. Two invocations of the same slot may overlap. Slot equality gives no permission to replace a LIVE Session and is deliberately absent from claim-collision ordering.

Finite `state`:

```text
starting
working
waiting
blocked
handoff
completed
abandoned
```

A Session references exactly one Role and exactly the same repository as that Role.

Execution/lifecycle meaning:

```text
starting / working / waiting / blocked
  = leased execution states

handoff
  = resumable durable context
    NOT a running executor
    MUST hold zero claims

completed / abandoned
  = terminal
    MUST hold zero claims
```

`handoff` remains visible to resumption logic, but it is not a live worker merely because the issue remains open.

A scheduled invocation with no explicit executable work MUST NOT create a Session simply to record idleness.

## 3. Claim

A claim is a local public issue or PR reference stored in the Session `claims` array.

Rules:

- claim repository must equal Session repository;
- claims coordinate work selection only; they do not grant merge authority;
- no global repository lock exists;
- before taking work, inspect all relevant Sessions for the Role;
- `handoff`, `completed`, and `abandoned` Sessions cannot retain claims;
- a stale candidate does not automatically release a claim;
- `worker_slot` never changes claim ownership or collision priority.

Collision order for two competing Sessions claiming the same item:

1. smaller GitHub Session issue `created_at` wins;
2. if equal, smaller Session issue number wins.

The loser releases the claim and chooses another **explicit executable** item or exits. It does not invent replacement work.

## 4. Checkpoint

A Checkpoint is a structured Session comment. It uses the same marker format and this object:

```json
{
  "protocol": "roadmap-agent-checkpoint/v1",
  "state": "working",
  "completed": ["short factual gate/result"],
  "refs": ["netkeep80/<public-repository>#123", "commit:<public-sha>"],
  "blockers": [],
  "next": ["exact next executable action"],
  "messages": []
}
```

Checkpoint rules:

- record public observable facts and accepted decisions, not private reasoning;
- include exact public SHA/PR/check evidence where it matters to resumption;
- a handoff Session requires a final checkpoint sufficient for a fresh agent starting from Role URL only;
- every fresh agent revalidates the checkpoint against current GitHub state before mutation;
- **every structured marked Checkpoint comment on every protocol Session validates fail-closed, including terminal/historical Sessions**;
- generated status may omit terminal history, but validation cannot skip malformed history.

For liveness, the authoritative Checkpoint timestamp is GitHub server `created_at`. A timestamp written by an agent inside prose or the structured JSON is not a heartbeat authority.

## 5. Session lease / liveness

Machine policy is `data/worker-policy.json`.

Initial policy:

```text
lease_seconds = 7200
heartbeat_target_seconds = 3600
```

Authoritative `heartbeat_at` for a leased Session is:

1. GitHub server `created_at` of the latest valid structured Checkpoint comment;
2. if no valid Checkpoint exists yet, GitHub server `created_at` of the Session issue.

Do not use Session `updated_at` as heartbeat because unrelated issue-body edits can refresh it. `worker_slot` also has no liveness authority.

Classification:

```text
completed / abandoned
  => TERMINAL

handoff
  => RESUMABLE_HANDOFF

starting / working / waiting / blocked
  + heartbeat age <= lease_seconds
  => LIVE

starting / working / waiting / blocked
  + heartbeat age > lease_seconds
  => STALE_CANDIDATE
```

A worker holding active execution/claims should leave an initial valid Checkpoint immediately after Session creation and refresh durable Checkpoint evidence at meaningful lifecycle gates. Long-running work targets at least one valid Checkpoint per `heartbeat_target_seconds`.

`STALE_CANDIDATE` is only a recovery signal. It never means “claim is free” and never authorizes immediate resume.

### Two-phase stale recovery

Before changing a stale Session or taking its work, a replacement worker MUST re-read current GitHub:

```text
target default-branch exact SHA
open local issues
open PRs
current PR exact head/base if any
actual CI / repo-guard gates
claims + deterministic live winners
Messages
portfolio/dependency/lifecycle state
```

Then:

```text
if work is completed / superseded / blocked / invalidated / held by LIVE winner:
    old stale Session -> abandoned with zero claims
    do not resume

if work remains executable and has no LIVE winner:
    old stale Session -> abandoned with zero claims
    only then create replacement Session / claim
    resume from current GitHub facts
```

A stale Checkpoint's `next` field never overrides current GitHub facts. A matching `worker_slot` never bypasses this revalidation.

## 6. Agent Message

Title:

```text
[Agent Message] #<source-role> -> #<target-role>: <subject>
```

Canonical object:

```json
{
  "protocol": "roadmap-agent-message/v1",
  "from_role_issue": 123,
  "to_role_issues": [456],
  "kind": "dependency-ready",
  "requires_ack": true,
  "state": "open",
  "refs": ["netkeep80/<public-repository>#789"]
}
```

Finite `kind`:

```text
info
request
blocker
dependency-ready
dependency-broken
handoff
decision-required
coordination
```

Finite `state`:

```text
open
acknowledged
resolved
```

Message rules:

- every source and target Role must exist and be active;
- every repository reference must be public and registered;
- `requires_ack: true` remains observable until target acknowledgement;
- local code/design discussion stays in the local repository; use a roadmap Message only for durable cross-repository coordination or portfolio-level action.

## 7. Bounded work selection

The Agent Control Plane has no implicit `invent work` transition.

For a repository-developer Role, the only admissible work sources are:

```text
valid handoff
OR actionable incoming Message
OR existing open local issue
   AND portfolio-consistent
   AND executable now
   AND not blocked
   AND not occupied by another LIVE winning Session
   AND not pending stale-session recovery
```

Selection order:

```text
1. valid handoff
2. actionable incoming Message
3. existing executable local issue
4. EXIT_NO_WORK
```

Canonical invariant:

```text
absence of work != permission to invent work
NO EXPLICIT EXECUTABLE WORK => EXIT
```

No speculative backlog generation, unsolicited cleanup, idle dependency upgrade, architecture redesign, implicit next milestone, blocker bypass, or keep-busy issue creation is permitted.

Pool workers dynamically choose a Role before Session creation. A `worker_slot` does not reserve or prefer any repository. Once an invocation enters a Role/Session, it does not switch repositories merely to stay busy; a claim-collision loser may release/terminate the losing Session and return to pool selection or exit.

`roadmap` coordinator authority is bounded the same way. `portfolio_authority=coordinate` permits action only when an observed fact combines with an existing declared portfolio goal/invariant/dependency and a real drift, pending transition, blocker, actionable Message, or explicit control-plane work item. Otherwise coordinator exits without strategy mutation.

## 8. Refresh points

An agent must refresh its relevant GitHub facts:

- at invocation/bootstrap;
- at Session start;
- before selecting/claiming next work;
- after receiving a dependency/blocker message;
- before stale recovery;
- before repository write;
- before PR draft/ready/integration lifecycle transition;
- after merging or closing a dependency gate;
- before handoff/completion checkpoint.

For PR integration, exact repository rules and repo-guard `next_action` (where configured) dominate stale Session state.

## 9. Public-only reference grammar

Structured protocol fields may reference:

```text
netkeep80/<registered-public-repository>
netkeep80/<registered-public-repository>#<issue-or-pr-number>
commit:<sha> only when the surrounding object unambiguously identifies a registered public repository
roadmap role issue numbers
```

They must not contain or encode a repository outside the public registry.

## 10. Visibility transition

When a repository leaves public scope:

1. current public sync/validation reports scope drift;
2. an explicit portfolio transition removes it from active public coordination;
3. its Role is closed/inactivated;
4. active Sessions are stopped as `abandoned` or otherwise terminated without importing new non-public facts;
5. generated active state no longer includes the repository;
6. no future Agent Message may reference the non-public source.

Previously public Git/GitHub history is historical public information; the control plane cannot retroactively erase it, but must not continue updating it from a non-public source.

## 11. Authority / non-goals

The protocol does not:

- choose portfolio priority or canonical ownership automatically;
- bind a Scheduled Task slot to a repository;
- grant authority from `worker_slot` identity;
- create work merely because a timer fired or a worker is idle;
- replace local repository issues/PRs;
- replace repo-guard or local CI;
- introduce a second merge queue;
- introduce a global or per-slot repository lock;
- coordinate private repositories;
- store hidden chain-of-thought.
