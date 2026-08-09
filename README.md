# netkeep80 roadmap — portfolio control plane

[![Portfolio validate](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-validate.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-validate.yml)
[![Portfolio sync](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-sync.yml/badge.svg)](https://github.com/netkeep80/roadmap/actions/workflows/portfolio-sync.yml)

**Это главный центр управления и развития репозиториев [`netkeep80`](https://github.com/netkeep80).**

Если нужно понять, **что сейчас происходит, что важнее, что заблокировано, какой проект владеет каким слоем и что делать следующим**, начинать нужно отсюда.

## Start here

| Что нужно узнать | Куда смотреть |
|---|---|
| **Что происходит прямо сейчас** | [`STATUS.md`](STATUS.md) — generated live portfolio board |
| **Что делать раньше/позже** | [`EXECUTION.md`](EXECUTION.md) — dependency lanes and gates |
| **Зачем существует вся программа** | [`VISION.md`](VISION.md) |
| **Кто чем владеет и как связаны слои** | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| **Подробная роль каждого repository** | [`REPOSITORIES.md`](REPOSITORIES.md) |
| **Куда может развиваться ассоциативная архитектура** | [`ASSOCIATIVE_COMPUTING.md`](ASSOCIATIVE_COMPUTING.md) |
| **Как поддерживается актуальность** | [`OPERATING_MODEL.md`](OPERATING_MODEL.md) |
| **Почему были приняты ключевые решения** | [`DECISIONS.md`](DECISIONS.md) |
| **Machine-readable portfolio intent** | [`data/portfolio.json`](data/portfolio.json) |
| **Machine-readable observed GitHub state** | [`data/status.json`](data/status.json) |

> `STATUS.md` — единственный человекочитаемый источник **текущих open/closed GitHub facts**. Статические документы не должны вручную дублировать состояние issue/PR.

## Authority model

В portfolio разделены **решения** и **факты**.

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
(open/closed issues, PRs, timestamps, archive/default branch)
```

Это означает:

- `roadmap` владеет **portfolio direction**;
- local repositories владеют **implementation backlog**;
- GitHub API владеет наблюдаемыми фактами;
- автоматика **не меняет архитектурные приоритеты сама**;
- новый public repository, не зарегистрированный в `data/portfolio.json`, считается control-plane drift.

Подробно: [`OPERATING_MODEL.md`](OPERATING_MODEL.md).

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

aprover / jsonRVM / tooling
  proof, differential oracle, inspection, migration evidence
```

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

### 2. Factual loop

```text
GitHub repositories/issues/PRs
→ portfolio-sync
→ STATUS.md + data/status.json
```

### 3. Dependency loop

```text
upstream gate closes / new blocker appears
→ generated status records the fact
→ evaluate portfolio impact
→ explicit decision updates registry/execution order
→ consumer migration
→ legacy deletion
```

Именно этот цикл уже обнаружил новый `anum_docs#200–#202` foundation reset и привёл к явному обновлению P0 ordering вместо скрытого рассинхрона.

## Cross-repo workstreams

Главные workstreams живут как issues этого repository и одновременно зарегистрированы в `data/portfolio.json`:

- #2 — PMM → pjson persistent data stack;
- #3 — МТС → AVM → aprover;
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
2. **Git is the archive.** После migration obsolete implementation удаляется.
3. **No compatibility layer without a named removal gate.**
4. **Research ≠ accepted production contract.**
5. **Persistence identity ≠ process address.**
6. **Frontend syntax ≠ runtime semantic universe.**
7. **Interpret/find/inspect ≠ realize/mutate.**
8. **Engineering and physical safety evidence outranks feature growth.**
9. **Optimization/hardware ≠ second semantics.**
10. **Future vision never bypasses current correctness gates.**

## Актуальность

`portfolio-sync` запускается:

- после изменения control-plane inputs на `main`;
- каждые 6 часов;
- вручную через `workflow_dispatch`.

Он сверяет registry со всем public owner scope `netkeep80`, проверяет tracked issues и обновляет generated status только при изменении фактического состояния.

`portfolio-validate` на PR дополнительно проверяет live GitHub coverage и разрешимость tracked gates до merge.

Если sync красный, factual snapshot следует считать потенциально stale и исправлять это как **control-plane incident**.

## Для автоматических агентов

Не исследовать весь GitHub account заново, если задача требует portfolio orientation.

Сначала читать:

```text
data/portfolio.json
data/status.json
EXECUTION.md
```

Затем переходить в указанный local epic/issue.

Если observed state противоречит записанному `next_gate`, не менять priority автоматически: оформить explicit portfolio update в этом repository.
