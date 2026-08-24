# Anonymous Scheduled Worker Design

## Goal

Make every Scheduled Task use one universal zero-parameter prompt. A scheduler invocation begins anonymous; durable execution identity starts only when GitHub creates a unique Agent Session issue.

## Identity model

```text
Scheduled Task != identity
invocation != durable identity
Role issue = authority identity
Session issue = execution identity
Claim = optimistic work ownership candidate
Checkpoint = durable execution context
```

No scheduler-provided slot, UUID, repository assignment, or durable timer identity is required.

## Selection and collision flow

```text
Scheduled Task fires
-> fresh anonymous invocation
-> reconstruct Role/Session/Checkpoint/Claim/Message/portfolio state from GitHub
-> select only explicit executable work
-> enter corresponding permanent Role
-> create Session
-> refresh all competing Sessions/Claims before any target-repository write
-> deterministic winning Session may proceed
-> losing Session abandons/releases without target mutation, then may bounded-reselect or exit
```

Two identical invocations are allowed to select the same apparently-unclaimed issue before either Session exists. Correctness begins at the post-Session claim refresh, where the existing Session ordering resolves the race.

## Liveness

The generated Agent status must use the same lease classifier as the worker runtime. Protocol state alone does not imply liveness.

```text
starting/working/waiting/blocked + heartbeat age <= lease => LIVE
starting/working/waiting/blocked + heartbeat age > lease  => STALE_CANDIDATE
handoff                                                   => RESUMABLE_HANDOFF
completed/abandoned                                       => TERMINAL
```

Active claim ownership is derived only from LIVE winning Sessions. A stale Session's retained claim remains visible as recovery-required and is never silently treated as free.

## Scheduled-worker prompt

All Scheduled Tasks receive exactly the same prompt with no parameters. Creating N Scheduled Tasks yields up to N concurrent anonymous invocations coordinated exclusively through GitHub.

## Legacy policy

Do not add compatibility machinery. Existing historical Session issues containing optional `worker_slot` may remain parseable only so public history stays valid. New docs, generated status, Session creation guidance, tests, and acceptance criteria do not use `worker_slot`. No replacement UUID is introduced.

## Scope split

1. `roadmap#87`: lease-aware Agent status projection and stale-claim visibility.
2. `roadmap#88`: remove slot numbering from the forward scheduled-worker operating model and add post-Session collision refresh requirements.
3. A separate portfolio reconciliation updates stale semantic baseline text (`v0.7` -> current accepted boundary) without mixing portfolio semantics into worker-runtime changes.

## Acceptance invariants

- zero-parameter universal scheduled-worker prompt;
- no fixed repository assignment;
- no speculative work or idle Session;
- deterministic collision winner after Session creation;
- losing Session performs zero target-repository writes;
- LIVE winner prevents duplicate mutation;
- STALE_CANDIDATE requires complete current-GitHub revalidation;
- Session issue is sufficient durable execution identity;
- historical `worker_slot` has no forward operational role.
