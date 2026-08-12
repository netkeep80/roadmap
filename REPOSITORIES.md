# Дорожная карта по каждому репозиторию

Срез: 2026-08-12. Порядок ниже — не рейтинг важности, а полный inventory.

> Этот документ объясняет **роль и направление** каждого repository. Текущие `open/closed` facts берутся только из generated [`STATUS.md`](STATUS.md), а machine-readable priority/lifecycle/next gate — из [`data/portfolio.json`](data/portfolio.json). Локальные implementation tasks остаются в issues соответствующего repository.

## 1. PersistMemoryManager — P0

**Роль:** C++20 persistent storage kernel.

**Сильная сторона:** уже существует реальный kernel с offset identity, allocator, persistent containers, forest/domain registry, verify/recovery и широкими CI/invariant gates.

**Главный долг:** relocation/lifetime/type-identity contracts должны быть закрыты до того, как upper layer начнёт строить object storage.

**Дальше:** `#410/#415/#416/#426 → #421`; затем conformance/failure-atomic hardening (`#418/#419`) и документационные closures. Не расширять PMM вверх в JSON/query/VM.

## 2. pjson — P0

**Роль:** standalone persistent JSON semantics над PMM.

**Current program:** epic `#27` уже правильно разделяет node/core/container/path/codec/persistence/productization/extraction.

**Дальше:** после `PMM#421` — `pjson#55 → #34`; затем `#35 → #36 → #37 → #38 → #39 → #40 → #41 → #42/#43 → #44`.

**Не делать:** второй allocator/string/array/map layer, floating PMM ref, compatibility stack из BinDiffSynchronizer.

## 3. BinDiffSynchronizer — P1/P2 transition

**Роль сейчас:** зрелый источник behavior/tests для persistent JSON плюс собственно binary diff/sync functionality.

**Проблема:** исторически вобрал reusable persistence/JSON layers, которые теперь получают canonical owners PMM/pjson. Открытый backlog содержит generic “сделать следующую задачу” issues, что затрудняет управление.

**Дальше:** выполнить inventory по `pjson#41/#44`; портировать только JSON behavior fixtures; после consumer migration удалить duplicate pjson implementation. Затем пересобрать local roadmap вокруг diff/sync API, persistence integration и end-to-end sync tests. Generic placeholder issues закрыть/заменить конкретными.

## 4. jsonRVM — P2 oracle

**Роль:** исторически богатая JSON-based Relations Model VM и главный behavioral oracle для AVM migration.

**Дальше:** freeze semantics; зафиксировать reproducible corpus + pinned commit provenance; добавлять только тестовые fixtures/документацию, необходимые `avm#123/#174/#131`.

**Не делать:** новую AVM duplet syntax, второй modern runtime, крупный refactor ради красоты. После AVM differential completion перевести в explicit legacy/oracle status.

## 5. avm — P0

**Роль:** canonical link-native runtime для Relations Model.

**Current program:** `#122` AVM 1.5; migration строится через triune semantics, contexts, references, sequence/projection, canonical values, effects, frontend convergence и differential slice.

**Current gate:** `#173` leaf/value/symbol resolver и `#180` canonical Text уже закрыты. Текущая frontend-neutral ветка декомпозирована так:

```text
#187 deterministic foreach по ordered link-list
        ↓
#188 projection/lambda + deterministic effect-order
        ↓
#174 semantic migrator из frozen jsonRVM corpus
        ↓
#131 end-to-end differential migration
```

`#187/#188` закрывают remaining часть общего `#127` sequence/projection/foreach contract; `#128/#163` canonical value/Integer развиваются параллельно и остаются prerequisite для arithmetic/value constructs в migrator; `#169` остаётся native duplet JSON boundary. Foundation-v2 acceptance больше не является blocker: MTS-dependent frontend теперь может exact-repin accepted `anum_docs` v0.7, когда этого потребует конкретный local gate.

**Не делать:** JSON DOM как internal runtime value, string opcodes, второй Executor, hidden materialization на read/find path, implicit parallelism как semantic requirement, локальный fork MTS semantics.

## 6. anum_docs — P0

**Роль:** normative source МТС/Anum contracts, conformance и reference semantics.

**Current state:** foundation reset и production migration завершены. Atomic `#401` выполнил C7+C8+C9: historical Python semantic runtime удалён, единый rooted Foundation-v2 runtime принят как current **MTS v0.7** (`mts-contract/v0.7`, `mts-conformance/v0.7`). Gate P `#237/#271` выполнен; downstream repin разрешён. v0.6 остаётся immutable previous-release evidence и не является current live-owner manifest.

**Дальше:** не открывать второй production runtime. Новые направления `#122` proof calculus и `#123` relative Anum развивать как независимые research/versioned candidates поверх стабильного v0.7 baseline. Любое принятие должно создавать следующий явный versioned boundary, а не мутировать v0.7.

**Production handoff:** первый конкретный downstream consumer gate — `aprover#152` exact pin текущего v0.7 boundary.

**Не делать:** возвращать parser/AST/interpreter compatibility runtime, использовать runtime/storage/source/path ids как semantic Link identity, ретроактивно менять v0.6/v0.7 или считать research candidate текущим production contract до отдельного acceptance.

## 7. aprover — P0/P1 consumer

**Роль:** browser research environment: canonical visualization, untrusted proof search, independent trusted replay.

**Current state:** upstream blocker снят — `anum_docs` принял MTS v0.7. `aprover#152` теперь является конкретным current-upstream repin gate. Существующий `#144` остаётся historical accepted v0.5/proof-v0.4 replay slice и не должен быть переосмыслен под v0.7.

**Дальше:** `#152` exact-pin v0.7 artifacts/source/blob provenance → replay portable identity/transport/read-only invariants → current-upstream UI/docs pointer. Затем `#139` может развивать proof/search только в рамках отдельно принятых upstream proof semantics; `anum_docs#122` остаётся research dependency для будущего calculus growth.

**Главный invariant:** search != checker; UI != proof validity; `anum_docs` owns semantics; old artifacts replay under their own version; никакого local MTS fork или compatibility occurrence runtime.

## 8. mts-genesis — P2 research/publication

**Роль:** compact conceptual exposition о самоподобной корневой системе, интерпретаторе и актуальности.

**Дальше:** удерживать статью самодостаточной и философски глубокой, но всё, что претендует на machine-checkable semantics, переводить в research issues/challenges `anum_docs` как будущие versioned candidates поверх принятого v0.7 baseline.

**Не делать:** вторую нормативную МТС внутри статьи.

## 9. meta_rm — P2 research

**Роль:** C++20 compile-time ternary relations/meta-model experiment.

**Дальше:** заморозить маленький kernel (`rm<S,R,O>`, relation protocol, metadata/introspection); выбрать 2–3 concrete compile-time case studies; измерить compilation cost/diagnostics/usability; затем решение `standalone library / bridge/demo / archive`.

**Не делать:** автоматически переносить AVM runtime semantics или объявлять meta_rm новым canonical Relations Model owner.

## 10. phprvm — P3/archive

**Роль:** historical PHP/MySQL Relations Model VM/editor.

**Дальше:** добавить явный status/provenance banner, указать current successors/oracles. Извлекать только ещё не перенесённые semantic examples при реальной потребности AVM history audit; затем archive/read-only.

## 11. associative_proofs — P3/archive

**Роль:** historical pointer; README уже сообщает, что Coq proofs moved to `LinksPlatform/Theory`.

**Дальше:** formal archive status + canonical destination link. Не создавать новые local proof branches.

## 12. a-num- — P3/archive

**Роль:** маленький исторический пример ассоциативной БД/ачисла.

**Дальше:** README status banner, ссылки на current `anum_docs`/актуальные examples; archive unless существует уникальный executable example, который стоит перенести.

## 13. NNets — P2 research

**Роль:** experimental self-structuring neural-network C++ library с большим набором learning algorithms и SIMD/multithreading paths.

**Дальше:** evidence-first milestone: fixed datasets/seeds, reproducible train/save/load/retrain, simple baselines, accuracy/time/memory plots, profiler evidence. Новые algorithms/SIMD only after measurable bottleneck or hypothesis.

**Decision point:** определить область, где self-structuring architecture даёт полезное отличие, либо зафиксировать проект как educational/research reference.

## 14. mast-calculator — P0

**Роль:** engineering application с общим typed headless core для Web/CLI/Desktop.

**Current strength:** mature FEM/numerical/reporting/design architecture и versioned engineering contracts.

**Дальше:** physics verification прежде feature breadth: `#71/#77`, modal/dynamic wind `#97/#102`, erection `#72/#98`, independent reference/external FEM validation. Web UI 2.0 (`#69/#76`) может идти параллельно, но не владеет физикой и не маскирует незакрытые модели.

**Hard gate:** numerical/cross-adapter equivalence + explicit model version/provenance.

## 15. isocubic — P1

**Роль:** parametric isometric cube/editor/rendering/FFT-energy product.

**Дальше:** следовать `#299` Phase 15. Сначала strict test foundation (`#300`) и canonical domain (`#301`); затем rendering/FFT/editor (`#302/#303/#304`); browser E2E (`#305`); dev-tool/product surface cleanup (`#306/#307`); performance/security/docs (`#308/#312/#310`).

**Не делать:** large social/AI/game expansion до core recovery.

## 16. god-mode — P1/P2

**Роль:** standalone React dev-tool library (AI conversation, issue drafting, capture/annotation direction).

**Unresolved:** `isocubic#306` говорит о package `MetaMode`; текущий inventory не содержит отдельного `netkeep80/metamode`. Нельзя считать MetaMode и god-mode одним проектом без provenance/code decision.

**Дальше:** сначала boundary inventory; затем, если god-mode остаётся canonical package, создать consumer-driven backlog: deterministic host integration, conversation/provider boundary, GitHub draft flow, capture/annotation, packaging/E2E. Реальный consumer обязателен до широкой feature expansion.

## 17. repo-guard — P1

**Роль:** shared executable governance CLI/GitHub Action.

**Дальше:** rollout active repos через immutable pins и local-fit policies. Сам repo-guard должен получать новые features только из воспроизводимых consumer failures/use cases; нужны fixtures для таких cross-repo cases. Не раздувать policy DSL без необходимости.

## 18. termowood — P1 safety

**Роль:** embedded ESP8266 thermostat/controller для реального термопроцесса.

**Дальше:** safe-state/failure matrix; independent hardware cutoff assumptions; watchdog/reset behavior; two-sensor disagreement/open/short; calibration; SSR failure considerations; bench/HIL commissioning; OTA integrity/recovery. После этого — humidity/pressure/report features.

**Definition of useful release:** documented failure handling + measured commissioning evidence, не только feature checklist.

## 19. aes — P1 safety/engineering

**Роль:** design/as-built documentation home 12 V solar/UPS/grid/generator system.

**Дальше:** design freeze → wiring/protection review → staged commissioning measurements → transition/fallback tests → as-built docs + maintenance schedule. После монтажа README должен отделять measured state от old design assumptions.

## 20. usefull — P3 maintenance

**Роль:** small Python utility collection.

**Дальше:** либо package-quality maintenance (tests, minimal supported Python range, semantic versioning) для concrete consumers, либо freeze. Не превращать в dumping-ground универсальных helpers.

## 21. sample_cmake — P3 incubation

**Роль сейчас:** placeholder/minimal repository без содержательного public charter.

**Дальше:** один README charter: зачем нужен, кто consumer, чем отличается от обычного CMake example, первый acceptance test. Если такого ответа нет — archive.

## 22. jgit — P3 incubation

**Роль сейчас:** placeholder с initial commit.

**Дальше:** до кода зафиксировать problem statement, intended consumer/data model, relationship to existing ecosystem, first vertical slice. Без charter — archive, не строить generic framework заранее.

## 23. jhub — P3 incubation

**Роль сейчас:** placeholder с initial commit.

**Дальше:** те же требования, что для `jgit`: explicit product/consumer boundary и first acceptance scenario прежде scaffolding. Если зависит от ещё не существующего `jgit` contract — сначала стабилизировать lower layer.

## 24. roadmap — P1 portfolio control

**Роль:** authoritative portfolio control plane по всем 25 repositories.

**Состояние:** machine-readable semantic registry, live GitHub validation, generated `STATUS.md`/`data/status.json`, operating model и decision log работают на `main`; child backlink rollout является continuously verified invariant для всех current child repositories.

**Дальше:** это ongoing governance, а не новый implementation backlog: поддерживать registry при semantic changes, реагировать на drift, сохранять актуальные cross-repo gates и не дублировать local implementation issues. Meta-epic #1 остаётся открытой управляющей точкой.

## 25. anum_parser — P1/P2 research laboratory

**Роль:** отдельная лаборатория для экспериментальных алгоритмов сериализации, десериализации и визуализации ачисел.

**Граница владения:** `anum_parser` не является вторым нормативным МТС/Anum owner. Нормативные contracts, conformance и принятие новой семантики принадлежат `anum_docs`. Текущий Anum leaf остаётся `anum-deserialization/v0.4`; текущий umbrella provenance должен быть exact-repin на accepted MTS v0.7.

**Дальше:** обновить current-upstream provenance с прежнего MTS v0.6 на v0.7 без изменения v0.4 leaf semantics; сохранять альтернативные parser/visualization modes экспериментальными; если новый алгоритм претендует на нормативный смысл — сначала отдельный research/acceptance path в `anum_docs`.

**Не делать:** локальную alternative MTS semantics, compatibility runtime исторической МТС или выдавать UI/internal node identity за semantic Link identity.

---

## Portfolio-wide Definition of Done

Репозиторий считается управляемым, если для него выполняется хотя бы один из вариантов:

1. **Active:** есть canonical role, next gate и acceptance criteria;
2. **Consumer/oracle:** явно указано, что он не является owner соответствующей semantics;
3. **Maintenance:** scope заморожен, изменения consumer-driven;
4. **Incubation:** есть charter + first vertical slice;
5. **Archive:** status/provenance/current successor видимы из repository или central roadmap.

Дополнительный portfolio invariant: каждый current child repository содержит стабильный `PORTFOLIO.md` backlink на central control plane, а live validator проверяет его сохранность.

Неопределённое состояние «может быть когда-нибудь продолжим» должно исчезнуть из portfolio.
