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

Create any number of Scheduled Tasks with the **same prompt**. Concurrency is bounded only by how many tasks may run at once; coordination happens through GitHub Sessions, Claims, Checkpoints, Messages, open-PR reconciliation, branch reconciliation, leases, and repository-local CI/repo-guard rules.

## Copyable prompt

```text
Access netkeep80/roadmap through GitHub API only and bootstrap strictly through the public Agent Control Plane as a fresh anonymous worker.

Do NOT clone or checkout netkeep80/roadmap for discovery, status, coordination, checkpointing, work selection, or reading control-plane files. Read Issues through GitHub Issues API and control-plane files through GitHub Contents API. Agent Status Issue #103 is convenience presentation only; reconstruct authoritative Role/Session/Checkpoint/Claim/Message state directly from live GitHub Issues.

Reconstruct current Role/Session/Checkpoint/Claim/Message/portfolio state from GitHub.
Validate the current operational control-plane protocol state before work selection or Session creation. This validation covers active open Roles, open Sessions, unresolved open Messages, and the structured Checkpoints required to derive LIVE/stale/handoff/branch custody for those Sessions. If any such object fails canonical protocol validation, return EXIT_CONTROL_PLANE_INVALID immediately: select no work, create no Session, make zero target-repository writes, and terminate this invocation. Do not use Agent Status #103 to bypass this gate, and do not expand scheduled-worker bootstrap into a full closed-history forensic audit.
Select only explicitly executable work permitted by the control plane, then enter the corresponding permanent Role issue.

Rank executable work by one normalized selector: explicit declared priority (P0 before P1 before P2 and so on), then explicit local/dependency order when declared, then continuation before genuinely new work only within the same effective rank, then repository lexical order, then issue number. Source type is not priority. A handoff is continuation evidence, not a separate priority queue. A Message changes derived work/dependency state and is not a global queue lane. Mixed or ambiguous priority fails closed until portfolio intent is explicit.

Treat netkeep80/roadmap itself as a normal managed repository. Roadmap/control-plane maintenance is allowed only through permanent roadmap Role #49, only for a concrete current management trigger or explicit roadmap work item, and uses ordinary Session/Claim collision rules. Only if Role #49 actually selects executable work in netkeep80/roadmap does roadmap become the target repository and may be cloned/checked out.

For any other Role, clone/checkout only the selected target repository when implementation work requires it. Never clone roadmap merely because it is the control plane.

Never invent work.
Never create housekeeping work merely because the worker is idle.
Never duplicate work held by a LIVE winning Session.
Recover STALE_CANDIDATE work only through the documented complete GitHub revalidation protocol.

If no executable work exists, return EXIT_NO_WORK: make zero repository changes, create no idle Session, and terminate this run.

When work exists, create a unique Agent Session issue for this execution. New forward Sessions are implementation coordination only and carry explicit `current_branch: null` until branch ownership is selected. After Session creation, refresh the complete competing LIVE Session/Claim set before any target-repository write. Proceed only if this Session is the deterministic winning claimant. If it loses, perform zero target-repository writes, create no target branch, transition the losing Session to terminal state, close it, then bounded-reselect another explicit candidate or exit.

After winning the claim and before any target-repository code write, branch creation, or new PR creation, refresh all open PRs in the selected target repository. If exactly one open PR explicitly implements/closes the same work item, reuse that PR instead of creating another. If multiple open PRs explicitly implement/close the same work item, perform zero target code writes until the duplicate PR state is reconciled to one canonical open PR. A replacement PR must explicitly declare `Supersedes: #N` and the superseded PR must be closed/reconciled; do not leave both open. Shared changed-file overlap alone does not serialize independent work.

After PR reconciliation, perform branch reconciliation before any target code write. Refresh the complete target branch inventory, open PR heads/bases and stacked topology, exact default-branch SHA, and durable Session/Checkpoint `current_branch` ownership. No open PR != dead branch: a branch without a PR may contain the only useful unfinished work.

If this winning Session already has a non-null `current_branch`, revalidate that exact same-repository branch and reuse it when safe, including an owned pre-PR branch. Do not invent `branch-v2`, `branch-v3`, `tmp-new`, or another branch merely because the owned branch has no PR.

If no branch is yet owned, choose the exact intended branch, persist `current_branch` in the Session (and mirror it in subsequent Checkpoints) BEFORE create or push, then refresh GitHub and confirm the durable ownership write. Only after that refresh may the winning worker create or reuse the exact branch. `current_branch` is recovery metadata, not authority; Role + winning Claim remain authority.

Never delete or abandon a branch merely because it is old, behind, oddly named, has no PR, overlaps another change, or is an ancestor of another commit. Preserve default/persistent configured branches, open PR heads, and LIVE/resumable owned branches. A terminal Session with an unexplained surviving ordinary working branch is reconciliation drift, not automatic deletion authority.

Before every repository write or lifecycle transition, refresh exact GitHub state and obey the target repository's actual CI/repo-guard/branch-protection policy. The target repository is the integration authority. Do not create independent acceptance Sessions, candidate/acceptance seal chains, roadmap merge-authority pointers, target-side roadmap acceptance replay, or a roadmap-owned merge queue.

If meaningful work continues for longer than `heartbeat_target_seconds`, refresh the authoritative heartbeat by writing another ordinary structured Checkpoint. Do not create a separate heartbeat object, keepalive service, or scheduler identity.

Before finishing meaningful work, leave a durable Checkpoint. While the Session owns a branch, the Checkpoint must carry the same `current_branch`. If work is complete or abandoned, clear claims and clear `current_branch` only once the Session no longer owns/resumes that branch, then close the Session issue. Keep a handoff issue open only while it carries genuine unfinished execution state that cannot be reconstructed from the local issue alone, normally an unfinished branch/PR or a concrete partial implementation boundary. Do not keep a handoff open merely to say wait for a dependency, read an issue later, remember a note, or mark the next task; those facts belong in the local Issue or a Message. When a successor consumes a genuine handoff, complete/close the predecessor.
```

## Bootstrap and work selection

Before creating a Session, reconstruct current public state without cloning roadmap:

```text
roadmap main via GitHub API
→ AGENTS.md / AGENT_PROTOCOL.md via Contents API
→ data/worker-policy.json via Contents API
→ portfolio/status/execution via Contents + Issues API
→ permanent Roles via Issues API
→ Sessions + validated Checkpoints, including current_branch, via Issues API
→ LIVE claims + stale claims pending recovery
→ unresolved Messages
→ validate current operational protocol state
   invalid => EXIT_CONTROL_PLANE_INVALID; zero work selection, zero Session creation, zero target writes
→ candidate local GitHub facts
→ open target PRs before target mutation/integration work
→ complete target branch inventory before target mutation
```

Permanent Agent Status Issue #103 may be used as a quick human-oriented dashboard, but workers must not use it as coordination authority or as a substitute for live issue reconstruction.

Forward work selection uses one normalized rank:

```text
1. explicit declared priority: P0 < P1 < P2 < ...
2. explicit local/dependency order when declared
3. continuation before genuinely new work only inside the same effective rank
4. repository lexical order
5. issue number
```

Source type is not priority. A handoff contributes continuation evidence. A Message changes derived executable/blocker/dependency state. It does not outrank a local Issue merely because it is a Message. Mixed or ambiguous priority is non-rankable and fails closed until portfolio intent is explicit.

Executable local work must be public, portfolio-consistent, executable now, unblocked, not occupied by a LIVE winning Session, and not pending stale-session recovery. If the normalized candidate set is empty, the only result is `EXIT_NO_WORK` with zero repository writes and zero idle Session creation.

There is no branch that creates work merely because the worker is idle. No speculative backlog generation, unsolicited cleanup/refactoring, idle dependency upgrades, implicit milestones, blocker bypasses, or keep-busy issues are allowed.

## Roadmap management lane

`netkeep80/roadmap` participates in the same pool as every other repository. Management work always enters permanent Role #49.

A roadmap maintenance candidate requires both a concrete current fact and declared authority, for example:

- terminal Session still open;
- resolved Message still open;
- consumed handoff predecessor still open;
- stale Session requiring protocol recovery;
- generated status / validator / portfolio drift against an existing invariant;
- existing roadmap umbrella/governance issue whose already-proven evidence needs reconciliation.

Where the maintenance target is itself an open roadmap issue, claim that exact issue. Do not create another meta-issue just to track the cleanup.

```text
roadmap maintenance trigger
→ Role #49
→ Session
→ claim exact roadmap issue
→ refresh competing LIVE claimers
→ one winner performs PR reconciliation
→ branch reconciliation + durable current_branch
→ only then may the winner mutate roadmap as target repository
```

Different roadmap issues may be maintained in parallel. Two workers targeting the same roadmap issue are resolved by the ordinary post-Session collision gate.

No concrete management trigger means no roadmap housekeeping candidate and therefore no reason to checkout roadmap.

## Session identity, lifecycle and collision gate

A Session issue is the durable identity of one execution. The timer invocation itself has no durable identity. New forward Sessions coordinate implementation work only; historical v1/v2 acceptance evidence remains readable history but is not a forward execution phase.

Two anonymous invocations may race and both select the same apparently-unclaimed item before either Session exists. That is acceptable. Correctness begins after Session creation:

```text
create Session + claim
→ refresh all competing LIVE Sessions claiming the same item
→ order by Session GitHub created_at, then issue number
→ winner refreshes/reconciles open target PRs for the work item
→ winner refreshes/reconciles branches
→ winner persists current_branch before create/push
→ winner may mutate target repository only after durable branch ownership
→ loser may not mutate target repository or create a branch
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
  => continue to branch reconciliation

1 open PR explicitly bound to selected work item
  => reuse/resume that PR; do not create a second one

>1 open PRs explicitly bound to selected work item
  => fail closed
  => zero target code writes
  => reconcile/close until one canonical open PR remains
```

A semantic replacement uses an explicit `Supersedes: #N` declaration and closes/reconciles the superseded PR. Agent Status reports a replacement that still leaves the named old PR open.

Changed-file overlap by itself is diagnostic only. Independent or stacked work may legitimately touch a shared public API, generated file, manifest, or other common surface. When different work items overlap semantically and current GitHub evidence is insufficient to prove safe parallelism, the worker must fail closed or coordinate durably rather than invent a repository-wide lock.

## Branch reconciliation gate

Branch reconciliation runs after Claim and PR reconciliation and before target mutation.

```text
LIVE/resumable Session + current_branch + exact branch exists
  => preserve/revalidate/reuse exact branch

winning Session + current_branch + exact branch absent
  => refresh facts, then create only that exact branch

winning Session + no current_branch
  => choose intended name
  => persist current_branch BEFORE create or push
  => refresh GitHub
  => only then create/reuse

terminal Session + unexplained ordinary branch still present
  => branch drift requiring reconciliation
  => never automatic deletion authority
```

No open PR != dead branch. A useful pre-PR branch may be the only unfinished implementation. Never create a replacement suffix branch just to avoid inspecting an existing owned branch.

Default branch, active open-PR heads, LIVE/resumable owned branches, and branches proven persistent by actual release/Pages configuration are preserved. Fork PR heads do not grant authority to mutate local base-repository refs. Age, name, behind count, changed-file overlap, ancestry, and absence of a PR are diagnostic facts only, never deletion authority.

## Lease and stale recovery

Machine policy lives in `data/worker-policy.json` and is read through GitHub Contents API during bootstrap.

```text
lease_seconds = 3600
heartbeat_target_seconds = 1800
selection_policy = normalized-finish-first-v1
pr_reconciliation_required = true
branch_reconciliation_required = true
```

Authoritative heartbeat:

1. GitHub server `created_at` of the latest valid structured Checkpoint;
2. otherwise Session issue `created_at`.

A genuinely active long-running Session refreshes this same heartbeat with an ordinary structured Checkpoint around `heartbeat_target_seconds`; no separate heartbeat object is introduced.

Session `updated_at` is not heartbeat authority.

Classification:

```text
starting / working / waiting / blocked + age <= lease => LIVE
starting / working / waiting / blocked + age >  lease => STALE_CANDIDATE
handoff                                           => RESUMABLE_HANDOFF
completed / abandoned                             => TERMINAL
```

A stale retained claim or branch is **not free**. Recovery requires complete current-GitHub revalidation of target main, complete branch inventory, open issues/PRs, current `current_branch` and exact SHA if present, current PR head/base, stacked topology, actual CI/repo-guard gates, LIVE winners, Messages, and portfolio/dependency state. Only then may the stale Session be abandoned and, if still executable and unoccupied, replaced by a new Session.

## Integration and privacy boundaries

The pool coordinates only registered public owner repositories. Unknown or non-public repository references fail closed.

Roadmap decides whether work is explicit and unoccupied through API-visible control state. The target repository decides whether a change may integrate. Before integration, re-read exact target CI/repo-guard/branch-protection state and obey it. Roadmap coordination state never grants merge authority, and new forward workers do not create independent acceptance Sessions, acceptance seals/attestations, `roadmap-agent-pr/v1` or `/v2` merge pointers, GraphQL merge-provenance gates, target-side roadmap acceptance replay, no-bypass proofs, or a roadmap-owned merge queue.

Historical v1/v2 Session/Checkpoint evidence remains readable for compatibility and forensic history. It is not authority to create new forward acceptance work.

## Human operating model

```text
create N identical Scheduled Tasks
        ↓
anonymous invocations read roadmap control plane via GitHub API only
        ↓
select explicit executable target by normalized rank
        ↓
Session + deterministic Claim winner
        ↓
PR reconciliation → branch reconciliation → durable current_branch
        ↓
checkout only that target repository when required
        ↓
normal repository implementation + target CI/repo-guard integration
        ↓
Sessions/Claims/Checkpoints/Messages coordinate concurrency and handoff
        ↓
open roadmap state reflects current work, closed issues retain history
```

Production pilot evidence is tracked in roadmap #62. Numbered scheduler identities are not part of the forward model.
