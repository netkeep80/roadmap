# Portfolio decisions

Этот файл — компактный журнал **принятых portfolio-level решений**. Он не заменяет PR discussion и local design docs; его задача — дать историю направления без археологии по десяткам репозиториев.

## D-001 — Один canonical owner на слой

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** roadmap #1, PR #10

Решение:

- `PersistMemoryManager` владеет persistent storage primitives, но не JSON/VM semantics;
- `pjson` владеет persistent JSON semantics;
- `anum_docs` владеет normative МТС/Anum contracts;
- `avm` является future canonical link-native Relations Model runtime;
- `aprover` — downstream proof/search consumer;
- `jsonRVM` — migration oracle, а не второй future runtime;
- legacy implementations удаляются после migration, Git остаётся архивом.

**Следствие:** compatibility implementation без named removal gate считается архитектурным долгом, а не нормальной конечной формой.

## D-002 — Portfolio управляется gates, а не календарными обещаниями

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** PR #10

Переход между этапами происходит после проверяемого acceptance condition: upstream contract, conformance, consumer migration, independent validation, safety evidence или explicit research decision.

**Следствие:** `EXECUTION.md` строит dependency lanes и gates, а не искусственный календарный Gantt.

## D-003 — Long-term направление: persistent associative runtime прежде custom hardware

**Статус:** accepted как research direction, не как production architecture  
**Дата:** 2026-08-09  
**Связано:** roadmap #11, PR #12

Предпочтительная последовательность:

```text
software semantics
→ persistent runtime
→ realistic workload
→ associative scheduler / self-hosting
→ profiling
→ accelerator
→ only then possible custom hardware
```

Hardware specialization должна реализовывать тот же observable semantic contract, а не создавать вторую VM.

## D-004 — `roadmap` является главным portfolio control plane

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** roadmap #13, PR #14, PR #15, PR #18

Решение:

- `roadmap` — первая точка входа для всего `netkeep80` portfolio;
- human-maintained `data/portfolio.json` хранит intent: priorities, lifecycle, ownership, objectives, gates, dependencies;
- GitHub-derived `STATUS.md` / `data/status.json` хранят observed state и successful-check freshness;
- local repositories владеют implementation backlog;
- новый public repository без записи в registry считается governance drift;
- автоматизация может обновлять факты, но не имеет права самостоятельно менять portfolio decisions;
- semantic-vs-GitHub workstream mismatch показывается как health warning, а broken tracked references являются hard failure.

**Следствие:** актуальность roadmap поддерживается не ручным копированием GitHub state, а разделением semantic intent и generated facts.

## D-005 — MTS foundation reset v2 предшествует прежней v0.6 production migration

**Статус:** superseded как активное ordering решением D-007; сохранено как historical decision  
**Дата:** 2026-08-09  
**Связано:** roadmap #3, `anum_docs#200`, `#201`, `#202`, прежний `#194–#199`

Live control-plane выявил, что `anum_docs#194` теперь прямо заблокирован новым foundation reset. Поэтому portfolio больше не считает `#195` непосредственным следующим production шагом.

Текущий на тот момент порядок:

```text
#200  5-link semantic kernel / meaning-of-meaning
  ↓
#201  minimal quaternary Anum streaming interpreter + context network
  ↓
#202  dictionary-driven universal associative interpreter / theory network
  ↓
explicit decision about surviving v0.6 assumptions
  ↓
rewrite/revalidate #194–#199
  ↓
accepted production/reference migration
```

**Исторические следствия:**

- `aprover` не repin-ился на foundation-reset candidate;
- AVM продолжал только те gates, которые frontend-neutral и не требовали нового candidate MTS contract;
- старый `#194–#199` план не считался автоматически валидным после `#202` — он должен был быть переписан/перепроверен;
- `anum_docs` оставался единственным normative owner, поэтому AVM/aprover не создавали локальную alternative semantics, пока upstream foundation решался.

## D-006 — Child backlinks являются live governance invariant

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** roadmap #16, control-plane backlink guard

Одноразового внедрения `PORTFOLIO.md` недостаточно. Каждый current child repository должен постоянно сохранять discoverable link обратно на central control plane.

Validator/sync проверяет для каждого текущего child repository:

- root `PORTFOLIO.md` существует в default branch;
- файл указывает на `https://github.com/netkeep80/roadmap`;
- файл указывает на central `STATUS.md`;
- dynamic priority/lifecycle/current gate при этом не копируются в child repository.

**Следствие:** missing/invalid backlink является hard control-plane failure так же, как unregistered repository или broken tracked gate. Generated `STATUS.md` показывает live coverage `verified_child_backlinks / child_repository_count`; фиксированное количество child repositories намеренно не зашивается в решение, потому что portfolio может расти.

## D-007 — Accepted MTS v0.7 является текущим production baseline для downstream consumers

**Статус:** accepted  
**Дата:** 2026-08-12  
**Связано:** roadmap #3/#24, `anum_docs#237/#271/#401/#403`, `aprover#152`

`anum_docs` завершил Gate P и одним атомарным C7+C8+C9 cutover принял `mts-contract/v0.7` / `mts-conformance/v0.7` как текущую production/reference границу. Historical Python semantic runtime удалён; compatibility runtime отсутствует; v0.6 остаётся неизменяемым previous-release evidence.

Новый portfolio ordering:

```text
accepted anum_docs MTS v0.7
        ↓
aprover#152 exact current-upstream repin
        ↓
consumer conformance / current pointer

accepted anum_docs MTS v0.7
        ↓
AVM MTS-dependent frontend may repin when a local gate requires it

accepted anum_docs MTS v0.7
        ↓
anum_parser laboratory tracks current umbrella provenance while its Anum leaf remains v0.4
```

Решение:

- downstream repin теперь **разрешён**, но не считается автоматически выполненным;
- `aprover#152` — первый явный proof/search consumer handoff на v0.7;
- `anum_parser` остаётся non-normative laboratory consumer: experiments не становятся МТС semantics без принятия в `anum_docs`;
- AVM больше не блокируется ожиданием Foundation-v2 acceptance, но не обязан тянуть MTS в frontend-neutral gates;
- `anum_docs#122/#123` продолжаются как отдельные research/versioned extension tracks и не делают accepted v0.7 «candidate» задним числом;
- старые accepted artifacts остаются version-scoped replay evidence;
- downstream consumers не создают локальную alternative MTS semantics.

**Следствие:** прежняя D-005 цепочка считается завершённым historical ordering. Текущая P0 граница сдвинулась с upstream foundation migration на downstream exact-pin/conformance и локальные AVM migration gates.

## Как добавлять следующее решение

Новая запись должна содержать:

- identifier `D-NNN`;
- status (`proposed`, `accepted`, `superseded`, `rejected`);
- дату;
- связанные roadmap issue/PR;
- короткое решение;
- последствия;
- при supersede — ссылку на новое решение.
