# Agent Control Plane protocol v1

This document defines the durable public protocol used by AI agents coordinated through `netkeep80/roadmap`.

The bootstrap entrypoint is [`AGENTS.md`](AGENTS.md). All repository references below are public-only and must resolve to `data/portfolio.json`.

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
  "repository": "netkeep80/<repository>",
  "state": "working",
  "claims": ["netkeep80/<repository>#456"],
  "current_pr": null,
  "blocked_by": []
}
```

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

Active Session states are `starting`, `working`, `waiting`, `blocked`, and `handoff`. `completed` and `abandoned` do not hold active claims.

## 3. Claim

A claim is a local public issue or PR reference stored in the Session `claims` array.

Rules:

- claim repository must equal Session repository;
- claims coordinate work selection only; they do not grant merge authority;
- no global repository lock exists;
- before taking work, inspect all active Sessions for the Role.

Collision order for two active Sessions claiming the same item:

1. smaller `created_at` wins;
2. if equal, smaller Session issue number wins.

The loser releases the claim and chooses another executable item.

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
- every fresh agent revalidates the checkpoint against current GitHub state before mutation.

## 5. Agent Message

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

## 6. Refresh points

An agent must refresh its relevant GitHub facts:

- at session start;
- before selecting/claiming next work;
- after receiving a dependency/blocker message;
- before repository write;
- before PR draft/ready/integration lifecycle transition;
- after merging or closing a dependency gate;
- before handoff/completion checkpoint.

For PR integration, exact repository rules and repo-guard `next_action` (where configured) dominate stale Session state.

## 7. Public-only reference grammar

Structured protocol fields may reference:

```text
netkeep80/<registered-public-repository>
netkeep80/<registered-public-repository>#<issue-or-pr-number>
commit:<sha> only when the surrounding object unambiguously identifies a registered public repository
roadmap role issue numbers
```

They must not contain or encode a repository outside the public registry.

## 8. Visibility transition

When a repository leaves public scope:

1. current public sync/validation reports scope drift;
2. an explicit portfolio transition removes it from active public coordination;
3. its Role is closed/inactivated;
4. active Sessions are stopped as `abandoned` or otherwise terminated without importing new non-public facts;
5. generated active state no longer includes the repository;
6. no future Agent Message may reference the non-public source.

Previously public Git/GitHub history is historical public information; the control plane cannot retroactively erase it, but must not continue updating it from a non-public source.

## 9. Authority / non-goals

The protocol does not:

- choose portfolio priority or canonical ownership automatically;
- replace local repository issues/PRs;
- replace repo-guard or local CI;
- introduce a second merge queue;
- coordinate private repositories;
- store hidden chain-of-thought.
