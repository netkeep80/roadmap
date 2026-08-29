# netkeep80 roadmap — public portfolio control plane

[![Portfolio validate](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-validate.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-validate.yml)
[![Portfolio sync](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-sync.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-sync.yml)
[![Agent evidence integrity](https://github.com/netkeep80/roadmap/actions/workflows/agent-evidence-integrity.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/agent-evidence-integrity.yml)

**Главный public roadmap и portfolio control plane для репозиториев `netkeep80`.**

Он хранит portfolio intent, публикует фактический GitHub snapshot и задаёт границы между архитектурными решениями, инженерной работой и автоматическим наблюдением.

## Start here

| Что нужно | Куда смотреть |
|---|---|
| Scheduled automation | [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md) |
| Запустить reasoning-capable repository agent по Role URL | [`AGENTS.md`](AGENTS.md) |
| Durable protocol для interactive/manual agents | [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md) |
| Текущее factual состояние portfolio | [`STATUS.md`](STATUS.md) |
| Machine-readable factual snapshot | [`data/status.json`](data/status.json) |
| Portfolio intent / priority / lifecycle / dependencies | [`data/portfolio.json`](data/portfolio.json) |
| Execution gates между repositories | [`EXECUTION.md`](EXECUTION.md) |
| Operating model | [`OPERATING_MODEL.md`](OPERATING_MODEL.md) |
| Ownership и layer boundaries | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Repository roles | [`REPOSITORIES.md`](REPOSITORIES.md) |
| Ключевые решения | [`DECISIONS.md`](DECISIONS.md) |
| Общий замысел | [`VISION.md`](VISION.md) |
| Associative-computing trajectory | [`ASSOCIATIVE_COMPUTING.md`](ASSOCIATIVE_COMPUTING.md) |

## Authority model

В control plane жёстко разделены решения, факты, реализация и наблюдение:

```text
human / reasoning-capable architectural decision
        ↓
data/portfolio.json
(priority, lifecycle, ownership, objective, next gate, dependencies)

GitHub public live state
        ↓
deterministic portfolio-sync
        ↓
STATUS.md + data/status.json
(observed facts)

local repository issues / code / tests
        ↓
actual implementation
        ↓
local CI / repo-guard / branch protection
(integration authority)

scheduled observers
        ↓
bounded roadmap-only diagnostics
(no engineering authority)
```

Observed facts never become architecture or priority decisions merely because automation saw them.

## Scheduled automation: observers, not developers

The previous autonomous five-worker developer pool is retired.

Scheduled models now have five fixed, non-overlapping roles:

| Role | Surface | Purpose |
|---|---|---|
| **Roadmap Reconciler** | [#421](https://github.com/netkeep80/roadmap/issues/421) + deterministic `portfolio-sync` | keeps factual roadmap projection current |
| **CI Sentinel** | [#416](https://github.com/netkeep80/roadmap/issues/416) | reports directly observed CI anomalies |
| **PR Watchdog** | [#417](https://github.com/netkeep80/roadmap/issues/417) | reports PR lifecycle/integration anomalies |
| **Dependency Watchdog** | [#418](https://github.com/netkeep80/roadmap/issues/418) | reports explicit dependency/pin drift |
| **Portfolio Auditor** | [#419](https://github.com/netkeep80/roadmap/issues/419) | builds a bounded `needs_reasoning` queue |

Universal invariant:

```text
scheduled observer
-> observe public facts
-> classify evidence
-> update only its fixed roadmap surface
-> stop
```

A scheduled observer never writes a target repository, selects implementation work, fixes CI, rebases/merges PRs, changes dependencies, edits portfolio intent, or invents successor work.

Full contract and copyable prompts: [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md).

Historical Worker Slot issues #385-#389 remain audit evidence only. `WORKER_SLOT`, assignment generations, self-dispatch and scheduled target-repository execution are no longer current architecture.

## Factual roadmap synchronization

The actual roadmap status update is deterministic:

```text
GitHub API
-> scripts/sync-roadmap.mjs --sync
-> STATUS.md + data/status.json
```

`.github/workflows/portfolio-sync.yml` runs hourly, on relevant `main` changes, and through explicit workflow dispatch.

Generated status files are never hand-edited and never change `data/portfolio.json`.

If generated facts disagree with intent, that mismatch requires a reasoning decision; Portfolio Auditor may surface it but cannot resolve it.

## Interactive reasoning-capable agents

Repository engineering remains available through one permanent repository-developer Role per registered public repository.

A Role URL is a stable bootstrap identity:

```text
[Agent Role] <repository> developer
```

An interactive agent reads current portfolio/live/local state, chooses only explicit executable work, and follows the target repository's real CI/repo-guard rules.

Optional durable coordination uses Role / Session / Claim / Checkpoint / Message issues as defined in [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md).

This machinery belongs to reasoning-capable interactive/manual execution. Scheduled observers do not enter those Roles and do not create developer Sessions or Claims.

## API-only control-plane invariant

Roadmap orientation and coordination use GitHub APIs. Do not clone `netkeep80/roadmap` merely to read status, portfolio intent, Role issues, or observer state.

Checkout `roadmap` only when explicit implementation work is actually being performed in `netkeep80/roadmap` itself.

## Public-only privacy boundary

The public control plane covers only public repositories registered in `data/portfolio.json`.

It must not publish non-public repository names, URLs, issue/PR identifiers, SHAs, dependencies, blockers, or indirect identifiers.

Unknown/out-of-scope structured references fail closed.

## Portfolio control loops

### Strategic loop

```text
vision
-> accepted reasoning decision
-> portfolio intent
-> local implementation
-> evidence
-> next explicit decision
```

### Factual loop

```text
GitHub public facts
-> portfolio-sync
-> STATUS.md + data/status.json
```

### Observer loop

```text
scheduled wake
-> fixed role
-> bounded read set
-> fixed roadmap-only write surface
-> exit
```

### Interactive engineering loop

```text
Role URL
-> fresh portfolio + target state
-> explicit work item
-> optional durable Session/Claim
-> implementation
-> actual CI/integration gates
-> completion/handoff
```

## Cross-repo workstreams

Current portfolio workstreams are registered in `data/portfolio.json` and represented by roadmap issues. Their live open/closed state is generated into [`STATUS.md`](STATUS.md) rather than manually duplicated here.

## Core architecture rules

1. One canonical owner per layer.
2. Portfolio intent is explicit; automation does not invent strategy.
3. GitHub live state owns observed facts.
4. `STATUS.md` / `data/status.json` are generated factual projections only.
5. Scheduled automation is observer-only and roadmap-write-bounded.
6. Interactive engineering follows explicit local work and local integration authority.
7. Public control-plane state must not expose non-public repositories.
8. Git is the archive; obsolete forward runtime should be removed rather than preserved indefinitely.
9. No compatibility layer without a named removal reason/gate.
10. Research evidence is not automatically an accepted production contract.
11. Future vision never bypasses current correctness/safety gates.

## Automation inventory

- `portfolio-validate.yml` — validates registry/live coverage and current protocol contracts;
- `portfolio-sync.yml` — hourly deterministic factual roadmap refresh;
- `agent-roles.yml` — reconciles permanent public repository Roles;
- `agent-evidence-events.yml` — validates relevant interactive Session/Checkpoint evidence events;
- `agent-evidence-integrity.yml` — tests the evidence-integrity boundary;
- `repo-guard.yml` — repository-local advisory governance check.

There is intentionally no generated scheduled-worker status loop and no autonomous scheduled developer runtime.
