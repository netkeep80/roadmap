# Current portfolio status

> **GENERATED FILE — DO NOT EDIT.** Semantic decisions come from [`data/portfolio.json`](data/portfolio.json); factual GitHub state is collected by `scripts/sync-roadmap.mjs`.

- Owner: `netkeep80`
- Registered repositories: **25**
- Verified child roadmap backlinks: **24/24**
- Last successful GitHub check: **2026-08-16T18:48:24.286Z**
- Latest observed GitHub change in snapshot: **2026-08-16T13:02:21Z**
- State hash (excluding check time): `a38d9924a568249c387ae699fd5c1f1989c7fddd618f495e40dd05f015aa6fa3`

## Control-plane health

- ✅ Child backlink coverage: 24/24.
- ✅ No declared workstream-status drift detected.

## Portfolio workstreams

| Priority | Workstream | Declared status | GitHub state | Next gate |
|---:|---|---|---|---|
| **P0** | [#2](https://github.com/netkeep80/roadmap/issues/2) PMM → pjson persistent data stack | `active` | 🟡 open | PMM readiness → pjson pin/object storage → pjson 1.0 extraction |
| **P0** | [#3](https://github.com/netkeep80/roadmap/issues/3) МТС → AVM → aprover | `active` | 🟡 open | anum_docs accepted MTS v0.7 is now the production baseline; aprover#152 exact-pins/replays it next; anum_parser remains a non-normative lab consumer; AVM #174→#131 may continue and MTS-dependent frontend may consume v0.7 when locally required; anum_docs#122/#123 remain independent future versioned research |
| **P0** | [#4](https://github.com/netkeep80/roadmap/issues/4) mast-calculator physical verification | `active` | 🟡 open | dynamic SP20 + erection stages + independent verification passport |
| **P1** | [#5](https://github.com/netkeep80/roadmap/issues/5) isocubic / God Mode / MetaMode boundary | `active` | 🟡 open | isocubic Phase 15 core gates then provenance/consumer decision |
| **P1** | [#6](https://github.com/netkeep80/roadmap/issues/6) repo-guard shared governance rollout | `active` | 🟡 open | Tier A active repos use reproducible immutable-pinned policy |
| **P1** | [#7](https://github.com/netkeep80/roadmap/issues/7) termowood + aes safety/commissioning | `active` | 🟡 open | failure modes → protection → commissioning → as-built |
| **P1** | [#13](https://github.com/netkeep80/roadmap/issues/13) portfolio control plane | `completed` | ✅ closed | completed: live registry validation and scheduled/push factual sync proven on main |
| **P1** | [#16](https://github.com/netkeep80/roadmap/issues/16) child-repository backlink rollout | `completed` | ✅ closed | completed invariant: every current child default branch must keep a stable PORTFOLIO.md backlink |
| **P2** | [#8](https://github.com/netkeep80/roadmap/issues/8) portfolio hygiene | `active` | 🟡 open | status banners, charter-or-archive decisions, remove generic backlog noise |
| **P2** | [#9](https://github.com/netkeep80/roadmap/issues/9) research incubation | `active` | 🟡 open | each research repo has question + evidence + decision point |
| **P2** | [#11](https://github.com/netkeep80/roadmap/issues/11) overall vision / associative computing futures | `completed` | ✅ closed | completed; vision evolves only through explicit decisions |

## Executive board

| Priority | Repository | Lifecycle | Current objective | Next portfolio gate | GitHub | Roadmap |
|---:|---|---|---|---|---|---|
| **P0** | [`anum_docs`](https://github.com/netkeep80/anum_docs) | `active` | поддерживать accepted MTS v0.7 как единственный production/reference runtime и развивать новые semantics только через отдельные versioned research/acceptance gates | accepted v0.7 production baseline закрыт через #237/#271/#403; #122 proof calculus и #123 relative Anum продолжаются как независимые research/versioned extensions без мутации v0.7 | 6 issues / 0 PRs | [#3](https://github.com/netkeep80/roadmap/issues/3) |
| **P0** | [`avm`](https://github.com/netkeep80/avm) | `active` | закрыть AVM 1.5 перенос существенной jsonRVM semantics в единый link-native execution path, не форкая accepted МТС semantics | #174 semantic migrator → #131 differential end-to-end; #169 remains Native JSON umbrella; MTS-dependent frontend may exact-repin accepted anum_docs v0.7 when a local gate requires it, without local alternative semantics | 0 issues / 0 PRs | [#3](https://github.com/netkeep80/roadmap/issues/3) |
| **P0** | [`mast-calculator`](https://github.com/netkeep80/mast-calculator) | `active` | закрыть физическую и нормативную верификацию dynamic wind и erection stages до дальнейшего feature growth | modal/eigen → #97/#102 dynamic SP20 → #72/#98 erection → verification passport | 11 issues / 1 PRs | [#4](https://github.com/netkeep80/roadmap/issues/4) |
| **P0** | [`PersistMemoryManager`](https://github.com/netkeep80/PersistMemoryManager) | `active` | закрыть consumer-shaped readiness для native persistent object storage pjson | #410/#415/#416/#426 → #421 | 15 issues / 6 PRs | [#2](https://github.com/netkeep80/roadmap/issues/2) |
| **P0** | [`pjson`](https://github.com/netkeep80/pjson) | `blocked` | довести pjson 1.0 до native PMM-backed JSON без private storage workaround | после PMM#421: #55 → #34, затем #35..#44 | 16 issues / 0 PRs | [#2](https://github.com/netkeep80/roadmap/issues/2) |
| **P0/P1** | [`aprover`](https://github.com/netkeep80/aprover) | `active` | оставаться exact consumer accepted anum_docs contracts и развивать search только поверх trusted replay | #152 exact-pin accepted MTS v0.7/current invariants while preserving historical replay; proof/search growth under #139 waits for separately accepted upstream proof semantics | 3 issues / 0 PRs | [#3](https://github.com/netkeep80/roadmap/issues/3) |
| **P1** | [`aes`](https://github.com/netkeep80/aes) | `active` | перевести проект от design assumptions к проверенному commissioning и as-built состоянию | design freeze → staged commissioning → measured as-built | 0 issues / 0 PRs | [#7](https://github.com/netkeep80/roadmap/issues/7) |
| **P1** | [`isocubic`](https://github.com/netkeep80/isocubic) | `active` | восстановить test-first product core и завершить dev-tool extraction boundary | #300 → #301 → #302/#303/#304 → #305 → #306/#307 | 12 issues / 1 PRs | [#5](https://github.com/netkeep80/roadmap/issues/5) |
| **P1** | [`repo-guard`](https://github.com/netkeep80/repo-guard) | `active` | раскатывать consumer-driven governance baseline без speculative DSL growth | Tier A active repos use reproducible immutable-pinned policy | 2 issues / 0 PRs | [#6](https://github.com/netkeep80/roadmap/issues/6) |
| **P1** | [`roadmap`](https://github.com/netkeep80/roadmap) | `control-plane` | быть единой точкой входа для актуального состояния, зависимостей, решений и направления развития всего portfolio | ongoing: поддерживать live control loop и явно reconciliate detected semantic drift | 9 issues / 0 PRs | [#1](https://github.com/netkeep80/roadmap/issues/1), [#13](https://github.com/netkeep80/roadmap/issues/13), [#16](https://github.com/netkeep80/roadmap/issues/16) |
| **P1** | [`termowood`](https://github.com/netkeep80/termowood) | `active` | закрыть failure-mode, independent cutoff, calibration, HIL/bench и OTA recovery evidence | safe-state matrix → protection → calibration/HIL → measured evidence | 0 issues / 0 PRs | [#7](https://github.com/netkeep80/roadmap/issues/7) |
| **P1/P2** | [`anum_parser`](https://github.com/netkeep80/anum_parser) | `research` | экспериментировать с сериализацией, десериализацией, визуализацией и альтернативными алгоритмами ачисел без создания второго нормативного источника МТС | exact-repin current umbrella provenance to accepted anum_docs v0.7 while retaining anum-deserialization/v0.4 as the active Anum leaf; experimental modes remain non-normative until accepted upstream | 0 issues / 0 PRs | [#3](https://github.com/netkeep80/roadmap/issues/3) |
| **P1/P2** | [`BinDiffSynchronizer`](https://github.com/netkeep80/BinDiffSynchronizer) | `transitional` | отдать persistent JSON ownership pjson, сохранить mature fixtures как migration evidence и оставить diff/sync responsibilities | pjson#41/#44 migration, затем удалить duplicate persistent-JSON implementation | 6 issues / 0 PRs | [#2](https://github.com/netkeep80/roadmap/issues/2), [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P1/P2** | [`god-mode`](https://github.com/netkeep80/god-mode) | `incubation` | разрешить точное отношение God Mode / MetaMode / isocubic consumer boundary до нового feature growth | provenance + consumer decision in roadmap#5 | 0 issues / 0 PRs | [#5](https://github.com/netkeep80/roadmap/issues/5) |
| **P2** | [`jsonRVM`](https://github.com/netkeep80/jsonRVM) | `oracle` | сохранять differential corpus/provenance до закрытия AVM migration | AVM#131 differential migration complete | 0 issues / 1 PRs | [#3](https://github.com/netkeep80/roadmap/issues/3), [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P2** | [`meta_rm`](https://github.com/netkeep80/meta_rm) | `research` | проверить ценность tiny compile-time relation kernel на representative use cases | freeze kernel → 2–3 use cases → compile-cost evidence → promote/bridge/archive | 0 issues / 0 PRs | [#9](https://github.com/netkeep80/roadmap/issues/9) |
| **P2** | [`mts-genesis`](https://github.com/netkeep80/mts-genesis) | `research` | дать самодостаточное концептуальное объяснение общей идеи, не создавая второй нормативной МТС | formalizable claims route into versioned anum_docs research beyond the accepted v0.7 production baseline | 0 issues / 0 PRs | [#9](https://github.com/netkeep80/roadmap/issues/9), [#11](https://github.com/netkeep80/roadmap/issues/11) |
| **P2** | [`NNets`](https://github.com/netkeep80/NNets) | `research` | получить воспроизводимое evidence преимущества/назначения архитектуры до роста algorithms | fixed datasets/seeds + baselines + serialization/retrain reproducibility + profiling | 0 issues / 0 PRs | [#9](https://github.com/netkeep80/roadmap/issues/9) |
| **P3** | [`a-num-`](https://github.com/netkeep80/a-num-) | `archive-candidate` | сохранить historical example и указывать на current canonical theory | canonical links + archive/read-only decision | 0 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P3** | [`associative_proofs`](https://github.com/netkeep80/associative_proofs) | `archive-candidate` | не изображать active semantic owner после переноса proof work | status banner and archive/read-only decision | 0 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P3** | [`jgit`](https://github.com/netkeep80/jgit) | `incubation` | определить problem/consumer/dependencies либо архивировать | charter + first acceptance test, or archive | 0 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P3** | [`jhub`](https://github.com/netkeep80/jhub) | `incubation` | определить problem/consumer/dependencies либо архивировать | charter + first acceptance test, or archive | 0 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P3** | [`phprvm`](https://github.com/netkeep80/phprvm) | `archive-candidate` | сохранить provenance, явно пометить historical status | status/provenance banner then archive/read-only decision | 0 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P3** | [`sample_cmake`](https://github.com/netkeep80/sample_cmake) | `incubation` | не наращивать scaffolding без charter | one-page charter + first consumer/acceptance test, or archive | 0 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |
| **P3** | [`usefull`](https://github.com/netkeep80/usefull) | `maintenance` | поддерживать только при наличии реальных consumers | demonstrated consumer or freeze | 1 issues / 0 PRs | [#8](https://github.com/netkeep80/roadmap/issues/8) |

## P0 / blocking gates

### anum_docs — active

**Objective:** поддерживать accepted MTS v0.7 как единственный production/reference runtime и развивать новые semantics только через отдельные versioned research/acceptance gates

**Next gate:** accepted v0.7 production baseline закрыт через #237/#271/#403; #122 proof calculus и #123 relative Anum продолжаются как независимые research/versioned extensions без мутации v0.7

- ✅ [#122](https://github.com/netkeep80/anum_docs/issues/122) `closed` — L5 v0.3: определить proof judgment и минимальный trusted calculus МТС
- ✅ [#123](https://github.com/netkeep80/anum_docs/issues/123) `closed` — L3 v0.3: relative Anum denotation поверх rooted identity #343

### avm — active

**Objective:** закрыть AVM 1.5 перенос существенной jsonRVM semantics в единый link-native execution path, не форкая accepted МТС semantics

**Next gate:** #174 semantic migrator → #131 differential end-to-end; #169 remains Native JSON umbrella; MTS-dependent frontend may exact-repin accepted anum_docs v0.7 when a local gate requires it, without local alternative semantics

**Depends on:** [`anum_docs`](https://github.com/netkeep80/anum_docs)

- ✅ [#122](https://github.com/netkeep80/avm/issues/122) `closed` — [Epic] AVM 1.5 — перенести семантику Relations Model из jsonRVM в link-native AVM
- ✅ [#169](https://github.com/netkeep80/avm/issues/169) `closed` — AVM Native JSON — каноническая дуплетная нотация и миграция формата jsonRVM
- ✅ [#174](https://github.com/netkeep80/avm/issues/174) `closed` — AVM Native JSON / 5 — semantic migrator jsonRVM program → AVM duplet program
- ✅ [#131](https://github.com/netkeep80/avm/issues/131) `closed` — AVM 1.5 / 9 — end-to-end migration slice и differential equivalence с jsonRVM

### mast-calculator — active

**Objective:** закрыть физическую и нормативную верификацию dynamic wind и erection stages до дальнейшего feature growth

**Next gate:** modal/eigen → #97/#102 dynamic SP20 → #72/#98 erection → verification passport

- 🟡 [#71](https://github.com/netkeep80/mast-calculator/issues/71) `open` — Physics: нормативная модель ветра, динамики и стадий/условий возведения
- 🟡 [#77](https://github.com/netkeep80/mast-calculator/issues/77) `open` — [Epic] Post-Foundation Physics: строительная постановка нагрузок и монтаж
- 🟡 [#97](https://github.com/netkeep80/mast-calculator/issues/97) `open` — Physics / #71b — SP20 pulsation and dynamic wind response from modal properties
- 🟡 [#102](https://github.com/netkeep80/mast-calculator/issues/102) `open` — Physics / #97b — SP20 pulsation contract, damping and regime provenance
- 🟡 [#72](https://github.com/netkeep80/mast-calculator/issues/72) `open` — Physics: монтажный load case подъёма мачты поворотом вокруг опоры
- 🟡 [#98](https://github.com/netkeep80/mast-calculator/issues/98) `open` — Physics / #71c — normative fabrication, transport and erection load stages
- 🟡 [#69](https://github.com/netkeep80/mast-calculator/issues/69) `open` — Web UI 2.0: заменить legacy prototype UI на единое инженерное рабочее пространство
- 🟡 [#76](https://github.com/netkeep80/mast-calculator/issues/76) `open` — Web UI 2.0 / 3 — result workspace, integrated 3D и exports

### PersistMemoryManager — active

**Objective:** закрыть consumer-shaped readiness для native persistent object storage pjson

**Next gate:** #410/#415/#416/#426 → #421

- 🟡 [#410](https://github.com/netkeep80/PersistMemoryManager/issues/410) `open` — Compaction: eliminate forest_domain_mixin.inc and fix registry relocation lifetimes
- 🟡 [#415](https://github.com/netkeep80/PersistMemoryManager/issues/415) `open` — Define and enforce pmap key/value object-lifetime contract
- 🟡 [#416](https://github.com/netkeep80/PersistMemoryManager/issues/416) `open` — Make pstringview interning length-aware and embedded-NUL safe
- 🟡 [#426](https://github.com/netkeep80/PersistMemoryManager/issues/426) `open` — Make pmap persistent type identity collision-safe for typed handles
- 🟡 [#421](https://github.com/netkeep80/PersistMemoryManager/issues/421) `open` — Define the PMM readiness contract consumed by pjson objects

### pjson — blocked

**Objective:** довести pjson 1.0 до native PMM-backed JSON без private storage workaround

**Next gate:** после PMM#421: #55 → #34, затем #35..#44

**Depends on:** [`PersistMemoryManager`](https://github.com/netkeep80/PersistMemoryManager)

- 🟡 [#55](https://github.com/netkeep80/pjson/issues/55) `open` — Advance immutable PMM pin to the object-storage readiness commit
- 🟡 [#34](https://github.com/netkeep80/pjson/issues/34) `open` — Phase C3: implement JSON objects on PMM pmap with pstringview keys
- 🟡 [#35](https://github.com/netkeep80/pjson/issues/35) `open` — Phase C4: unify node views, iterators and subtree traversal
- 🟡 [#36](https://github.com/netkeep80/pjson/issues/36) `open` — Phase D1: implement RFC 6901 path parsing and separate read/create walkers
- 🟡 [#37](https://github.com/netkeep80/pjson/issues/37) `open` — Phase D2: implement persistent CRUD/root API over path addressing
- 🟡 [#38](https://github.com/netkeep80/pjson/issues/38) `open` — Phase D3: implement persistent $ref nodes with bounded/cycle-safe resolution
- 🟡 [#39](https://github.com/netkeep80/pjson/issues/39) `open` — Phase E1: migrate JSON parser/serializer with UTF-8, $ref and $base64 semantics
- 🟡 [#40](https://github.com/netkeep80/pjson/issues/40) `open` — Phase F1: prove save/load/verify/relocation persistence invariants end-to-end
- 🟡 [#41](https://github.com/netkeep80/pjson/issues/41) `open` — Phase F2: port BinDiffSynchronizer pjson behavioral tests as compatibility fixtures
- 🟡 [#42](https://github.com/netkeep80/pjson/issues/42) `open` — Phase G1: stabilize public include/API surface and package integration
- 🟡 [#43](https://github.com/netkeep80/pjson/issues/43) `open` — Phase G2: add benchmarks and memory-efficiency baselines for persistent JSON
- 🟡 [#44](https://github.com/netkeep80/pjson/issues/44) `open` — Phase H1: complete extraction from BinDiffSynchronizer and define pjson_db/jsonRVM handoff contract

### aprover — active

**Objective:** оставаться exact consumer accepted anum_docs contracts и развивать search только поверх trusted replay

**Next gate:** #152 exact-pin accepted MTS v0.7/current invariants while preserving historical replay; proof/search growth under #139 waits for separately accepted upstream proof semantics

**Depends on:** [`anum_docs`](https://github.com/netkeep80/anum_docs)

- 🟡 [#139](https://github.com/netkeep80/aprover/issues/139) `open` — [Roadmap] aprover v0.3 — multi-step proof search поверх trusted МТС v0.3
- 🟡 [#144](https://github.com/netkeep80/aprover/issues/144) `open` — v0.4 multi-step: exact-pin MTS v0.5 и untrusted DefinitionOpeningPath search
- 🟡 [#152](https://github.com/netkeep80/aprover/issues/152) `open` — [Upstream repin] Exact-pin accepted MTS v0.7 / rooted Foundation-v2 boundary

## Repository facts

| Repository | Branch | Archived | Last push | Open issues | Open PRs |
|---|---|---:|---|---:|---:|
| [`anum_docs`](https://github.com/netkeep80/anum_docs) | `main` | no | 2026-08-15T20:29:10Z | 6 | 0 |
| [`avm`](https://github.com/netkeep80/avm) | `main` | no | 2026-08-15T09:13:18Z | 0 | 0 |
| [`mast-calculator`](https://github.com/netkeep80/mast-calculator) | `main` | no | 2026-08-09T10:25:45Z | 11 | 1 |
| [`PersistMemoryManager`](https://github.com/netkeep80/PersistMemoryManager) | `main` | no | 2026-08-09T09:56:41Z | 15 | 6 |
| [`pjson`](https://github.com/netkeep80/pjson) | `main` | no | 2026-08-09T09:56:53Z | 16 | 0 |
| [`aprover`](https://github.com/netkeep80/aprover) | `main` | no | 2026-08-12T20:53:09Z | 3 | 0 |
| [`aes`](https://github.com/netkeep80/aes) | `main` | no | 2026-08-09T09:58:37Z | 0 | 0 |
| [`isocubic`](https://github.com/netkeep80/isocubic) | `main` | no | 2026-08-09T09:58:08Z | 12 | 1 |
| [`repo-guard`](https://github.com/netkeep80/repo-guard) | `main` | no | 2026-08-15T15:35:00Z | 2 | 0 |
| [`roadmap`](https://github.com/netkeep80/roadmap) | `main` | no | 2026-08-16T13:02:06Z | 9 | 0 |
| [`termowood`](https://github.com/netkeep80/termowood) | `main` | no | 2026-08-09T09:58:27Z | 0 | 0 |
| [`anum_parser`](https://github.com/netkeep80/anum_parser) | `main` | no | 2026-08-12T20:31:54Z | 0 | 0 |
| [`BinDiffSynchronizer`](https://github.com/netkeep80/BinDiffSynchronizer) | `main` | no | 2026-08-09T09:57:59Z | 6 | 0 |
| [`god-mode`](https://github.com/netkeep80/god-mode) | `main` | no | 2026-08-09T09:58:17Z | 0 | 0 |
| [`jsonRVM`](https://github.com/netkeep80/jsonRVM) | `master` | no | 2026-08-09T09:59:38Z | 0 | 1 |
| [`meta_rm`](https://github.com/netkeep80/meta_rm) | `main` | no | 2026-08-09T09:58:55Z | 0 | 0 |
| [`mts-genesis`](https://github.com/netkeep80/mts-genesis) | `main` | no | 2026-08-09T09:59:08Z | 0 | 0 |
| [`NNets`](https://github.com/netkeep80/NNets) | `main` | no | 2026-08-09T09:58:46Z | 0 | 0 |
| [`a-num-`](https://github.com/netkeep80/a-num-) | `main` | no | 2026-08-09T09:59:46Z | 0 | 0 |
| [`associative_proofs`](https://github.com/netkeep80/associative_proofs) | `main` | no | 2026-08-09T09:59:38Z | 0 | 0 |
| [`jgit`](https://github.com/netkeep80/jgit) | `main` | no | 2026-08-09T10:00:15Z | 0 | 0 |
| [`jhub`](https://github.com/netkeep80/jhub) | `main` | no | 2026-08-09T10:00:27Z | 0 | 0 |
| [`phprvm`](https://github.com/netkeep80/phprvm) | `main` | no | 2026-08-09T09:59:31Z | 0 | 0 |
| [`sample_cmake`](https://github.com/netkeep80/sample_cmake) | `main` | no | 2026-08-09T10:00:06Z | 0 | 0 |
| [`usefull`](https://github.com/netkeep80/usefull) | `main` | no | 2026-08-09T09:59:55Z | 1 | 0 |

## Tracked issues by repository

### anum_docs

- ✅ [#122](https://github.com/netkeep80/anum_docs/issues/122) `closed` — L5 v0.3: определить proof judgment и минимальный trusted calculus МТС
- ✅ [#123](https://github.com/netkeep80/anum_docs/issues/123) `closed` — L3 v0.3: relative Anum denotation поверх rooted identity #343

### avm

- ✅ [#122](https://github.com/netkeep80/avm/issues/122) `closed` — [Epic] AVM 1.5 — перенести семантику Relations Model из jsonRVM в link-native AVM
- ✅ [#169](https://github.com/netkeep80/avm/issues/169) `closed` — AVM Native JSON — каноническая дуплетная нотация и миграция формата jsonRVM
- ✅ [#174](https://github.com/netkeep80/avm/issues/174) `closed` — AVM Native JSON / 5 — semantic migrator jsonRVM program → AVM duplet program
- ✅ [#131](https://github.com/netkeep80/avm/issues/131) `closed` — AVM 1.5 / 9 — end-to-end migration slice и differential equivalence с jsonRVM

### mast-calculator

- 🟡 [#71](https://github.com/netkeep80/mast-calculator/issues/71) `open` — Physics: нормативная модель ветра, динамики и стадий/условий возведения
- 🟡 [#77](https://github.com/netkeep80/mast-calculator/issues/77) `open` — [Epic] Post-Foundation Physics: строительная постановка нагрузок и монтаж
- 🟡 [#97](https://github.com/netkeep80/mast-calculator/issues/97) `open` — Physics / #71b — SP20 pulsation and dynamic wind response from modal properties
- 🟡 [#102](https://github.com/netkeep80/mast-calculator/issues/102) `open` — Physics / #97b — SP20 pulsation contract, damping and regime provenance
- 🟡 [#72](https://github.com/netkeep80/mast-calculator/issues/72) `open` — Physics: монтажный load case подъёма мачты поворотом вокруг опоры
- 🟡 [#98](https://github.com/netkeep80/mast-calculator/issues/98) `open` — Physics / #71c — normative fabrication, transport and erection load stages
- 🟡 [#69](https://github.com/netkeep80/mast-calculator/issues/69) `open` — Web UI 2.0: заменить legacy prototype UI на единое инженерное рабочее пространство
- 🟡 [#76](https://github.com/netkeep80/mast-calculator/issues/76) `open` — Web UI 2.0 / 3 — result workspace, integrated 3D и exports

### PersistMemoryManager

- 🟡 [#410](https://github.com/netkeep80/PersistMemoryManager/issues/410) `open` — Compaction: eliminate forest_domain_mixin.inc and fix registry relocation lifetimes
- 🟡 [#415](https://github.com/netkeep80/PersistMemoryManager/issues/415) `open` — Define and enforce pmap key/value object-lifetime contract
- 🟡 [#416](https://github.com/netkeep80/PersistMemoryManager/issues/416) `open` — Make pstringview interning length-aware and embedded-NUL safe
- 🟡 [#426](https://github.com/netkeep80/PersistMemoryManager/issues/426) `open` — Make pmap persistent type identity collision-safe for typed handles
- 🟡 [#421](https://github.com/netkeep80/PersistMemoryManager/issues/421) `open` — Define the PMM readiness contract consumed by pjson objects

### pjson

- 🟡 [#55](https://github.com/netkeep80/pjson/issues/55) `open` — Advance immutable PMM pin to the object-storage readiness commit
- 🟡 [#34](https://github.com/netkeep80/pjson/issues/34) `open` — Phase C3: implement JSON objects on PMM pmap with pstringview keys
- 🟡 [#35](https://github.com/netkeep80/pjson/issues/35) `open` — Phase C4: unify node views, iterators and subtree traversal
- 🟡 [#36](https://github.com/netkeep80/pjson/issues/36) `open` — Phase D1: implement RFC 6901 path parsing and separate read/create walkers
- 🟡 [#37](https://github.com/netkeep80/pjson/issues/37) `open` — Phase D2: implement persistent CRUD/root API over path addressing
- 🟡 [#38](https://github.com/netkeep80/pjson/issues/38) `open` — Phase D3: implement persistent $ref nodes with bounded/cycle-safe resolution
- 🟡 [#39](https://github.com/netkeep80/pjson/issues/39) `open` — Phase E1: migrate JSON parser/serializer with UTF-8, $ref and $base64 semantics
- 🟡 [#40](https://github.com/netkeep80/pjson/issues/40) `open` — Phase F1: prove save/load/verify/relocation persistence invariants end-to-end
- 🟡 [#41](https://github.com/netkeep80/pjson/issues/41) `open` — Phase F2: port BinDiffSynchronizer pjson behavioral tests as compatibility fixtures
- 🟡 [#42](https://github.com/netkeep80/pjson/issues/42) `open` — Phase G1: stabilize public include/API surface and package integration
- 🟡 [#43](https://github.com/netkeep80/pjson/issues/43) `open` — Phase G2: add benchmarks and memory-efficiency baselines for persistent JSON
- 🟡 [#44](https://github.com/netkeep80/pjson/issues/44) `open` — Phase H1: complete extraction from BinDiffSynchronizer and define pjson_db/jsonRVM handoff contract

### aprover

- 🟡 [#139](https://github.com/netkeep80/aprover/issues/139) `open` — [Roadmap] aprover v0.3 — multi-step proof search поверх trusted МТС v0.3
- 🟡 [#144](https://github.com/netkeep80/aprover/issues/144) `open` — v0.4 multi-step: exact-pin MTS v0.5 и untrusted DefinitionOpeningPath search
- 🟡 [#152](https://github.com/netkeep80/aprover/issues/152) `open` — [Upstream repin] Exact-pin accepted MTS v0.7 / rooted Foundation-v2 boundary

### isocubic

- 🟡 [#299](https://github.com/netkeep80/isocubic/issues/299) `open` — EPIC: Phase 15 — Core Recovery, Test-First Refactoring and Product Focus
- ✅ [#300](https://github.com/netkeep80/isocubic/issues/300) `closed` — Phase 15.1 — Test Foundation: make CI a strict, trustworthy quality gate
- 🟡 [#301](https://github.com/netkeep80/isocubic/issues/301) `open` — Phase 15.2 — Canonical Cube Domain: schema parity, versioning and migration contracts
- 🟡 [#302](https://github.com/netkeep80/isocubic/issues/302) `open` — Phase 15.3 — Rendering Kernel: isolate shader inputs and add deterministic visual-math regression tests
- 🟡 [#303](https://github.com/netkeep80/isocubic/issues/303) `open` — Phase 15.4 — FFT/Energy Core: numerical invariants, WASM parity and property tests
- 🟡 [#304](https://github.com/netkeep80/isocubic/issues/304) `open` — Phase 15.5 — Editor Application Layer: deterministic state, undo/redo and import/export contracts
- 🟡 [#305](https://github.com/netkeep80/isocubic/issues/305) `open` — Phase 15.6 — Browser E2E: test the real application in Chromium, not only jsdom
- 🟡 [#306](https://github.com/netkeep80/isocubic/issues/306) `open` — Phase 15.7 — Finish MetaMode extraction and restore a hard boundary around product code
- 🟡 [#307](https://github.com/netkeep80/isocubic/issues/307) `open` — Phase 15.8 — Product Surface Audit: quarantine or remove peripheral features that obscure the core
- 🟡 [#308](https://github.com/netkeep80/isocubic/issues/308) `open` — Phase 15.9 — Performance Budgets: reproducible CPU/GPU/size benchmarks for the cube engine
- 🟡 [#309](https://github.com/netkeep80/isocubic/issues/309) `open` — Phase 15.10 — Split tinyLLM.ts into tested AI adapters and deterministic generation services
- 🟡 [#310](https://github.com/netkeep80/isocubic/issues/310) `open` — Phase 15.11 — Documentation and Backlog Cleanup: make roadmap describe reality
- 🟡 [#312](https://github.com/netkeep80/isocubic/issues/312) `open` — Phase 15.12 — Dependency Security Audit: classify and eliminate critical/high npm vulnerabilities safely

### roadmap

- ✅ [#13](https://github.com/netkeep80/roadmap/issues/13) `closed` — [Control Plane] Сделать roadmap главным источником актуального состояния portfolio
- ✅ [#16](https://github.com/netkeep80/roadmap/issues/16) `closed` — [Control Plane] Backlink rollout: все дочерние repos указывают на central roadmap

### BinDiffSynchronizer

- 🟡 [#212](https://github.com/netkeep80/BinDiffSynchronizer/issues/212) `open` — Сделать следующую задачу в текущей фазе разработки и после обновить README.md и файл фазы разработки
- 🟡 [#213](https://github.com/netkeep80/BinDiffSynchronizer/issues/213) `open` — Сделать следующую задачу в текущей фазе разработки и после обновить README.md и файл фазы разработки
- 🟡 [#214](https://github.com/netkeep80/BinDiffSynchronizer/issues/214) `open` — Сделать следующую задачу в текущей фазе разработки и после обновить README.md и файл фазы разработки
- 🟡 [#215](https://github.com/netkeep80/BinDiffSynchronizer/issues/215) `open` — Сделать следующую задачу в текущей фазе разработки и после обновить README.md и файл фазы разработки
- 🟡 [#216](https://github.com/netkeep80/BinDiffSynchronizer/issues/216) `open` — Сделать следующую задачу в текущей фазе разработки и после обновить README.md и файл фазы разработки
- 🟡 [#217](https://github.com/netkeep80/BinDiffSynchronizer/issues/217) `open` — Сделать следующую задачу в текущей фазе разработки и после обновить README.md и файл фазы разработки

## How to read this file

- `objective`, `next gate`, `priority`, `lifecycle`, dependencies and ownership are **portfolio decisions** from `data/portfolio.json`.
- issue/PR counts, archive/default-branch state, timestamps and tracked-issue states are **GitHub facts**.
- child `PORTFOLIO.md` coverage is verified live; a missing/invalid central backlink makes validation/sync fail.
- `Last successful GitHub check` proves snapshot freshness even when nothing changed in the child repositories.
- closing a tracked local issue updates this status automatically; changing portfolio priority or the next strategic gate requires an explicit roadmap change.
- implementation details remain in local repositories; this file is the control board, not a duplicate backlog.

