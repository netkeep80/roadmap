# Agent Control Plane protocol

This document defines optional durable coordination for **interactive/reasoning-capable repository agents** in the public `netkeep80` portfolio.

It is not the scheduled automation protocol. Scheduled automation is defined separately in [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md) and never creates developer Sessions or Claims.

All structured repository references are public-only and must resolve through `data/portfolio.json`.

## 1. Canonical block

Role, Session, Message issues and Checkpoint comments use exactly one structured block:

````text
<!-- roadmap-agent:start -->
```json
{ ... }
```
<!-- roadmap-agent:end -->
````

Malformed JSON, duplicate blocks, unknown protocol versions, inconsistent issue lifecycle, or out-of-scope repository references fail closed.

## 2. Permanent Role

One registered public repository has one permanent Role issue:

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

Role identity is stable. Dynamic SHA/PR/status/priority facts are always re-read from current GitHub and portfolio sources rather than copied into the Role.

## 3. Session

A Session is optional durable context for one interactive execution:

```text
[Agent Session] <repository> / <session-id>
```

Canonical v1 object:

```json
{
  "protocol": "roadmap-agent-session/v1",
  "role_issue": 123,
  "repository": "netkeep80/<repository>",
  "state": "working",
  "claims": ["netkeep80/<repository>#456"],
  "current_branch": null,
  "current_pr": null,
  "blocked_by": []
}
```

Allowed states:

```text
starting
working
waiting
blocked
handoff
completed
abandoned
```

Lifecycle:

```text
starting / working / waiting / blocked => issue OPEN
handoff                               => issue OPEN only while genuinely resumable
completed / abandoned                 => issue CLOSED
```

Terminal Sessions retain zero claims and no branch ownership. A handoff retains zero claims and may preserve an exact unfinished branch only when that branch is genuinely part of the resumable work.

No-work runs create no Session.

Historical v1/v2 Session fields, including old scheduler metadata, remain read-tolerated only for audit compatibility. Historical scheduler fields grant no current authority.

## 4. Claim

A Claim is an explicit same-repository issue/PR reference in a Session `claims` array. It coordinates duplicate effort on one work item; it does not lock a repository and does not grant merge authority.

If multiple current Sessions claim the same item, deterministic order is:

1. earlier GitHub Session issue `created_at`;
2. if equal, lower Session issue number.

After creating a claiming Session and before the first target-repository mutation, an interactive agent must refresh the complete relevant current claimant set.

```text
winner -> may continue only after current target repository/PR/branch state is re-read
loser  -> zero target writes; clear claim; abandon/close Session
```

A handoff or terminal Session has zero claims.

## 5. Branch and PR context

`current_branch` is optional recovery metadata, never authority by itself:

```json
{
  "repository": "netkeep80/<repository>",
  "name": "agent/<working-branch>"
}
```

Before mutating code, the agent must inspect current target-repository facts rather than infer them from Session metadata:

- default branch SHA;
- existing branch with the intended name;
- open PRs for the work item;
- PR head/base and mergeability;
- actual CI/repo-guard/branch protection.

Do not create duplicate PRs for an already represented work item. Do not treat absence of an open PR as proof that a branch is disposable. Destructive branch cleanup requires separate current evidence.

## 6. Checkpoint

A Checkpoint is a structured Session comment containing resumable **public facts**, not private reasoning:

```json
{
  "protocol": "roadmap-agent-checkpoint/v1",
  "state": "working",
  "completed": ["short factual result"],
  "refs": ["netkeep80/<repository>#123", "commit:<public-sha>"],
  "blockers": [],
  "next": ["exact next executable action"],
  "messages": [],
  "current_branch": null
}
```

Use exact public evidence when it matters for safe continuation. Fresh GitHub state always outranks an old Checkpoint.

Commit evidence at the write boundary is validated by the repository's agent evidence integrity automation. A syntactically plausible SHA is not sufficient if the referenced commit cannot be validated against the correct public repository.

## 7. Message

Use a durable Message only for real cross-repository coordination that cannot live naturally in the local repository issue.

Example shape:

```json
{
  "protocol": "roadmap-agent-message/v1",
  "from_role_issue": 123,
  "to_role_issues": [456],
  "kind": "dependency-ready",
  "requires_ack": true,
  "state": "open",
  "refs": ["netkeep80/upstream#10"]
}
```

Unresolved Messages remain open; resolved Messages close.

Do not use Messages as an alternative backlog or general execution log.

## 8. Refresh rule

Durable coordination is a cache of context, not execution truth.

An interactive engineering agent refreshes relevant GitHub facts:

- when entering a Role;
- before selecting/claiming work;
- after creating a claiming Session;
- before every material target-repository write;
- before PR lifecycle/integration changes;
- after dependency/blocker changes;
- before handoff/completion.

The target repository's actual state and actual CI/integration rules are authoritative.

## 9. Bounded autonomy

```text
NO EXPLICIT EXECUTABLE WORK
=> NO WORK
=> EXIT
```

Do not invent housekeeping, refactors, dependency upgrades, architecture changes, milestones, or successor issues merely because an agent is idle.

Roadmap work is no exception: interactive roadmap implementation requires an explicit roadmap work item under Role #49.

## 10. Public-only boundary

The control plane must not contain non-public repository names, URLs, issue/PR identifiers, SHAs, dependencies, blockers, or indirect identifiers.

Unknown or non-public structured references fail closed.

## 11. Historical compatibility

Historical Role / Session / Checkpoint / Claim / Message records remain readable audit evidence.

Historical Worker Slot issues #385-#389 and any `WORKER_SLOT`, assignment-generation, lease, self-dispatch, or scheduled-developer metadata are retired. They are never current work-selection authority.

No generated Agent Status dashboard is required for current operation. Read authoritative coordination directly from the relevant GitHub issues when an interactive agent actually needs it.

## 12. Scheduled automation is separate

Scheduled observers do not enter repository developer Roles, do not create Sessions/Claims, and do not execute target work.

Their complete forward contract is [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md):

```text
observe -> classify -> publish bounded roadmap observation -> stop
```
