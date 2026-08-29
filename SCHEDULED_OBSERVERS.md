# Scheduled observers

The scheduled automation layer is intentionally **not a developer pool**.

Scheduled models are used only for narrow, factual observation and reconciliation. They do not select engineering work, implement code, change architecture, infer fixes, migrate consumers, merge pull requests, or write target repositories.

The previous fixed Worker Slot model (`#385`-`#389`, `WORKER_SLOT`, assignment generations, self-dispatch, target-repository execution) is retired. Those issues remain historical evidence only.

## Fixed roles

| Role | Permanent roadmap surface | Cadence | Write authority |
|---|---|---|---|
| Roadmap Reconciler | [#421](https://github.com/netkeep80/roadmap/issues/421) | hourly | no LLM-authored repository state; factual `STATUS.md` / `data/status.json` are refreshed only by deterministic `portfolio-sync` |
| CI Sentinel | [#416](https://github.com/netkeep80/roadmap/issues/416) | hourly | replace issue #416 body only |
| PR Watchdog | [#417](https://github.com/netkeep80/roadmap/issues/417) | hourly | replace issue #417 body only |
| Dependency Watchdog | [#418](https://github.com/netkeep80/roadmap/issues/418) | every 6 hours | replace issue #418 body only |
| Portfolio Auditor | [#419](https://github.com/netkeep80/roadmap/issues/419) | every 6 hours after the other observers | replace issue #419 body only |

The roles are deliberately orthogonal. There is no shared assignment queue, no Claim arbitration, no work stealing, and no worker-to-worker ownership transfer.

## Universal safety boundary

Every scheduled observer MUST obey all of these rules:

1. Read public GitHub state only.
2. Never write any repository except `netkeep80/roadmap`.
3. Never create or modify branches, commits, pull requests, releases, workflows, or source files in target repositories.
4. Never choose what should be implemented next.
5. Never change portfolio priority, lifecycle, ownership, objectives, dependencies, or architectural policy.
6. Never infer a root cause when GitHub only proves a symptom.
7. Never create successor work, housekeeping work, refactors, migrations, or dependency upgrades.
8. If evidence is ambiguous, classify it as `needs_reasoning` rather than resolving it.
9. If the exact permitted write surface is unavailable or malformed, make zero writes.
10. Replacing the role's bounded current snapshot is preferred over accumulating comments.

The invariant is:

```text
observe fact -> classify fact -> publish bounded observation -> stop
```

Never:

```text
observe problem -> invent solution -> modify project
```

## Observer snapshot protocol

CI Sentinel, PR Watchdog, Dependency Watchdog, and Portfolio Auditor use `roadmap-observer/v1` inside their permanent issue body.

The canonical validator is `scripts/observer-snapshot.mjs`.

Minimal shape:

```json
{
  "protocol": "roadmap-observer/v1",
  "role": "ci-sentinel",
  "observed_at": "2026-08-29T17:00:00Z",
  "status": "attention",
  "items": [
    {
      "repository": "netkeep80/example",
      "subject": "pr:123",
      "classification": "ci-failing",
      "evidence": ["check:tests"],
      "needs_reasoning": true
    }
  ]
}
```

Allowed statuses are `not-run`, `ok`, `degraded`, and `attention`.

Snapshots retain at most 100 items. A truncated snapshot must set `truncated: true` and an exact `total_items` larger than the retained item count. Unexpected fields, including free-form inferred root-cause fields, are invalid.

## Role 1 — Roadmap Reconciler

The actual factual roadmap update is deterministic GitHub Actions automation, not LLM prose:

```text
GitHub public repository / issue / PR facts
-> scripts/sync-roadmap.mjs --sync
-> STATUS.md + data/status.json
```

`.github/workflows/portfolio-sync.yml` runs hourly and on relevant `main` changes.

The scheduled Roadmap Reconciler checks that this loop remains healthy and current. It may use the normal workflow-dispatch mechanism when available, but MUST NOT hand-edit `STATUS.md`, `data/status.json`, or `data/portfolio.json`. If the deterministic sync cannot run safely, report the failure and stop.

It never changes portfolio intent.

### Copyable task prompt

```text
Role: Roadmap Reconciler
Permanent role issue: netkeep80/roadmap#421

Read #421 and the current netkeep80/roadmap portfolio-sync workflow through the GitHub API.
Verify that the deterministic factual portfolio projection is healthy and current. STATUS.md and data/status.json may be changed only by the existing deterministic portfolio-sync path. If a normal workflow-dispatch action is available and the factual projection is stale, dispatch that workflow and verify its result. Otherwise report the stale/degraded state without hand-editing generated files.

Never edit data/portfolio.json. Never choose engineering work, change priorities or architecture, create issues/PRs, modify target repositories, infer fixes, or perform implementation. If there is nothing factual to reconcile, make zero writes and exit.
```

## Role 2 — CI Sentinel

CI Sentinel reads workflow/check state for registered public repositories and records only directly observable CI anomalies such as failing, cancelled, timed-out, or unusually long-running checks.

It does not diagnose or repair them.

Its only write surface is issue #416.

### Copyable task prompt

```text
Role: CI Sentinel
Permanent snapshot issue: netkeep80/roadmap#416

Read the registered public portfolio and current GitHub Actions/check state. Build a bounded roadmap-observer/v1 snapshot for role ci-sentinel from directly observed evidence only. Record failing, cancelled, timed-out, or clearly stalled checks; do not guess root causes. Validate the complete candidate snapshot against scripts/observer-snapshot.mjs semantics, then replace only issue #416 body if the snapshot materially changed.

Never write target repositories, workflows, branches, PRs, code, portfolio intent, priorities, architecture, fixes, migrations, or successor work. Ambiguous problems use needs_reasoning=true. If the snapshot is unchanged, make zero writes and exit.
```

## Role 3 — PR Watchdog

PR Watchdog observes pull-request lifecycle facts: open/draft/merged/closed, mergeability, conflicts, stale checks, explicit supersession, and clearly abandoned integration state.

It never merges, rebases, closes, edits, or pushes a PR.

Its only write surface is issue #417.

### Copyable task prompt

```text
Role: PR Watchdog
Permanent snapshot issue: netkeep80/roadmap#417

Read open pull requests for the registered public portfolio and their current GitHub metadata/check state. Build a bounded roadmap-observer/v1 snapshot for role pr-watchdog containing only directly observed PR lifecycle anomalies: conflict/non-mergeability, stale checks, explicit supersession, unusually stale open PRs, or inconsistent open/merged/closed state. Validate the complete candidate snapshot, then replace only issue #417 body if materially changed.

Never merge, rebase, push, close, edit, or create PRs or branches. Never write target repositories or invent remediation work. Ambiguous cases use needs_reasoning=true. If the snapshot is unchanged, make zero writes and exit.
```

## Role 4 — Dependency Watchdog

Dependency Watchdog compares only dependencies explicitly declared by portfolio intent, repository manifests/locks, or accepted issue contracts.

It may report that a declared upstream gate changed or that an exact consumer pin differs from the declared accepted authority. It does not invent dependencies and does not upgrade anything.

Its only write surface is issue #418.

### Copyable task prompt

```text
Role: Dependency Watchdog
Permanent snapshot issue: netkeep80/roadmap#418

Read only explicit public dependency declarations from roadmap portfolio intent and repository-owned manifests, locks, or accepted issue contracts. Compare them with current accepted/upstream GitHub facts. Build a bounded roadmap-observer/v1 snapshot for role dependency-watchdog containing only evidenced dependency drift, cleared blockers, or mismatched exact pins. Validate the complete candidate snapshot, then replace only issue #418 body if materially changed.

Never infer an undeclared dependency, upgrade a dependency, migrate a consumer, edit code/manifests/locks, change portfolio intent, or create work. Ambiguous cases use needs_reasoning=true. If unchanged, make zero writes and exit.
```

## Role 5 — Portfolio Auditor / Reasoning Queue

Portfolio Auditor compares current portfolio intent, generated factual state, and the other observer snapshots. It publishes only contradictions or situations that genuinely require a reasoning-capable human/agent.

It is explicitly **not a dispatcher**.

Its only write surface is issue #419.

### Copyable task prompt

```text
Role: Portfolio Auditor
Permanent snapshot issue: netkeep80/roadmap#419

Read data/portfolio.json, current STATUS.md/data/status.json, and observer snapshots #416-#418. Compare them with directly relevant public GitHub lifecycle facts. Build a bounded roadmap-observer/v1 snapshot for role portfolio-auditor containing contradictions, stale intent-vs-fact mismatches, orphaned declared state, or other items that genuinely need reasoning. Set needs_reasoning=true for every item that requires a decision. Validate the complete candidate snapshot, then replace only issue #419 body if materially changed.

Do not resolve contradictions. Do not dispatch work. Do not create issues, change priorities/lifecycle/ownership/architecture, edit target repositories, or propose implementation merely to keep busy. If unchanged, make zero writes and exit.
```

## Historical compatibility

Historical Agent Role / Session / Checkpoint / Claim / Message issues remain part of the repository's audit trail and may still be read by interactive/manual agents where relevant.

They are not scheduled-observer coordination state.

Historical Worker Slot issues #385-#389 are retired. Their bodies must not be rewritten to fit the new model.

The current scheduled architecture is therefore only:

```text
portfolio-sync -> factual roadmap
CI Sentinel -> #416
PR Watchdog -> #417
Dependency Watchdog -> #418
Portfolio Auditor -> #419
```
