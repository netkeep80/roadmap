# Agent Control Plane protocol v1

This document defines the durable public coordination protocol used by agents in `netkeep80/roadmap`.

Entrypoints:

- [`AGENTS.md`](AGENTS.md) — permanent Role URL bootstrap;
- [`SCHEDULED_WORKERS.md`](SCHEDULED_WORKERS.md) — anonymous timer-driven pool bootstrap.

All structured repository references are public-only and must resolve through `data/portfolio.json`.

## 1. Canonical block

Agent Issues and Checkpoints contain exactly one block delimited by:

```text
<!-- roadmap-agent:start -->
... one fenced JSON object ...
<!-- roadmap-agent:end -->
```

Malformed JSON, duplicate blocks, unknown protocol versions, or out-of-scope repository references fail closed.

## 2. Permanent Role

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

## 3. Agent Session

Title:

```text
[Agent Session] <repository> / <session-id>
```

Canonical object for new Sessions:

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

A Session references exactly one Role and the same repository as that Role. The Session issue number is the durable identity of one execution.

Historical public v1 Sessions may omit `current_branch` and may contain previously accepted scheduler metadata. Both are read-tolerated migration cases only; scheduler metadata has no authority, liveness, collision, selection, or generated-status meaning.

`current_branch` is either `null` or an exact same-repository branch identity:

```json
{
  "repository": "netkeep80/<repository>",
  "name": "agent/<working-branch>"
}
```

`current_branch` is durable recovery/ownership metadata. It is **not** Role authority, a repository lock, Claim authority, or merge authority. Authority remains Role + deterministic winning Claim.

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

Protocol state and GitHub issue state must agree:

```text
starting / working / waiting / blocked => GitHub issue OPEN
handoff                               => GitHub issue OPEN only while genuinely resumable
completed / abandoned                 => GitHub issue CLOSED
```

A terminal Session has zero claims and cannot retain non-null `current_branch`. A handoff has zero claims but may retain `current_branch` while that exact branch is part of the durable resumable handoff. No-work invocations create no Session.

When a successor successfully consumes a handoff, the predecessor becomes `completed` with zero claims and is closed. An invalidated handoff becomes `abandoned` and is closed. `current_branch` is cleared only when that Session no longer owns/resumes the branch.

Closed Sessions remain historical audit evidence and are still fail-closed validated; they are not active control state.

## 4. Claim

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
winner => target writes allowed only after PR + branch reconciliation below
loser  => zero target writes
          create no target branch
          clear claim
          state=abandoned
          close Session issue
          bounded-reselect or exit
```

### 4.1 Open-PR reconciliation

A winning Claim does not make existing target-repository PR state disappear. Open PRs are integration/occupancy evidence and must be refreshed after the Session collision gate and before any target code write, branch creation, or new PR creation.

Explicit work-item binding is derived from normal local PR declarations such as `Closes #N`, `Fixes #N`, `Resolves #N`, or `Implements #N` (and same-repository qualified forms).

```text
0 open PRs explicitly bound to selected work item
  => continue to branch reconciliation

1 open PR explicitly bound to selected work item
  => reuse/resume that PR
  => reconcile its exact head branch with current_branch
  => do not create another PR for the same work item

>1 open PRs explicitly bound to selected work item
  => fail closed
  => zero target code writes
  => reconcile/close until one canonical open PR remains
```

A semantic replacement must explicitly declare `Supersedes: #N`. If the named PR is still open, the supersession is unreconciled and must be closed/reconciled rather than leaving both replacement and superseded PR open indefinitely.

Changed-file overlap alone is **not** collision authority. Independent or stacked work may legitimately touch the same public API, generated surface, manifest, or integration file. If different work items overlap semantically and current GitHub evidence is insufficient to establish safe parallelism, fail closed or coordinate durably; do not invent a repository-wide lock.

Agent Status may surface duplicate-work and unreconciled-supersession diagnostics, but workers still reconstruct authoritative open PR state directly from the target repository before mutation.

### 4.2 Branch reconciliation and durable ownership

**No open PR != dead branch.** A branch without an open PR may contain the only durable copy of useful unfinished work.

After winning the Claim and reconciling open PRs, refresh the complete target branch inventory, open PR heads/bases, stacked PR topology, exact default branch SHA, and relevant Session/Checkpoint branch ownership before any branch creation or target code write.

Canonical order:

```text
explicit work item
→ Session + deterministic Claim winner
→ open-PR reconciliation
→ branch reconciliation
→ choose exact intended branch
→ persist Session.current_branch
→ persist matching Checkpoint.current_branch when checkpointing
→ refresh GitHub and confirm durable ownership
→ only then create/reuse the exact branch
→ one canonical PR
→ CI / repo-guard
→ merge
→ ordinary ephemeral branch disappears
```

If the winning Session has no `current_branch`, selecting a branch name does not authorize branch creation. The worker must first persist that exact branch identity in the Session **before create or push**, then refresh GitHub, and only then create or reuse it.

If a LIVE/resumable Session already has `current_branch` and that exact branch exists without a PR, revalidate its commits and reuse it as owned pre-PR work. Do not create `branch-v2`, `branch-v3`, `tmp-new`, `agent-new`, or another replacement merely because no PR exists.

If `current_branch` points to an absent branch, a winning worker may create that exact branch only after fresh branch/PR reconciliation. A collision loser never creates, pushes, rewrites, or reuses a target branch.

Preservation rules:

- default branch is never a working-branch deletion target;
- active same-repository open PR heads are preserved;
- fork PR heads do not grant authority to mutate a local base-repository ref;
- LIVE/resumable `current_branch` is preserved/reused;
- explicit persistent release/Pages branches are preserved only when current repository configuration/policy proves persistence;
- ordinary merged same-repository working branches should disappear through normal lifecycle;
- a terminal Session plus unexplained surviving ordinary branch is branch drift requiring reconciliation, not automatic deletion authority.

Never infer branch obsolescence from absence of an open PR, age, name, behind count, changed-file overlap, ancestry, or superficially similar work. Destructive branch reconciliation requires current proof and exact-SHA guarding in the repository-local branch-hygiene implementation.

## 5. Checkpoint

A Checkpoint is a structured Session comment:

```json
{
  "protocol": "roadmap-agent-checkpoint/v1",
  "state": "working",
  "completed": ["short factual gate/result"],
  "refs": ["netkeep80/<public-repository>#123", "commit:<public-sha>"],
  "blockers": [],
  "next": ["exact next executable action"],
  "messages": [],
  "current_branch": {
    "repository": "netkeep80/<repository>",
    "name": "agent/<working-branch>"
  }
}
```

Rules:

- store public observable facts and accepted decisions, not private reasoning;
- include exact public SHA/PR/check evidence when needed for safe resumption;
- while an active/handoff Session owns a non-null branch, every new Checkpoint mirrors that exact `current_branch`;
- terminal history may retain earlier checkpoint evidence showing which branch was owned, while the terminal Session itself clears `current_branch`;
- every fresh worker revalidates Checkpoint facts against current GitHub before mutation;
- every marked Checkpoint on every protocol Session validates fail-closed, including closed historical Sessions;
- `handoff` requires durable context sufficient for a fresh worker to resume from GitHub only.

## 6. Session lease / liveness

Machine policy is `data/worker-policy.json`.

```text
lease_seconds = 7200
heartbeat_target_seconds = 3600
pr_reconciliation_required = true
branch_reconciliation_required = true
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

`STALE_CANDIDATE` is only a recovery signal. It never means a claim or branch is free.

Before changing a stale Session or taking its work, revalidate current GitHub completely:

```text
target exact default-branch SHA
complete branch inventory
open local issues and PRs
PR reconciliation for the selected work item
current_branch existence and exact current SHA if present
current PR exact head/base if any
stacked PR topology
actual CI / repo-guard gates
LIVE claims + deterministic winners
Messages
portfolio/dependency/lifecycle state
```

Then:

```text
completed / superseded / blocked / invalidated / held by LIVE winner
  => old stale Session -> abandoned, zero claims, current_branch cleared, CLOSED
  => unexplained surviving ordinary branch remains reconciliation drift

still executable and no LIVE winner
  => validate/recover any owned current_branch first
  => old stale Session -> abandoned, zero claims, current_branch cleared, CLOSED
  => create new Session from current GitHub facts
```

A stale Checkpoint never overrides fresher GitHub state.

## 7. Agent Message

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

Lifecycle:

```text
open / acknowledged => GitHub issue OPEN while unresolved/actionable
resolved             => GitHub issue CLOSED
```

Use Messages only for durable cross-repository coordination, dependency readiness, blockers, or required actions. Repository-local discussion remains local.

## 8. Bounded work selection

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

### Roadmap management under Role #49

`netkeep80/roadmap` is a normal managed repository. Control-plane/portfolio maintenance is performed only under permanent roadmap Role #49.

A roadmap maintenance action requires:

```text
concrete current roadmap/control-plane fact
+
existing declared invariant / goal / open roadmap issue / actionable Message
+
executable bounded action
```

Examples of valid triggers:

- terminal Session issue still open;
- resolved Message issue still open;
- consumed handoff predecessor still open;
- stale Session requiring protocol recovery;
- generated status / validator / portfolio drift against a declared invariant;
- existing roadmap umbrella/acceptance/governance issue whose already-proven evidence needs reconciliation.

Where the maintenance target is itself an open roadmap issue, claim that exact issue. Do not create a second housekeeping issue merely to track the repair.

A roadmap-management Session uses the same Session/Claim collision rules, PR reconciliation rules, branch reconciliation rules, lease rules, CI and repo-guard as every other repository Session. Different roadmap issues may be maintained concurrently; the same issue has only one LIVE winning claimant.

No concrete trigger => no roadmap maintenance candidate.

`portfolio_authority=coordinate` permits declared transitions; it does not permit autonomous strategy invention.

## 9. Refresh points

Refresh relevant GitHub facts:

- at invocation/bootstrap;
- before work selection;
- at Session creation;
- **after Session creation before any target-repository write**;
- after winning the Session claim, refresh all open target PRs and reconcile the selected work item;
- after PR reconciliation, refresh complete target branch inventory and reconcile branch ownership;
- before choosing/persisting `current_branch`;
- after persisting `current_branch` and **before branch create or push**;
- before branch creation or new PR creation;
- after dependency/blocker changes;
- before stale recovery;
- before every repository write;
- before PR draft/ready/integration transitions;
- before Session/Message close transitions;
- after merge/close transitions;
- before clearing `current_branch`;
- before handoff/completion.

Target repository CI/repo-guard rules remain integration authority.

## 10. Public-only reference grammar

Structured fields may reference only:

```text
netkeep80/<registered-public-repository>
netkeep80/<registered-public-repository>#<issue-or-pr-number>
commit:<sha> when the surrounding object identifies a registered public repository
current_branch.repository = same registered public Session repository
current_branch.name = canonical Git branch name, not refs/heads/...
roadmap Role issue numbers
```

Unknown or non-public references fail closed.

## 11. Visibility transition

If a repository leaves public scope:

1. current sync/validation reports scope drift;
2. an explicit portfolio transition removes it from active public coordination;
3. its Role is closed/inactivated;
4. active Sessions terminate without importing new non-public facts;
5. generated active state stops exposing it;
6. future Messages and `current_branch` ownership must not reference it.

## 12. Authority / non-goals

The protocol does not:

- choose portfolio priority or canonical ownership automatically;
- create work because a timer fired or a worker is idle;
- grant merge authority from a Claim, Session, or `current_branch`;
- replace repository issues/PRs, local CI, or repo-guard;
- infer work-item identity from changed-file overlap alone;
- infer deletion authority from branch age/name/ancestry/behind state;
- introduce a merge queue or global repository lock;
- create a privileged roadmap-admin execution mode outside Role #49;
- coordinate private repositories;
- store hidden chain-of-thought.
