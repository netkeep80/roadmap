# Operating model — как `roadmap` управляет portfolio

`netkeep80/roadmap` — **главная точка входа и portfolio source of truth** для всех репозиториев `netkeep80`.

Он не заменяет локальные issue trackers. Он отвечает за уровень выше отдельного репозитория: общий замысел, приоритеты, ownership, зависимости, cross-repo gates и lifecycle проектов.

## 1. Иерархия источников истины

| Вопрос | Source of truth |
|---|---|
| Зачем существует вся программа? | `VISION.md` |
| К какой архитектуре она может привести? | `ASSOCIATIVE_COMPUTING.md` |
| Кто владеет semantic/storage/runtime layer? | `ARCHITECTURE.md` + `data/portfolio.json` |
| Какой repository сейчас P0/P1/P2/P3? | `data/portfolio.json` |
| Каков lifecycle проекта? | `data/portfolio.json` |
| Какой следующий portfolio gate? | `data/portfolio.json` |
| Какие cross-repo workstreams активны? | roadmap issues + `data/portfolio.json` |
| Что фактически открыто/закрыто на GitHub? | generated `STATUS.md` / `data/status.json` |
| Каков порядок исполнения между lanes? | `EXECUTION.md` |
| Что конкретно реализовать в одном проекте? | local epic/issues соответствующего repository |
| Почему изменилось portfolio-level решение? | `DECISIONS.md` + соответствующий PR/issue |

Главное правило:

```text
roadmap decides direction;
local repositories execute it;
GitHub API reports facts.
```

## 2. Что редактируется человеком

`data/portfolio.json` — канонический machine-readable registry осознанных решений.

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

Эти поля нельзя менять автоматически только потому, что закрылся issue. Закрытие issue — факт; вывод «теперь следующий приоритет другой» — архитектурное решение.

## 3. Что генерируется автоматически

`scripts/sync-roadmap.mjs` получает из GitHub:

- полный список public owner repositories;
- archive/default-branch state;
- timestamps;
- количество открытых issues и PR;
- состояния tracked issues;
- состояния portfolio workstream issues.

Результат:

- `STATUS.md` — человекочитаемый control board;
- `data/status.json` — machine-readable factual snapshot.

Эти файлы **не редактируются вручную**.

## 4. Drift policy

### Новый repository

Если в `netkeep80` появился новый public repository, которого нет в `data/portfolio.json`, sync должен завершиться ошибкой.

Новый проект не считается частью управляемого portfolio, пока в одном осознанном PR не определены:

1. роль;
2. lifecycle;
3. priority;
4. objective;
5. next gate;
6. зависимости;
7. canonical ownership, если он что-либо канонизирует;
8. portfolio workstream либо явная причина его отсутствия.

### Исчезнувший repository

Если зарегистрированный public repository исчез или стал недоступен, sync также падает. Нельзя тихо удалять его из карты: сначала нужно принять portfolio decision — rename/move/private/archive/delete.

## 5. Lifecycle vocabulary

- `control-plane` — управляющий repository.
- `active` — проект активно развивает принятый target.
- `blocked` — следующий meaningful gate зависит от upstream contract.
- `transitional` — проект существует во время migration и должен потерять часть прежней ответственности.
- `research` — hypothesis/evidence-driven работа без production commitment.
- `oracle` — feature-frozen источник поведения/provenance для migration.
- `maintenance` — изменения только под реального consumer/bug.
- `incubation` — нужен charter/consumer до существенной разработки.
- `archive-candidate` — полезная история, но active development не планируется.

Lifecycle — не оценка качества проекта. Это инструкция, **как с ним обращаться сейчас**.

## 6. Priority vocabulary

- `P0` — blocking foundation или correctness с высоким системным последствием.
- `P0/P1` — важный consumer, который частично заблокирован P0 upstream.
- `P1` — active consolidation, product recovery, safety или governance.
- `P1/P2` — полезный transitional/support проект без права вытеснять P0.
- `P2` — research, migration cleanup, portfolio hygiene.
- `P3` — maintenance/incubation/archive work только по явной причине.

Приоритет принадлежит portfolio, а не количеству открытых issues.

## 7. Gate transition protocol

Когда закрывается важный local gate:

1. generated status фиксирует факт автоматически;
2. проверяется, изменился ли cross-repo dependency;
3. если изменился — обновляется `data/portfolio.json`;
4. при необходимости обновляются `EXECUTION.md` / `ARCHITECTURE.md`;
5. significant decision записывается в `DECISIONS.md`;
6. obsolete compatibility path получает removal action, а не бессрочный статус legacy.

Нельзя считать цепочку завершённой только по числу закрытых issues. Exit criterion должен быть проверяемым.

## 8. Workstream discipline

Portfolio issue в `roadmap` описывает только:

- cross-repo problem;
- canonical ownership;
- gate sequence;
- vetoes;
- exit criterion.

Он **не копирует** десятки локальных implementation tasks.

Если задача не меняет другой repository и не меняет portfolio-level decision, она должна жить локально.

## 9. Automation

### `portfolio-validate.yml`

На PR проверяет:

- JSON registry parseability;
- schema/invariants;
- уникальность repository/workstream identities;
- разрешимость dependencies внутри registry.

### `portfolio-sync.yml`

На `main`:

- запускается после изменения control-plane inputs;
- запускается по расписанию каждые 6 часов;
- доступен через `workflow_dispatch`;
- сверяет registry с public GitHub owner scope;
- генерирует `STATUS.md` и `data/status.json`;
- коммитит только factual snapshot, если он изменился.

Workflow не меняет `data/portfolio.json`.

## 10. Freshness and failure semantics

Если sync зелёный, `STATUS.md` является последним сохранённым подтверждённым snapshot GitHub state.

Если sync красный:

- semantic registry остаётся source of truth для intent;
- factual status считается потенциально stale;
- failure надо трактовать как control-plane incident, а не игнорировать.

Особенно важны failures:

- unregistered repository;
- missing registered repository;
- GitHub API failure;
- broken tracked issue reference;
- script/schema failure.

## 11. Decision classes

Изменение требует записи в `DECISIONS.md`, если оно меняет хотя бы одно из:

- canonical owner;
- dependency direction;
- repository lifecycle;
- P0/P1 boundary;
- accepted foundation semantics;
- long-term architecture recommendation;
- правила control-plane governance.

Обычное уточнение текста или автоматически обновлённый factual status ADR не требует.

## 12. Как пользоваться repository

Для ежедневной ориентации:

```text
README
  ↓
STATUS.md          — что происходит сейчас
  ↓
EXECUTION.md       — что делать раньше/позже
  ↓
local epic/issue   — конкретная реализация
```

Для архитектурного понимания:

```text
VISION.md
  ↓
ARCHITECTURE.md
  ↓
ASSOCIATIVE_COMPUTING.md
  ↓
DECISIONS.md
```

Для автоматизации/агентов:

```text
data/portfolio.json   — intent / semantics
data/status.json      — observed facts
```

Это разделение позволяет использовать `roadmap` и человеку, и автоматическому агенту без необходимости каждый раз заново исследовать весь GitHub account.
