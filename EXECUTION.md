# Порядок исполнения

Срез: 2026-08-12.

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

### Lane B — accepted MTS v0.7 → downstream consumers

Foundation-reset и production migration больше не являются текущим blocker. Эта цепочка завершена в `anum_docs`:

```text
#200 / #201 / #202
foundation reset
        ↓
новые rooted Foundation-v2 gates
        ↓
#237 / #271 Gate P
        ↓
#401 atomic C7+C8+C9
        ↓
accepted mts-contract/v0.7
+ mts-conformance/v0.7
+ один rooted production runtime
```

Historical Python semantic runtime удалён без compatibility path. `mts-contract/v0.6` и его corpus остаются immutable previous-release evidence, но не current production owner.

Текущий downstream gate:

```text
accepted anum_docs MTS v0.7
        ↓
aprover #152 exact pin + consumer conformance
        ↓
current-upstream pointer / historical replay remains version-scoped
```

Параллельно AVM может продолжать frontend-neutral migration; MTS-dependent frontend теперь может exact-repin v0.7 только тогда, когда этого требует конкретный local gate.

**Hard rules:**

- не возвращать historical parser/AST/interpreter как selectable runtime;
- не создавать compatibility occurrence semantics;
- downstream consumer pin должен указывать на exact accepted v0.7 artifacts/provenance;
- accepted v0.7 не даёт aprover права самостоятельно добавлять proof rules;
- `anum_docs#122/#123` — отдельные research/versioned extension tracks и не мутируют v0.7 задним числом;
- Link identity остаётся только функцией упорядоченных semantic poles; runtime/storage/source/path ids не создают тождество связи.

### Lane C — AVM 1.5

AVM может идти параллельно МТС work там, где contract frontend-neutral. Теперь accepted MTS v0.7 существует, поэтому ожидание Foundation-v2 acceptance снято; однако repin не нужен gates, которые вообще не зависят от MTS frontend.

Завершённый foundation текущей migration-линии:

- `#125` — immutable semantic contexts и functional state lineage;
- `#126` — canonical references + adapter-компилятор `$ent/$$obj/...` без runtime JSON-pointer;
- `#127` — sequence/projection/foreach semantics и детерминированный порядок эффектов;
- `#128` — минимальный value-denotation v1: singleton identities, canonical Integer, byte-string Text и ordered link-list;
- `#173` — Native JSON leaf/value resolver;
- `#187` — deterministic foreach по canonical ordered link-list;
- `#188` — independent execution projection и deterministic effect-order contract;
- `#191` — устранён скрытый `$rel := result` в pure Integer arithmetic.

Текущий tracked slice:

- `#122` — основной AVM 1.5 epic;
- `#169` — umbrella Native Duplet JSON boundary и migration work;
- `#174` — semantic migrator из frozen jsonRVM corpus;
- `#131` — финальный differential end-to-end gate.

Текущий frontend-neutral migration path:

```text
#174 semantic migrator
        ↓
#131 differential end-to-end slice
```

`#174` обязан использовать уже принятые contracts, а не возвращать старую mutable JSON VM:

- canonical Integer/Text/value denotations;
- explicit result vs semantic-state transition;
- canonical references;
- ordered sequence;
- deterministic foreach;
- independent projection;
- frozen jsonRVM oracle как behavioral evidence.

Поддержка migrator-а расширяется construct-by-construct только вместе с oracle fixture/evidence. Float/Object/Map/BigInt и другие value domains не реализуются speculative заранее: новый domain добавляется отдельным gate только когда migration corpus или реальный consumer доказывает необходимость.

Если MTS-dependent frontend действительно нужен конкретному AVM шагу, использовать exact accepted `anum_docs` v0.7 boundary, а не дублировать semantics внутри AVM.

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

Текущий upstream production contract уже принят как MTS v0.7. Следующий consumer-shaped этап:

- `aprover#152` — exact pin v0.7 contract/conformance/C9 provenance;
- replay portable identity/transport/read-only invariants непосредственно в consumer tests;
- сохранить historical version-scoped replay без compatibility runtime;
- только после отдельно принятого upstream proof contract расширять multi-step untrusted search/UI;
- AVM/Anum frontend repin выполнять только по реальной локальной зависимости, не как ритуальный version bump.

`anum_docs#122` (proof calculus) и `#123` (relative Anum) продолжаются независимо как будущие versioned research tracks.

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

`roadmap` уже имеет live registry validation, generated status и непрерывно проверяемые backlinks всех child repositories.

```text
23 child repositories
→ stable PORTFOLIO.md pointer
→ central roadmap discoverable from every repo
→ portfolio-sync detects factual drift
→ semantic drift reconciled отдельным portfolio decision
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
- `anum_docs#122/#123`: новые proof/relative-Anum semantics только как отдельные versioned candidates поверх принятого v0.7 baseline.

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
2. `aprover#152` exact MTS v0.7 repin и независимые `anum_docs#122/#123` research tracks;
3. AVM gates, включая frontend-neutral `#174 → #131`, а MTS-dependent work — только через accepted v0.7;
4. mast-calculator physical validation;
5. isocubic Phase 15 core recovery;
6. termowood/aes commissioning work;
7. repo-guard consumer rollout;
8. central portfolio drift reconciliation.

Главная оптимизация portfolio — **не запускать downstream workaround, когда blocker уже локализован upstream**.
