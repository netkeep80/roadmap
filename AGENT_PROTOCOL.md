# Agent Control Plane protocol v1

This document defines the durable public coordination protocol used by agents in `netkeep80/roadmap`.

Entrypoints:

- [`AGENTS.md`](AGENTS.md) — permanent Role URL bootstrap;
- [`SCHEDULED_WORKERS.md`](SCHEDULED_WORKERS.md) — anonymous timer-driven pool bootstrap.

All structured repository references are public-only and must resolve through `data/portfolio.json`.

## Machine block format

Agent Issues and Checkpoints contain one canonical block:

```markdown
<!-- roadmap-agent:start -->
```json
{
  "protocol": "roadmap-agent-role/v1"
}
```
<!-- roadmap-agent:end -->
```

Malformed JSON, multiple canonical blocks, unknown protocol versions, or out-of-scope repository references fail closed.

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

For `netkeep80/roadmap`, `portfolio_authority` is `coordinate`.

Invariants:

- exactly one open active Role per registered public repository;
- Role issue number is stable authority identity;
- Role metadata is durable and does not embed current PR/SHA snapshots.

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
  "repository": "netkeep80/<repository>",
  "state": "working",
  "claims": ["netkeep80/<repository>#456"],
  "current_pr": null,
  "blocked_by": []
}
```

A Session references exactly one Role and the same repository as that Role. The Session issue number is the durable identity of one execution.

Historical public v1 Sessions may contain previously accepted scheduler metadata. Validation keeps read tolerance only; new Sessions, runtime decisions, generated status, and acceptance criteria do not use scheduler identity.

Finite states:

```text
starting
working
waiting
blocked
handoff
completed
abandoned
```

Lifecycle meaning:

```text
starting / working / waiting / blocked = leased execution
handoff                               = resumable context, zero claims
completed / abandoned                 = terminal, zero claims
```

No-work invocations create no Session.

## 3. Claim

A Claim is a local public issue or PR reference stored in a Session `claims` array.

Rules:

- Claim repository must equal Session repository;
- Claims coordinate work selection only; they do not grant merge authority;
- `handoff`, `completed`, and `abandoned` Sessions retain zero claims;
- a stale retained claim is not automatically free;
- there is no global repository lock.

Collision order for LIVE Sessions claiming the same item:

1. earlier GitHub Session issue `created_at`;
2. if equal, lower Session issue number.

A worker may optimistically create a Session after selecting apparently-unclaimed work. **After Session creation and before any target-repository write**, it must refresh all competing LIVE Sessions/Claims for that item and apply the collision order.

```text
winner => target writes allowed
loser  => zero target writes; release/terminate; bounded-reselect or exit
```

## 4. Checkpoint

A Checkpoint is a structured Session comment:

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

Rules:

- store public observable facts and accepted decisions, not private reasoning;
- include exact public SHA/PR/check evidence when needed for safe resumption;
- every fresh worker revalidates Checkpoint facts against current GitHub before mutation;
- every marked Checkpoint on every protocol Session validates fail-closed, including historical/terminal Sessions;
- `handoff` requires durable context sufficient for a fresh worker to resume from GitHub only.

## 5. Session lease / liveness

Machine policy is `data/worker-policy.json`.

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

`STALE_CANDIDATE` is only a recovery signal. It never means a claim is free.

### Stale recovery

Before changing a stale Session or taking its work, revalidate current GitHub completely:

```text
target exact default-branch SHA
open local issues and PRs
current PR exact head/base if any
actual CI / repo-guard gates
LIVE claims + deterministic winners
Messages
portfolio/dependency/lifecycle state
```

Then:

```text
completed / superseded / blocked / invalidated / held by LIVE winner
  => old stale Session -> abandoned, zero claims, no resume

still executable and no LIVE winner
  => old stale Session -> abandoned, zero claims
  => create new Session from current GitHub facts
```

A stale Checkpoint never overrides fresher GitHub state.

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

Kinds:

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

States:

```text
open
acknowledged
resolved
```

Use Messages only for durable cross-repository coordination, dependency readiness, blockers, or required actions. Repository-local discussion remains local.

## 7. Bounded work selection

The control plane has no implicit `invent work` transition.

Admissible sources:

```text
valid executable handoff
OR actionable incoming Message
OR existing open local issue
   AND portfolio-consistent
   AND executable now
   AND not blocked
   AND not occupied by a LIVE winning Session
   AND not pending stale-session recovery
```

Selection order:

```text
1. handoff
2. Message
3. local issue
4. EXIT_NO_WORK
```

No speculative backlog generation, unsolicited cleanup/refactoring, idle dependency upgrades, architecture redesign, implicit next milestone, blocker bypass, or keep-busy issue creation is permitted.

The `roadmap` coordinator is bounded by the same rule: `coordinate` permits declared transitions triggered by real drift, blockers, Messages, or explicit control-plane work; it does not permit autonomous strategy invention.

## 8. Refresh points

Refresh relevant GitHub facts:

- at invocation/bootstrap;
- before work selection;
- at Session creation;
- **after Session creation before any target-repository write**;
- after dependency/blocker changes;
- before stale recovery;
- before every repository write;
- before PR draft/ready/integration transitions;
- after merge/close transitions;
- before handoff/completion.

Target repository CI/repo-guard rules remain integration authority.

## 9. Public-only reference grammar

Structured fields may reference only:

```text
netkeep80/<registered-public-repository>
netkeep80/<registered-public-repository>#<issue-or-pr-number>
commit:<sha> when the surrounding object identifies a registered public repository
roadmap Role issue numbers
```

Unknown or non-public references fail closed.

## 10. Visibility transition

If a repository leaves public scope:

1. current sync/validation reports scope drift;
2. an explicit portfolio transition removes it from active public coordination;
3. its Role is closed/inactivated;
4. active Sessions terminate without importing new non-public facts;
5. generated active state stops exposing it;
6. future Messages must not reference it.

## 11. Authority / non-goals

The protocol does not:

- choose portfolio priority or canonical ownership automatically;
- create work because a timer fired or a worker is idle;
- grant merge authority from a Claim or Session;
- replace repository issues/PRs, local CI, or repo-guard;
- introduce a merge queue or global repository lock;
- coordinate private repositories;
- store hidden chain-of-thought.
