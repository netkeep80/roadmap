# netkeep80 roadmap — portfolio + agent control plane

[![Portfolio validate](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-validate.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-validate.yml)
[![Portfolio sync](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-sync.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-sync.yml)
[![Agent status](https://github.com/netkeep80/roadmap/actions/workflows/agent-status.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/agent-status.yml)

**Это главный центр управления и развития public-репозиториев [`netkeep80`](https://github.com/netkeep80).**

Он одновременно является portfolio control plane и durable coordination point для AI-агентов, работающих по одной repository-developer роли на каждый public repository.

## Start here

| Что нужно узнать | Куда смотреть |
|---|---|
| **Запустить AI-агента по одной role URL** | [`AGENTS.md`](AGENTS.md) |
| **Role / Session / Message / Claim protocol** | [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md) |
| **Текущее состояние worker pool** | [Agent Status Issue #103](https://github.com/netkeep80/roadmap/issues/103) — disposable human-readable projection |
| **Текущее состояние portfolio** | [`STATUS.md`](STATUS.md) — generated portfolio board |
| **Что делать раньше/позже** | [`EXECUTION.md`](EXECUTION.md) — dependency lanes and gates |
| **Зачем существует вся программа** | [`VISION.md`](VISION.md) |
| **Кто чем владеет и как связаны слои** | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| **Подробная роль каждого repository** | [`REPOSITORIES.md`](REPOSITORIES.md) |
| **Куда может развиваться ассоциативная архитектура** | [`ASSOCIATIVE_COMPUTING.md`](ASSOCIATIVE_COMPUTING.md) |
| **Как поддерживается актуальность** | [`OPERATING_MODEL.md`](OPERATING_MODEL.md) |
| **Почему были приняты ключевые решения** | [`DECISIONS.md`](DECISIONS.md) |
| **Machine-readable portfolio intent** | [`data/portfolio.json`](data/portfolio.json) |
| **Machine-readable observed portfolio state** | [`data/status.json`](data/status.json) |

> `STATUS.md` / `data/status.json` относятся к portfolio snapshot. Оперативное состояние worker pool не хранится в Git: source of truth — live Role / Session / Checkpoint / Claim / Message Issues, а [Issue #103](https://github.com/netkeep80/roadmap/issues/103) является только удобной производной проекцией для человека.

## Authority model

В portfolio разделены **решения**, **факты** и **execution context**.

```text
human / architectural decision
        ↓
data/portfolio.json
(priority, lifecycle, ownership, objective, next gate, dependencies)
        ↓
roadmap documents / workstreams
        ↓
local repository epics
        ↓
implementation

GitHub API
        ↓
STATUS.md + data/status.json
(observed portfolio facts)

Agent Role issue
        ↓
Agent Session / Checkpoints / Messages / Claims
(authoritative durable execution coordination)
        ↓
Agent Status Issue #103
(disposable human-readable projection; never authority)
```

Это означает:

- `roadmap` владеет **portfolio direction** и public Agent Control Plane;
- local repositories владеют **implementation backlog**;
- GitHub API владеет наблюдаемыми фактами;
- repo-guard / local CI остаётся authority для change/integration correctness там, где он реально настроен;
- автоматика **не меняет архитектурные приоритеты сама**;
- новый public repository, не зарегистрированный в `data/portfolio.json`, считается control-plane drift;
- non-public repositories находятся вне этого public control plane и не должны упоминаться в его agent state.

Подробно: [`OPERATING_MODEL.md`](OPERATING_MODEL.md).

## One URL agent bootstrap

Для каждого public repository существует ровно одна permanent issue:

```text
[Agent Role] <repository> developer
```

Пользователь может дать новому агенту только URL этой issue. Агент сам:

```text
role issue
→ reads roadmap control-plane data through GitHub API
→ validates public role identity
→ reads portfolio intent + fresh observed state
→ restores active session/handoff
→ reads inbox + claims
→ inspects exact local repository state
→ checks out/clones only the selected target repository when code work requires it
→ works under local CI/repo-guard rules
→ checkpoints and coordinates cross-repo changes through GitHub Issues API
```

### API-only control-plane invariant

Обычный worker **не клонирует и не checkout-ит `netkeep80/roadmap`** только ради bootstrap, выбора работы, чтения статуса, claim, checkpoint или coordination. Для этого используются GitHub Issues / Contents API.

```text
roadmap control plane = API-only
selected target repo  = checkout/clone only when implementation requires it
```

Единственное исключение: если worker под permanent roadmap developer Role #49 выбрал executable работу **в самом `netkeep80/roadmap`**, тогда `roadmap` становится его обычным target repository и может быть checkout-нут как любой другой target.

Полный алгоритм: [`AGENTS.md`](AGENTS.md).

## Общий замысел

За отдельными репозиториями стоит один более широкий исследовательский вопрос:

> Можно ли построить вычислительную среду, где связь является универсальным структурным примитивом, ассоциативный поиск — базовой операцией, память персистентна по замыслу, а программы, данные, контекст и состояние выражаются разными ролями одной связевой структуры?

Ключевая исследовательская вертикаль:

```text
МТС / anum_docs
  normative semantics and denotation boundaries
        ↓
AVM
  canonical link-native execution
        ↕
persistent LinkStore / PMM-class substrate
        ↓
long-lived program + data + state space

mts_visual
  independent consumer-neutral presentation/rendering infrastructure

aprover / anum_parser / tooling
  consumers/adapters, proof, inspection, migration evidence
```

`mts_visual` не владеет MTS semantics и не зависит от `@mts/core`; consumers exact-pin semantic и visual authorities независимо.

`pjson` является важным практическим consumer persistent substrate, но не объявляется конечным внутренним форматом будущей ассоциативной машины.

Наиболее реалистичная следующая архитектурная цель:

```text
software semantics
→ persistent associative runtime
→ realistic workload
→ associative scheduler / self-hosting
→ profiling
→ accelerator
→ only then possible custom hardware
```

Подробнее: [`VISION.md`](VISION.md) и [`ASSOCIATIVE_COMPUTING.md`](ASSOCIATIVE_COMPUTING.md).

## Portfolio control loops

### 1. Strategic loop

```text
vision
→ accepted architecture decision
→ portfolio priority / next gate
→ local implementation
→ evidence
→ update or keep decision
```

### 2. Factual loops

```text
GitHub repository/issues/PR facts
→ portfolio-sync
→ STATUS.md + data/status.json

GitHub Role/Session/Checkpoint/Claim/Message state
→ agent-status (GitHub API only; no checkout)
→ permanent Agent Status Issue #103
```

### 3. Agent coordination loop

```text
Role URL
→ API-only roadmap bootstrap
→ Session / Claim
→ selected target repository work
→ cross-repo Message when needed
→ Checkpoint / Handoff
→ fresh agent can resume from the same Role URL
```

### 4. Dependency loop

```text
upstream gate closes / new blocker appears
→ generated status records the fact
→ evaluate portfolio impact
→ explicit decision updates registry/execution order
→ consumer migration
→ obsolete path removal
```

## Cross-repo workstreams

Главные workstreams живут как issues этого repository и одновременно зарегистрированы в `data/portfolio.json`:

- #2 — PMM → pjson persistent data stack;
- #3 — MTS semantics/runtime/proof + independent visual lane;
- #4 — mast-calculator physical/normative verification;
- #5 — isocubic / God Mode / MetaMode boundary;
- #6 — repo-guard governance rollout;
- #7 — termowood + aes safety/commissioning;
- #8 — legacy/oracle/archive/incubation hygiene;
- #9 — research incubation;
- #11 — общий vision и associative-computing trajectories;
- #13 — portfolio control plane bootstrap/live sync;
- #16 — backlink rollout во все дочерние repositories.

**Актуальное open/closed состояние этих workstreams не поддерживается вручную здесь — оно находится в [`STATUS.md`](STATUS.md).**

## Главные архитектурные правила

1. **One canonical owner per layer.**
2. **One public repository = one permanent repository-developer Agent Role.**
3. **Public Agent Control Plane must not expose non-public repositories.**
4. **Worker control-plane access is API-only; cloning `roadmap` is reserved for actual Role #49 roadmap implementation work.**
5. **Git is the archive.** После migration obsolete implementation удаляется.
6. **No compatibility layer without a named removal gate.**
7. **Research ≠ accepted production contract.**
8. **Persistence identity ≠ process address.**
9. **Frontend syntax ≠ runtime semantic universe.**
10. **Interpret/find/inspect ≠ realize/mutate.**
11. **Engineering and physical safety evidence outranks feature growth.**
12. **Optimization/hardware ≠ second semantics.**
13. **Future vision never bypasses current correctness gates.**

## Актуальность

`portfolio-sync` обновляет только committed portfolio snapshot:

- после изменения portfolio inputs на `main`;
- каждые 6 часов;
- вручную через `workflow_dispatch`.

Он сверяет registry со всем public owner scope `netkeep80`, проверяет tracked issues и обновляет только `STATUS.md` / `data/status.json`.

`agent-status` обновляет [permanent Issue #103](https://github.com/netkeep80/roadmap/issues/103):

- на lifecycle-событиях структурированных Role / Session / Message issues;
- на Checkpoint comments;
- после изменения agent-status runtime на `main`;
- каждые 15 минут для lease / `STALE_CANDIDATE` aging;
- вручную через `workflow_dispatch`.

`agent-status` **не использует `actions/checkout`**: минимальный runtime читается через GitHub Contents API, а status body обновляется через GitHub Issues API.

`portfolio-validate` на PR дополнительно проверяет live GitHub coverage и разрешимость tracked gates до merge.

Если sync красный, соответствующую производную проекцию следует считать потенциально stale; source of truth при этом остаётся live GitHub state.

## Для автоматических агентов

Нормальный вход — permanent Agent Role issue URL. Получив её, следовать [`AGENTS.md`](AGENTS.md) и [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md).

Все bootstrap/control-plane reads из `netkeep80/roadmap` выполнять через GitHub API. Не клонировать `roadmap` ради orientation/status/coordination. Checkout `roadmap` допустим только если выбранная executable работа сама относится к Role #49 / `netkeep80/roadmap`.

Если агент ещё не получил Role URL, для portfolio orientation через GitHub Contents API читать:

```text
data/portfolio.json
data/status.json
EXECUTION.md
```

Затем переходить в local epic/issue и, если требуется кодовая работа, checkout-ить только выбранный target repository.

Если observed state противоречит записанному `next_gate`, не менять priority/ownership автоматически: оформить explicit portfolio update в этом repository.
