# netkeep80 roadmap

Единая дорожная карта по репозиториям [`netkeep80`](https://github.com/netkeep80).

**Срез:** 2026-08-09. В аккаунте 24 репозитория, включая этот `roadmap`; ниже классифицированы 23 project/source repositories и сам portfolio-control repo.

Цель этого репозитория — не копировать локальные backlog-и, а показывать **границы ответственности, зависимости, блокеры и порядок принятия решений между проектами**.

## Общий замысел

За отдельными репозиториями стоит более общий исследовательский вопрос:

> Можно ли построить вычислительную среду, где связь является универсальным структурным примитивом, ассоциативный поиск — базовой операцией, память персистентна по замыслу, а программы, данные, контекст и состояние выражаются разными ролями одной связевой структуры?

Текущие проекты можно читать как последовательные эксперименты над разными слоями этой идеи:

```text
МТС / anum_docs
  что означает связевая модель и где проходят semantic boundaries
        ↓
AVM
  как canonical links становятся исполняемой Relations Model
        ↕
PersistMemoryManager
  как долговременно существует relocatable persistent address space
        ↓
pjson
  как этот persistence substrate ведёт себя на практических structured data

aprover / jsonRVM / tooling
  proof, differential oracle, inspection, migration evidence
```

Цель не состоит в механическом переписывании всех приложений «на графы». Более сильный критерий: **может ли небольшой набор relational primitives реально заменить несколько независимых representations, storage layers, query paths и execution-specific structures**.

Ближайшая реалистичная цель — не новый физический процессор, а **persistent associative runtime**: canonical LinkStore + link-native execution + explicit effects + долговременное program/data/state space. Custom hardware рассматривается только как более дальняя специализация после измерений реальных workloads.

Полное описание: [`VISION.md`](VISION.md). Варианты дальнейшей архитектуры — от software VM и persistent single-space до associative coprocessor, dataflow execution, distributed fabric и link-oriented hardware — в [`ASSOCIATIVE_COMPUTING.md`](ASSOCIATIVE_COMPUTING.md).

## Главные решения

1. **Persistent data stack:** `PersistMemoryManager` остаётся storage kernel, `pjson` — единственным владельцем persistent JSON semantics. Сначала закрывается PMM→pjson readiness gate, затем развивается JSON/API/codec слой. См. #2.
2. **МТС / Relations Model:** `anum_docs` — normative source; `avm` — будущий canonical link-native runtime; `aprover` — downstream proof/search consumer; `jsonRVM` — frozen oracle для differential migration, а не второй будущий runtime. См. #3.
3. **Инженерные расчёты:** у `mast-calculator` следующий главный риск — физическая/нормативная верификация dynamic wind и erection stages, а не новая UI-функциональность. См. #4.
4. **Product recovery:** `isocubic` следует Phase 15 core-first roadmap; связь `god-mode` / MetaMode / legacy dev-tool surface должна быть явно разрешена до дальнейшего extraction. См. #5.
5. **Shared governance:** `repo-guard` развивается от реальных consumer cases и постепенно становится baseline активных репозиториев. См. #6.
6. **Physical systems:** `termowood` и `aes` идут через safety/commissioning/as-built gates прежде feature growth. См. #7.
7. **Legacy не конкурирует с current:** oracle/history/archive/placeholder роли помечаются явно. См. #8.
8. **Research остаётся research:** `NNets`, `meta_rm`, `mts-genesis` получают проверяемые exit criteria вместо бесконечного feature growth. См. #9.
9. **Long-term associative computing:** общий замысел и будущие software/hardware trajectories являются отдельным vision track и не обходят текущие correctness gates. См. #11.

## Приоритеты

- **P0 — blocking foundations / high-consequence correctness.** Закрытие этих gates меняет возможность безопасно развивать зависимые проекты.
- **P1 — active consolidation.** Делать параллельно с P0, когда нет зависимости от незакрытого foundation.
- **P2 — research, migration cleanup, portfolio hygiene.** Важно, но не должно оттеснять blocking foundations.
- **P3 — incubation/maintenance.** Разработка только при появлении конкретного consumer/charter.

## Portfolio dashboard

| Репозиторий | Роль | Priority | Следующий milestone |
|---|---|---:|---|
| `PersistMemoryManager` | persistent storage kernel | **P0** | закрыть `#410/#415/#416/#426 → #421` для pjson object storage |
| `pjson` | persistent JSON semantics | **P0** | после `PMM#421`: `#55 → #34`, затем traversal/path/CRUD/codec/persistence chain |
| `anum_docs` | normative МТС/Anum contracts | **P0** | v0.6 candidate `#194 → #195..#199`; production cutover только после acceptance |
| `avm` | link-native Relations Model runtime | **P0** | AVM 1.5 `#122`; canonical values/native duplet frontend/differential jsonRVM migration |
| `aprover` | trusted-replay consumer + untrusted search/UI | **P0/P1** | не опережать accepted `anum_docs`; exact repin и multi-step consumer после upstream gate |
| `mast-calculator` | engineering calculation product | **P0** | dynamic SP20/modal + erection-stage validation (`#71/#97/#102/#72/#98`) |
| `repo-guard` | shared executable governance | **P1** | consumer-driven rollout и immutable pins across active repos |
| `BinDiffSynchronizer` | sync/diff product + pjson migration oracle | **P1/P2** | портировать pjson fixtures; после `pjson#44` удалить duplicate persistent-JSON stack |
| `isocubic` | parametric cube/editor/rendering product | **P1** | Phase 15 `#299`: strict CI → domain → rendering/FFT/editor → browser E2E |
| `god-mode` | standalone dev-tool React library | **P1/P2** | определить relation to isocubic MetaMode; затем consumer-driven package backlog |
| `termowood` | embedded thermostat / physical controller | **P1** | fail-safe matrix, calibration, HIL/bench commissioning, OTA recovery |
| `aes` | home autonomous-energy engineering docs | **P1** | reviewed wiring freeze → staged commissioning → measured as-built documentation |
| `NNets` | experimental self-structuring NN library | **P2** | reproducible benchmark/evidence milestone before new algorithms |
| `meta_rm` | C++ compile-time relations research | **P2** | freeze tiny kernel; 2–3 use cases + compile-cost evidence; promote/archive decision |
| `mts-genesis` | conceptual/publication layer | **P2** | keep self-contained; route formalizable claims into `anum_docs` research gates |
| `jsonRVM` | frozen Relations Model semantic oracle | **P2** | corpus/provenance only until AVM differential migration closes; no new runtime architecture |
| `phprvm` | historical Relations Model predecessor | **P3/archive** | status banner/provenance; archive after useful migration references are linked |
| `associative_proofs` | historical pointer to moved proofs | **P3/archive** | mark archive/read-only; canonical work remains in destination/current theory repos |
| `a-num-` | historical Anum associative-DB example | **P3/archive** | point to canonical current theory/examples; no parallel semantic development |
| `usefull` | small generic Python utilities | **P3/maintenance** | maintenance only for demonstrated consumers; otherwise freeze |
| `sample_cmake` | placeholder | **P3/incubation** | charter with consumer + acceptance test, or archive |
| `jgit` | placeholder | **P3/incubation** | charter with problem/consumer/dependencies, or archive |
| `jhub` | placeholder | **P3/incubation** | charter with problem/consumer/dependencies, or archive |
| `roadmap` | portfolio control plane | **P1** | maintain dependency map + cross-repo gates; never duplicate local implementation backlog |

Подробный разбор каждого репозитория: [`REPOSITORIES.md`](REPOSITORIES.md). Архитектурные границы и dependency graph: [`ARCHITECTURE.md`](ARCHITECTURE.md). Порядок исполнения: [`EXECUTION.md`](EXECUTION.md).

## Cross-repo workstreams

- #1 — portfolio epic;
- #2 — PMM → pjson;
- #3 — МТС → AVM → aprover;
- #4 — mast-calculator verification;
- #5 — isocubic / god-mode / MetaMode boundary;
- #6 — repo-guard rollout;
- #7 — termowood + aes safety/commissioning;
- #8 — legacy/archive/placeholder hygiene;
- #9 — research incubation;
- #11 — общий vision и траектории ассоциативной вычислительной архитектуры.

## Как поддерживать roadmap

Обновлять central roadmap нужно **по событию**, а не переписывать его после каждого локального PR:

- принят/изменён cross-repo contract;
- закрылся blocking readiness gate;
- canonical owner слоя изменился;
- legacy consumer полностью мигрирован и старый implementation можно удалить;
- research hypothesis получила acceptance/rejection;
- проект перешёл между `active / oracle / maintenance / incubation / archive`.

Локальные детали реализации остаются в issues соответствующего репозитория. Git хранит историю; central roadmap описывает только актуальную систему.