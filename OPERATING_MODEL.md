# Operating model

`netkeep80/roadmap` is the public portfolio control plane for public repositories owned by `netkeep80`.

Its job is to keep three things separate:

```text
portfolio intent
observed public GitHub facts
engineering execution
```

The scheduled automation layer is now observation/reconciliation only. Scheduled models are not autonomous developers.

## 1. Public scope

The semantic scope is:

```text
public repositories owned by netkeep80 only
```

Technical credentials do not expand that scope. The public control plane must not store non-public repository names, URLs, issue/PR identifiers, SHAs, dependencies, blockers, or indirect identifiers.

Every structured repository reference must resolve through the current public `data/portfolio.json` registry.

## 2. Sources of truth

| Question | Authority |
|---|---|
| Vision / long-term direction | `VISION.md`, `ASSOCIATIVE_COMPUTING.md` |
| Canonical ownership and architecture | `ARCHITECTURE.md`, accepted decisions |
| Priority / lifecycle / objective / next gate / declared dependencies | `data/portfolio.json` |
| Current public GitHub facts | GitHub API |
| Generated factual portfolio projection | `STATUS.md`, `data/status.json` |
| Cross-repository execution order | `EXECUTION.md` |
| Concrete implementation | local repository issues/code/tests |
| Integration validity | actual local CI / repo-guard / branch protection |
| Interactive agent durable coordination | Role / Session / Checkpoint / Message issues |
| Scheduled diagnostics | fixed observer issues #416-#419 |

The core split is:

```text
data/portfolio.json = intent / decisions
GitHub live state    = observed facts
STATUS/status.json   = generated factual projection
local repository     = implementation
observer issues      = bounded diagnostics only
```

Observed facts do not rewrite intent automatically.

## 3. Portfolio intent

`data/portfolio.json` is the human/reasoning-maintained machine-readable semantic registry.

Changes to priority, lifecycle, canonical ownership, objectives, next gates, dependency direction, tracked work, or workstreams are explicit portfolio decisions and go through normal reviewed repository changes.

Scheduled observers cannot edit this file.

## 4. Factual roadmap synchronization

`scripts/sync-roadmap.mjs` reads public GitHub facts and produces:

- `STATUS.md` — human-readable factual board;
- `data/status.json` — machine-readable factual snapshot.

These files are generated and must not be hand-edited.

`.github/workflows/portfolio-sync.yml` runs hourly, on relevant `main` changes, and by explicit workflow dispatch. This deterministic workflow is the actual Roadmap Reconciler write path.

The LLM Roadmap Reconciler role may verify this loop and request the normal deterministic workflow when possible; it must never author replacement factual state itself.

## 5. Scheduled observers

The complete scheduled contract is [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md).

Fixed roles:

```text
Roadmap Reconciler   -> deterministic STATUS/status.json sync
CI Sentinel          -> issue #416 only
PR Watchdog          -> issue #417 only
Dependency Watchdog  -> issue #418 only
Portfolio Auditor    -> issue #419 only
```

Observers have no shared work queue and no ownership arbitration.

Universal rule:

```text
observe -> classify -> publish bounded observation -> stop
```

They never:

- write target repositories;
- select engineering tasks;
- create developer Sessions/Claims;
- fix CI or code;
- merge/rebase/close PRs;
- migrate consumers or dependencies;
- change portfolio intent;
- invent root causes or successor work.

Ambiguity becomes `needs_reasoning`, not an attempted solution.

The former five Worker Slots #385-#389, `WORKER_SLOT`, self-dispatch, assignment generation and scheduled target-repository execution are retired historical state.

## 6. Interactive reasoning-capable repository agents

Engineering work remains possible through permanent repository-developer Roles for reasoning-capable interactive/manual agents.

For each registered public repository there is one permanent Role issue:

```text
[Agent Role] <repository> developer
```

The Role URL is stable identity. It does not contain dynamic current SHA/PR/portfolio status.

Bootstrap: [`AGENTS.md`](AGENTS.md).
Durable coordination protocol: [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md).

Interactive agents may use Sessions/Claims/Checkpoints/Messages when durable coordination is useful, but current target GitHub state and local CI remain authority.

No explicit executable work means no work.

## 7. Agent evidence boundary

Historical and interactive protocol evidence is still validated fail-closed where it matters.

- `scripts/agent-protocol.mjs` validates structured Role/Session/Checkpoint/Message data;
- `scripts/agent-evidence-integrity.mjs` validates checkpoint commit provenance and protected Session evidence transitions;
- `.github/workflows/agent-evidence-events.yml` handles relevant issue/comment events through GitHub API without recreating a generated worker dashboard.

There is no current generated Agent Status / worker-pool projection.

## 8. Portfolio drift

### New public repository

A public owner repository outside `data/portfolio.json` is control-plane drift and causes validation/sync failure until an explicit portfolio decision registers or otherwise resolves it.

### Repository leaves public scope

Do not silently erase it. Make an explicit lifecycle/ownership transition, then stop publishing new facts about it.

### Backlink drift

Registered child repositories must maintain their required stable portfolio backlink according to current validation rules.

### Intent-vs-fact drift

A closed issue, merged PR, or release is a fact. Whether that fact changes priority, lifecycle, ownership, dependency direction, or next gate is a reasoning decision.

Portfolio Auditor may report the mismatch but cannot resolve it.

## 9. Repository and integration authority

Roadmap does not implement a second merge queue.

```text
roadmap intent
  says what the portfolio is trying to achieve

local repository
  owns concrete implementation

local CI / repo-guard / branch protection
  decides whether a concrete integration candidate is acceptable
```

Observers cannot weaken or bypass local integration rules.

## 10. Decision recording

`DECISIONS.md` is appropriate when a reviewed change modifies a durable portfolio-level decision such as:

- canonical owner;
- dependency direction;
- repository lifecycle;
- P0/P1 boundary;
- accepted foundation semantics;
- long-term architecture recommendation;
- control-plane governance rules.

Routine factual synchronization and bounded observer snapshots are not portfolio decisions.

## 11. Automation inventory

### `portfolio-validate.yml`

Validates portfolio registry/live coverage, core interactive agent protocol validators, and the `roadmap-observer/v1` snapshot contract.

### `portfolio-sync.yml`

Hourly deterministic factual synchronization of `STATUS.md` and `data/status.json`.

### `agent-roles.yml`

Maintains one permanent repository-developer Role per registered public repository.

### `agent-evidence-events.yml`

Validates relevant interactive/manual Session and Checkpoint evidence transitions. It does not publish a worker status dashboard.

### `agent-evidence-integrity.yml`

PR/workflow tests for the evidence-integrity implementation itself.

## 12. Discoverability

Portfolio navigation:

```text
child repository
-> PORTFOLIO.md
-> central roadmap
-> STATUS / EXECUTION / ARCHITECTURE
```

Interactive engineering-agent navigation:

```text
permanent Role URL
-> AGENTS.md / AGENT_PROTOCOL.md
-> portfolio intent + fresh facts
-> target repository
```

Scheduled automation navigation:

```text
SCHEDULED_OBSERVERS.md
-> one fixed role
-> one fixed write boundary
-> observe and stop
```
