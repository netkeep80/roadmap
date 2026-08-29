# Execution ordering

This document defines **how portfolio gates are interpreted**, not a queue for scheduled workers.

Current repository priority, lifecycle, objectives, dependencies and next gates are maintained in `data/portfolio.json`. Current public GitHub facts are generated into `STATUS.md` / `data/status.json`.

## 1. Source of current ordering

```text
data/portfolio.json
  explicit priority + lifecycle + objective + next_gate + depends_on
        ↓
STATUS.md / data/status.json
  current observed public facts
        ↓
reasoning-capable decision
  is a declared gate executable now?
        ↓
local repository issue
  exact implementation requirements
```

Do not maintain a second hard-coded list of current issue numbers here. It becomes stale faster than the registry and local repositories.

## 2. Priority is intent, not permission

Declared priority (`P0`, `P1`, and so on) orders **explicit executable work**. It does not authorize:

- inventing work;
- bypassing blockers;
- creating speculative cleanup;
- changing architecture;
- duplicating an already active implementation;
- treating an observed fact as a new portfolio decision.

No explicit executable work means no work.

## 3. Dependency gates

A downstream gate is executable only when its declared upstream requirements are satisfied by current evidence.

```text
upstream contract / evidence
        ↓
explicit downstream gate
        ↓
consumer implementation
        ↓
consumer validation
        ↓
obsolete path removal when declared
```

Do not build downstream workarounds for a blocker already localized upstream.

Dependency Watchdog may report explicit gate/pin drift but cannot decide how to resolve it.

## 4. Interactive engineering agents

Only reasoning-capable interactive/manual repository agents perform engineering work.

When choosing new work they use:

1. current explicit portfolio priority;
2. declared dependency/local order;
3. current local issue executability;
4. live target repository state;
5. optional current Session/Claim coordination if another interactive execution is active.

Historical or resumable context never outranks fresh GitHub evidence.

The target repository's actual CI, repo-guard and branch protection remain integration authority.

## 5. Scheduled observers do not execute this queue

Scheduled automation is defined by [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md).

Observers never select work from portfolio priority. They only observe their fixed factual domain and publish bounded roadmap-only diagnostics.

```text
priority/gates -> reasoning-capable engineering agent
CI facts       -> CI Sentinel
PR facts       -> PR Watchdog
dependency drift -> Dependency Watchdog
intent/fact contradictions -> Portfolio Auditor
```

## 6. Concurrency

Independent explicit work may proceed concurrently when the declared dependencies and local repository evidence permit it.

Concurrency does not create repository-wide locks. Optional interactive Claims coordinate one concrete issue/PR only.

When evidence is insufficient to establish safe parallelism, fail closed and require reasoning/coordination rather than inventing a global lock.

## 7. Gate completion

A gate is complete because its declared acceptance evidence exists, not because time passed or because a model produced a plausible implementation.

Typical evidence classes:

- accepted upstream contract;
- green required CI/conformance;
- exact consumer migration;
- independent engineering/safety evidence;
- explicit research accept/reject decision;
- obsolete implementation removed when the migration contract requires it.

## 8. Portfolio decision after a fact changes

A merged PR or closed issue is an observed fact.

If that fact implies a change to priority, lifecycle, canonical owner, dependency direction, objective or next gate, make an explicit reviewed roadmap change to `data/portfolio.json` (and `DECISIONS.md` when the decision class requires it).

Scheduled observers must not perform this semantic transition.

## 9. Continuous factual maintenance

Roadmap factual maintenance is deterministic:

```text
public GitHub state
-> portfolio-sync
-> STATUS.md + data/status.json
```

This loop is independent of product backlog and runs hourly.

## 10. Safety rule

Future architecture never bypasses current correctness, migration, proof, physical-safety, or integration gates.

Git is the archive: when a forward path is explicitly retired, remove it from the current tree rather than keeping multiple executable models alive for history.
