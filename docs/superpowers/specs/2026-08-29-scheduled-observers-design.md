# Scheduled Observers — design

Date: 2026-08-29

## Context

The five scheduled workers were designed as persistent developer slots that could select and continue implementation work across repositories. In practice, scheduled runs without deep reasoning are not reliable enough for architectural interpretation, non-trivial debugging, semantic decisions, or autonomous repository development.

The useful capability is narrower: scheduled agents can repeatedly observe GitHub state, classify explicit facts, maintain bounded operational projections, and surface anomalies for a stronger interactive/reasoning agent.

This design removes scheduled development from the control plane and replaces it with orthogonal scheduled observers.

## Goals

1. Scheduled tasks must not perform autonomous target-repository development.
2. Each task has one fixed responsibility and a disjoint write surface.
3. Scheduled tasks may read public GitHub state broadly, but writes are restricted to `netkeep80/roadmap`.
4. Observers report facts and anomalies; they do not invent work, priorities, architecture, fixes, migrations, or successor tasks.
5. The existing portfolio registry and generated portfolio snapshot remain authoritative for portfolio intent and observed repository facts.
6. Historical Role / Session / Checkpoint / Claim / Message evidence remains readable for audit, but is not part of the scheduled hot path.
7. The forward scheduled design should be substantially simpler than the Worker Slot / assignment / acquisition protocol.

## Non-goals

Scheduled observers do not:

- write production code;
- change target repositories;
- create branches or pull requests in target repositories;
- merge, rebase, or repair pull requests;
- select engineering work;
- change portfolio priorities, ownership, lifecycle, or architecture;
- infer a fix from a failed check;
- create housekeeping work to remain busy;
- revive historical Session/Claim machinery.

## Chosen architecture

Use five independent scheduled roles. They share no assignment pool and perform no work stealing or arbitration.

### Observer 1 — Roadmap Reconciler

Purpose: maintain the factual portfolio projection already represented by `STATUS.md` and `data/status.json`.

Responsibilities:

- run or verify the normal portfolio synchronization path;
- compare registered portfolio entities with current public GitHub facts;
- update only generated factual portfolio state;
- surface synchronization failure or control-plane drift;
- never mutate portfolio intent (`data/portfolio.json`) automatically.

Write surface:

- generated `STATUS.md` / `data/status.json` through the existing portfolio-sync mechanism;
- no target-repository writes.

This role should reuse the deterministic `sync-roadmap` implementation rather than asking an LLM to rewrite the roadmap from prose.

### Observer 2 — CI Sentinel

Purpose: detect actionable CI anomalies without attempting to repair them.

Responsibilities:

- inspect open PRs and relevant default-branch workflow runs for registered repositories;
- classify explicit states such as failing, cancelled, timed out, queued/running unusually long, or missing expected checks when that expectation is explicit;
- retain only current anomalies plus timestamps/evidence references;
- set `needs_reasoning` for non-mechanical diagnosis.

Forbidden actions:

- modifying workflows;
- changing code;
- rerunning or cancelling jobs unless a future explicit policy grants that single operation;
- guessing root causes.

Write surface:

- one permanent roadmap observer issue owned only by CI Sentinel.

### Observer 3 — PR Watchdog

Purpose: classify pull-request lifecycle and integration anomalies.

Responsibilities:

- inspect open PRs in registered repositories;
- report states such as draft, behind, conflicting, stale, checks failing, checks pending for an unusual duration, or apparently abandoned;
- notice merged/closed PRs that contradict durable roadmap projections;
- identify obvious orphan branches only when evidence is unambiguous and report-only.

Forbidden actions:

- merge;
- rebase/update branch;
- push commits;
- close PRs;
- delete branches;
- infer implementation changes.

Write surface:

- one permanent roadmap observer issue owned only by PR Watchdog.

### Observer 4 — Dependency Watchdog

Purpose: detect explicit cross-repository dependency drift.

Responsibilities:

- use declared dependencies, exact pins, versions, SHAs, and explicit gates already recorded in portfolio/repository state;
- detect mechanically demonstrable conditions such as an upstream gate becoming complete while a declared consumer remains on the old exact pin;
- detect declared blockers that have disappeared or declared dependencies that are no longer resolvable;
- report the evidence without deciding whether or how a consumer should migrate.

Forbidden actions:

- dependency upgrades;
- consumer migrations;
- changing dependency policy;
- inventing undeclared dependencies.

Write surface:

- one permanent roadmap observer issue owned only by Dependency Watchdog.

### Observer 5 — Portfolio Auditor / Reasoning Queue

Purpose: find contradictions that require human or deep-reasoning review.

Responsibilities:

- compare portfolio intent, generated factual state, observer snapshots, and explicit GitHub lifecycle facts;
- report contradictions such as completed work still marked active, missing referenced issues, active objectives with no remaining executable artifact, duplicated explicit authority, stale observer state, or inconsistent declared gates;
- maintain a bounded `NEEDS_REASONING` queue with evidence and a concise reason.

Forbidden actions:

- resolving the contradiction;
- changing priority/ownership/lifecycle;
- creating implementation work;
- editing target repositories.

Write surface:

- one permanent roadmap observer issue owned only by Portfolio Auditor.

## Write-boundary rule

The central safety invariant is:

```text
scheduled observer reads public GitHub broadly
scheduled observer writes only its explicitly-owned roadmap projection
scheduled observer never writes a target repository
```

The Roadmap Reconciler is the only observer that updates generated portfolio files. Observers 2–5 each replace the body of exactly one permanent issue with a bounded current snapshot. They do not append unbounded comments.

No observer may write another observer's issue.

## Snapshot format

Observer issues use a small structured envelope so output is machine-checkable and replaceable.

Example:

```json
{
  "protocol": "roadmap-observer/v1",
  "role": "ci-sentinel",
  "observed_at": "2026-08-29T00:00:00Z",
  "status": "ok",
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

Rules:

- current snapshot replaces previous snapshot;
- no execution history in comments;
- bounded item count; if exceeded, sort deterministically and record truncation;
- evidence must identify observable GitHub facts, not inferred causes;
- `needs_reasoning` means escalation only, not authority to act.

## Scheduling

The five tasks no longer need staggered execution to simulate a continuous developer pool. Their cadences should match the volatility of the observed state.

Recommended initial cadence:

- Roadmap Reconciler: every hour;
- CI Sentinel: every hour;
- PR Watchdog: every hour;
- Dependency Watchdog: every 6 hours;
- Portfolio Auditor: every 6 hours, after the other projections have had time to refresh.

Exact staggering is optional and operational only; there is no collision protocol because write surfaces are disjoint.

## Removal of the old scheduled-worker forward path

Forward-only Worker Slot machinery becomes obsolete and should be removed rather than retained as a compatibility layer.

Remove or retire:

- `SCHEDULED_WORKERS.md` fixed-slot execution model;
- `data/worker-policy.json` if used only by scheduled developer selection;
- `scripts/worker-runtime.mjs` and worker-runtime tests that exist only for autonomous selection/execution;
- `scripts/worker-slot-runtime.mjs` and tests;
- `scripts/worker-slot-status.mjs` and slot-specific agent-status tests;
- Worker Slot integration from `agent-status` and its workflow where no longer needed;
- README/OPERATING_MODEL/AGENT_PROTOCOL/AGENTS references that present Worker Slots as the forward scheduled model;
- permanent Worker Slot issues #385–#389 as active coordination surfaces.

Historical design/plan documents and historical Role / Session / Checkpoint / Claim / Message issues are evidence. They may remain in Git history or closed GitHub issues; they must not be presented as current runtime architecture.

Before deleting a script, verify whether another non-slot workflow still imports it. Remove only code whose remaining purpose is the retired forward scheduled-developer path.

## Relationship to existing GitHub Actions

The repository already has deterministic automation for portfolio synchronization and agent projections. Prefer normal deterministic code over LLM scheduled tasks whenever the operation can be fully encoded.

In particular:

- portfolio-sync remains the primary mechanism for factual roadmap refresh;
- scheduled Roadmap Reconciler should trigger/check that mechanism rather than duplicate it in natural-language reasoning;
- agent-status should be simplified to historical/manual agent evidence if that projection remains useful, not kept alive merely for Worker Slots;
- observer snapshots are operational diagnostics, never merge authority or portfolio intent.

## Failure behavior

Fail closed.

If an observer cannot obtain sufficient evidence:

- do not mutate target repositories;
- do not infer the missing fact;
- preserve the previous valid snapshot only if the role's implementation explicitly supports it, otherwise publish a bounded `status: degraded` snapshot with the missing evidence class;
- do not create a remediation task automatically.

If an observer itself becomes stale, Portfolio Auditor may report that fact.

## Migration sequence

1. Keep all five current scheduled Worker tasks disabled.
2. Implement observer documentation and structured snapshot validation.
3. Create four permanent diagnostic observer issues for CI, PR, dependency, and portfolio audit. Roadmap Reconciler uses generated portfolio files rather than a fifth diagnostic issue.
4. Remove fixed Worker Slot forward runtime and slot integration after dependency verification.
5. Close #385–#389 as retired historical coordination surfaces; do not delete historical evidence.
6. Update README, AGENTS, AGENT_PROTOCOL, OPERATING_MODEL, workflows/tests, and any generated status wording so the current architecture is unambiguous.
7. Run repository tests and workflows.
8. Reconfigure the five scheduled tasks to the fixed observer roles only after the repository-side model is merged and green.

## Acceptance criteria

The migration is complete when:

- no enabled scheduled task can select or execute target-repository development work;
- no current documentation describes #385–#389 as active Worker Slots;
- no forward runtime depends on Slot assignment, generation, acquisition, Session/Claim arbitration, work stealing, or handoff;
- deterministic portfolio synchronization still passes;
- historical agent evidence remains readable where useful;
- observer roles have disjoint write surfaces;
- observers report facts/anomalies only and cannot mutate target repositories;
- repository CI/repo-guard is green;
- the five ChatGPT scheduled tasks are reconfigured from developer workers to the five fixed observer roles.

## Design principle

The scheduled tier is intentionally weak and mechanical:

```text
deep interactive agent -> decides and changes systems
scheduled observers     -> observe, classify, reconcile, escalate
```

This boundary is the feature, not a temporary limitation.