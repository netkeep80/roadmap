# Operating model — как `roadmap` управляет public portfolio и AI-агентами

`netkeep80/roadmap` — **главная точка входа, portfolio source of truth и public Agent Control Plane** для public repositories владельца `netkeep80`.

Он не заменяет локальные issue trackers и не является вторым merge coordinator. Его уровень ответственности выше отдельного репозитория: общий замысел, priority/lifecycle, canonical ownership, cross-repo dependencies/gates, observed public GitHub facts и durable coordination между repository-developer агентами.

## 1. Scope и privacy boundary

Semantic scope control plane:

```text
public repositories owned by netkeep80 only
```

Техническая GitHub-аутентификация не расширяет этот scope. Даже если credential способен видеть non-public repository, текущие portfolio/agent validators обязаны отфильтровать его **до** построения рабочего набора.

Public control plane не хранит для non-public repositories:

- имя или URL;
- issue/PR identifiers;
- commit SHA;
- lifecycle/status;
- Agent Role;
- dependency/blocker;
- косвенную запись, существующую только ради описания такого repository.

Любая repository reference внутри Agent protocol должна resolve-иться в текущий public `data/portfolio.json`. Unknown/non-public reference fail closed.

Если repository покидает public scope, это explicit portfolio transition: active public role/session coordination прекращается, current generated projections очищаются, а новые факты из non-public source сюда не импортируются. Уже опубликованную Git/GitHub history нельзя ретроактивно сделать секретной, но control plane перестаёт её обновлять.

## 2. Иерархия источников истины

| Вопрос | Source of truth |
|---|---|
| Зачем существует вся программа? | `VISION.md` |
| К какой архитектуре она может привести? | `ASSOCIATIVE_COMPUTING.md` |
| Кто владеет semantic/storage/runtime/presentation layer? | `ARCHITECTURE.md` + `data/portfolio.json` |
| Priority / lifecycle / objective / next gate / dependencies | `data/portfolio.json` |
| Какие cross-repo workstreams активны? | roadmap issues + `data/portfolio.json` |
| Что фактически открыто/закрыто на public GitHub? | generated `STATUS.md` / `data/status.json` |
| Каков порядок исполнения между lanes? | `EXECUTION.md` |
| Что конкретно реализовать в одном проекте? | local epic/issues соответствующего repository |
| Почему изменилось portfolio-level решение? | `DECISIONS.md` + соответствующий PR/issue |
| Какая permanent AI-role соответствует repository? | open `roadmap-agent-role/v1` issue |
| Где текущий durable execution context роли? | Agent Session + Checkpoint comments |
| Какие cross-repo requests/blockers ждут роли? | Agent Message issues |
| Можно ли конкретный PR интегрировать? | local CI / repo-guard protocol, если он настроен |

Главное разделение:

```text
data/portfolio.json = intent / decisions
GitHub live state    = observed facts
Agent Issues         = execution coordination
local repository     = implementation
repo-guard / CI      = change + integration correctness
```

Automation не превращает observed fact в portfolio decision сама.

## 3. Что редактируется человеком

`data/portfolio.json` — единственный human-maintained machine-readable registry portfolio semantics.

В нём вручную меняются:

- `priority`;
- `lifecycle`;
- `role`;
- `canonical_for`;
- `objective`;
- `next_gate`;
- `depends_on`;
- `roadmap_issues`;
- `local_epics`;
- `tracked_issues`;
- top-level `workstreams`.

Закрытие issue, merge PR или появление нового release — факт. Вывод «теперь меняется canonical owner / dependency / priority / lifecycle» требует explicit roadmap change.

Отдельный manually-maintained registry Agent Roles **не создаётся**. Permanent Role identity живёт в самой GitHub issue; repository set берётся из `data/portfolio.json` и live public-owner validation.

## 4. Portfolio factual sync

`scripts/sync-roadmap.mjs` получает public GitHub facts:

- public owner repositories;
- archive/default-branch state;
- timestamps;
- количество открытых issues и PR;
- tracked issue/workstream states;
- root `PORTFOLIO.md` backlinks child repositories.

Результат:

- `STATUS.md` — human-readable control board;
- `data/status.json` — machine-readable factual snapshot.

Generated files не редактируются вручную.

Snapshot различает:

- `checked_at` — когда GitHub state успешно перечитан;
- `latest_observed_github_change` — самый свежий timestamp внутри observed facts.

Backlink coverage считается динамически; никаких захардкоженных `23/23`, `24/24` и т.п. в governance contract быть не должно.

## 5. Portfolio drift policy

### Новый public repository

Если live public owner scope содержит repository вне `data/portfolio.json`, validation/sync завершается ошибкой.

До регистрации explicit roadmap transition должен определить:

1. role;
2. lifecycle;
3. priority;
4. objective;
5. next gate;
6. dependencies;
7. canonical ownership, если есть;
8. workstream либо явную причину его отсутствия.

После регистрации child repository получает stable root `PORTFOLIO.md` backlink. Затем Agent Role reconciler создаёт ровно одну permanent repository-developer role.

### Repository исчез/покинул public scope

Нельзя тихо удалять его из registry. Сначала explicit decision: rename/move/private/archive/delete; затем public Agent Role deactivation и cleanup current generated state.

### Backlink drift

Missing/invalid child `PORTFOLIO.md` является hard failure.

### Workstream status drift

`registry=active` при closed issue или `registry=completed` при open issue — warning, требующий explicit semantic reconciliation. Broken issue reference — hard failure.

## 6. Repository lifecycle vocabulary

- `control-plane` — управляющий repository;
- `active` — развивается принятый target;
- `blocked` — meaningful next gate зависит от upstream contract;
- `transitional` — migration repository, который должен потерять часть старой ответственности;
- `research` — hypothesis/evidence-driven работа без production commitment;
- `oracle` — feature-frozen source of behavior/provenance;
- `maintenance` — изменения под реального consumer/bug;
- `incubation` — нужен charter/consumer прежде существенной разработки;
- `archive-candidate` — полезная история без planned active feature growth.

Lifecycle — инструкция поведения Agent Role, а не оценка качества проекта.

## 7. Priority vocabulary

- `P0` — blocking foundation/correctness;
- `P0/P1` — важный consumer, частично зависящий от P0 upstream;
- `P1` — active consolidation/product/safety/governance;
- `P1/P2` — transitional/support work;
- `P2` — research/migration cleanup/portfolio hygiene;
- `P3` — maintenance/incubation/archive work только по явной причине.

Agent не выводит priority из количества issues и не повышает его сам.

## 8. One public repository = one permanent Agent Role

Для каждого repository в exact live public scope существует ровно одна open permanent issue:

```text
[Agent Role] <repository> developer
```

Machine block:

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

`roadmap` получает ту же repository-developer role, но `portfolio_authority=coordinate`.

Role issue URL — полный bootstrap identity. Человеку достаточно передать агенту одну ссылку. Алгоритм входа — [`AGENTS.md`](AGENTS.md), machine protocol — [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md).

Permanent role не содержит динамический current SHA/PR/lifecycle snapshot. Новый агент всегда перечитывает current portfolio/live/local state.

Required invariant после rollout:

```text
live public owner repositories
== registered repositories in data/portfolio.json
== repositories represented by exactly one active Agent Role
```

## 9. Sessions, checkpoints, claims, messages

### Session

Конкретный рабочий отрезок хранится отдельной `[Agent Session]` issue. Session содержит compact operational state, claims/current PR/blockers; длинная история идёт checkpoints.

### Checkpoint

Checkpoint хранит только resumable public facts/decisions/evidence/next action. Hidden chain-of-thought не сохраняется.

Fresh GitHub state всегда сильнее stale checkpoint.

### Claim

Claim предотвращает случайное дублирование одной local issue/PR, но не блокирует repository целиком и не даёт merge authority.

Collision:

```text
earlier Session created_at wins
then lower Session issue number
```

### Message

Durable cross-repo coordination хранится отдельной `[Agent Message]` issue. Local implementation discussion остаётся в local repository.

Finite message kinds/states определены в `AGENT_PROTOCOL.md`.

## 10. Agent refresh protocol

Получив Role URL, агент обязан прочитать central sources и exact local state до mutation.

Refresh выполняется минимум:

- at session start;
- before selecting/claiming work;
- after dependency/blocker message;
- before every repository write;
- before PR draft/ready/integration transition;
- after merge/closure of dependency gate;
- before handoff/completion.

Для target repository reread включает actual default-branch SHA, open issues, open PRs, exact workflows, repo policy/repo-guard, blocking checks и relevant PR head/base/mergeability state.

## 11. repo-guard boundary

Agent Control Plane не реализует второй merge queue и не решает integration correctness самостоятельно.

`roadmap` отвечает:

```text
who owns the repository?
what should be inspected/worked on?
who else is working?
what is claimed?
what cross-repo message/blocker exists?
```

`repo-guard`/local CI отвечает:

```text
is this exact change valid?
is this exact integration candidate valid?
what next_action is allowed?
```

Если repo-guard отсутствует, агент следует реально существующим local workflows/rules и не выдумывает несуществующую protection surface.

## 12. Automation

### `portfolio-validate.yml`

На PR проверяет:

- registry schema/invariants;
- live public-owner coverage;
- tracked issue/workstream references;
- child backlink coverage;
- Agent protocol unit tests;
- Agent Control Plane public-only validation.

До первого полного Role rollout missing roles являются advisory diagnostics. После bootstrap отдельный hardening transition переключает exact role coverage в blocking mode.

### `agent-roles.yml`

После accepted changes на `main`:

1. перечитывает registry;
2. получает и **до projection фильтрует** live inventory до public repositories;
3. проверяет exact live-public/registry equality;
4. парсит existing Role issues;
5. идемпотентно создаёт только missing permanent roles;
6. повторно валидирует complete 1:1 coverage.

Workflow сериализован через concurrency group и имеет только `contents: read`, `issues: write`.

### `portfolio-sync.yml`

Продолжает factual sync; не меняет semantic registry и не является write path для Agent Sessions/Messages.

## 13. Gate transition protocol

Когда закрывается важный local gate:

1. observed status фиксирует факт;
2. originating Role при необходимости отправляет durable cross-repo Message;
3. downstream Role ACK/revalidates свою local boundary;
4. если реально изменился portfolio dependency/ownership/priority/lifecycle — создаётся explicit roadmap change;
5. significant decision записывается в `DECISIONS.md`;
6. obsolete path получает removal action, а не бессрочный legacy status.

Количество закрытых issues само по себе не является exit criterion.

## 14. Decision classes

`DECISIONS.md` обязателен для изменений хотя бы одного из:

- canonical owner;
- dependency direction;
- repository lifecycle;
- P0/P1 boundary;
- accepted foundation semantics;
- long-term architecture recommendation;
- control-plane governance rules.

Обычный factual sync и local implementation detail ADR не требуют.

## 15. Discoverability

Каждый child public repository имеет stable root `PORTFOLIO.md`:

```text
child repository
→ PORTFOLIO.md
→ central roadmap
→ STATUS / EXECUTION / ARCHITECTURE
```

Для AI entrypoint direction обратная:

```text
permanent Role issue URL
→ AGENTS.md / AGENT_PROTOCOL.md
→ central portfolio/live state
→ target repository PORTFOLIO.md + local backlog
→ Session / work / Message / Checkpoint
```

Таким образом пользователь может запускать/перезапускать repository developer agent одной и той же URL без переноса chat checkpoint вручную.
