# Порядок исполнения

Срез: 2026-08-09.

Центральный roadmap не означает, что вся работа сериализована. Ниже выделены независимые lanes и hard dependency gates.

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

### Lane B — МТС foundation

```text
anum_docs #194
   ├─ #195 typed substrate
   ├─ #196 target grammar/AST
   ├─ #197 candidate interpreter
   ├─ #198 root + Anum conformance
   └─ #199 integrated acceptance
```

До `#199` downstream consumer не должен принимать candidate v0.6 как production semantics.

### Lane C — AVM 1.5

Работа может идти параллельно МТС foundation там, где contract уже frontend-neutral и не зависит от candidate L2:

- завершать triune execution/context/reference/effect gates `#122`;
- canonical Integer/value model (`#128/#163`);
- canonical Text (`#180`);
- native duplet JSON boundary (`#169/#173`);
- frozen jsonRVM corpus/migrator (`#174`).

Финальный gate — `#131` differential end-to-end slice. Если он требует нового accepted МТС contract, ждать exact upstream acceptance, а не дублировать semantics в AVM.

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

После accepted foundation/proof contract:
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
2. anum_docs foundation research;
3. AVM gates, не зависящие от candidate MTS semantics;
4. mast-calculator physical validation;
5. isocubic Phase 15 core recovery;
6. termowood/aes commissioning work;
7. repo-guard consumer rollout.

Главная оптимизация portfolio — **не запускать downstream workaround, когда blocker уже локализован upstream**.