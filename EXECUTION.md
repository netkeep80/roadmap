# Порядок исполнения

Срез: 2026-08-09.

Центральный roadmap не означает, что вся работа сериализована. Ниже выделены независимые lanes и hard dependency gates.

> **Актуальность:** factual open/closed state всегда читать в [`STATUS.md`](STATUS.md). Этот документ хранит **осознанный порядок исполнения**. Если live status выявляет новый blocker, `data/portfolio.json` и этот документ обновляются отдельным portfolio decision.

## NOW — blocking foundations

### Lane A — PMM → pjson

```text
PMM #410/#415/#416/#426
        ↓
      #421
        ↓
pjson #55 → #34
        ↓
#35 → #36 → #37 → #38 → #39 → #40 → #41 → #42/#43 → #44
```

**Hard rule:** пока `PMM#421` не закрыт, не реализовывать pjson object storage через временный compatibility container.

### Lane B — МТС foundation reset v2

Прежняя production/reference цепочка `#194 → #195..#199` сейчас **не является непосредственным next step**. `anum_docs#194` заблокирован новым foundation reset:

```text
#200
5-link semantic kernel / акорень как смысл смысла
        ↓
#201
четверичный Anum streaming interpreter
+ link-only context chain
        ↓
#202
универсальный dictionary-driven associative interpreter
+ explicit theory/axiom network
        ↓
explicit decision:
что survives from old v0.6 direction
        ↓
rewrite/revalidate #194–#199
        ↓
accepted production/reference migration
```

**Hard rules:** 

- не продолжать parser/AST production migration через `#195–#199`, пока `#200–#202` не завершены;
- после `#202` не считать старый #194 plan автоматически действительным — нужен explicit rewrite/revalidation;
- `aprover` и другие downstream consumers не repin-ятся на foundation-reset candidate;
- historical v0.2–v0.5 остаются replayable, но accepted production path в итоге должен быть один.

### Lane C — AVM 1.5

AVM может идти параллельно МТС foundation там, где contract frontend-neutral и не зависит от candidate denotation.

Текущий tracked slice:

- `#122` — основной AVM 1.5 epic;
- `#128/#163` — canonical value/integer;
- `#169` — native duplet JSON boundary;
- `#127` — sequence/projection/foreach semantics; ordered sequence/state-threading уже существуют, remaining path уточнён как `#187 → #188`;
- `#187` — deterministic foreach по canonical ordered link-list;
- `#188` — projection/lambda и deterministic effect-order contract;
- `#174` — semantic migrator из frozen jsonRVM corpus, зависящий от `#127` и использующий `foreach-object-context` в стартовом differential corpus;
- `#173` — **completed**;
- `#180` — **completed**;
- `#131` — финальный differential end-to-end gate.

Уточнённый frontend-neutral migration path:

```text
#187 deterministic foreach
        ↓
#188 projection/effect-order contract
        ↓
#174 semantic migrator
        ↓
#131 differential end-to-end slice
```

`#128/#163` развивается параллельно и остаётся prerequisite для arithmetic/value constructs внутри `#174`.

Если оставшийся AVM шаг требует нового accepted МТС/Anum contract из `#200–#202`, ждать exact upstream acceptance, а не дублировать semantics внутри AVM.

### Lane D — mast-calculator physics

```text
modal/eigen validation
→ SP20 pulsation/dynamic contract (#97/#102)
→ erection/load-stage contracts (#72/#98)
→ integrated engineering provenance/verification
```

Web UI 2.0 может развиваться параллельно, если не меняет physics и сохраняет direct/CLI/Web/Desktop equivalence.

## NEXT — consolidation after first gates

### pjson extraction completion

После objects/path/codec/persistence:
- перенести meaningful BinDiffSynchronizer fixtures (`pjson#41`);
- стабилизировать public package surface (`#42`);
- поставить performance/memory baselines (`#43`);
- закрыть extraction/handoff (`#44`);
- удалить migrated pjson implementation из BinDiffSynchronizer.

### MTS consumers

После **нового accepted foundation contract**, выведенного через `#200–#202` и перепроверенный production migration plan:
- exact repin `aprover`;
- replay upstream conformance directly;
- только затем multi-step untrusted search/UI;
- AVM/Anum frontend conformance repin, если требуется.

### isocubic core recovery

```text
#300 strict CI
→ #301 canonical domain
→ #302/#303/#304
→ #305 browser E2E
→ boundary decision God Mode vs MetaMode
→ #306/#307 extraction/product cleanup
→ #308/#312/#310 performance/security/docs
```

## CONTINUOUS — portfolio quality

### Central control plane

`roadmap` уже имеет live registry validation и generated status. Оставшийся bootstrap/discoverability gate — `roadmap#16`:

```text
23 child repositories
→ stable PORTFOLIO.md pointer
→ central roadmap discoverable from every repo
```

Файл в child repo не копирует priority/lifecycle/next gate: эти данные остаются только в central control-plane.

### repo-guard rollout

Rollout выполнять небольшими consumer PR:
1. audit existing CI/policy;
2. advisory/dry-run where needed;
3. immutable Action pin;
4. blocking mode only after known-good baseline;
5. cross-repo bug in repo-guard оформлять как reproducer, затем обновлять consumers на fixed immutable commit.

### Safety/commissioning

`termowood` и `aes` не ждут software foundation lanes. Их можно развивать параллельно, но ordering внутри каждого проекта safety-first:

```text
failure modes → protection → test procedure → measured evidence → as-built → new features
```

## LATER — evidence-driven research and cleanup

### Research

- `NNets`: benchmarks/baselines before more algorithms.
- `meta_rm`: use cases + compile-time cost before promotion.
- `mts-genesis`: publication + upstream research questions, no parallel contracts.

### Portfolio hygiene

- `jsonRVM`: freeze/oracle until AVM migration exit.
- `phprvm`, `associative_proofs`, `a-num-`: status/provenance then archive.
- `sample_cmake`, `jgit`, `jhub`: charter or archive.
- `usefull`: maintenance only for real consumers.

## Decision gates вместо календарных обещаний

Roadmap намеренно ориентирован на gates, а не на произвольные даты. Переход в следующий этап происходит, когда выполнены проверяемые условия:

- upstream contract accepted;
- CI/conformance green;
- consumer migrated;
- legacy path deleted;
- independent engineering/safety evidence obtained;
- research candidate explicitly accepted/rejected.

## Что можно делать одновременно

Следующие lanes в основном независимы и могут идти параллельно:

1. PMM/pjson foundation;
2. anum_docs foundation reset v2 (`#200–#202`);
3. AVM gates, не зависящие от candidate MTS semantics;
4. mast-calculator physical validation;
5. isocubic Phase 15 core recovery;
6. termowood/aes commissioning work;
7. repo-guard consumer rollout;
8. portfolio backlink rollout.

Главная оптимизация portfolio — **не запускать downstream workaround, когда blocker уже локализован upstream**.
