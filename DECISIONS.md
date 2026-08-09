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
**Связано:** roadmap #13

Решение:

- `roadmap` — первая точка входа для всего `netkeep80` portfolio;
- human-maintained `data/portfolio.json` хранит intent: priorities, lifecycle, ownership, objectives, gates, dependencies;
- GitHub-derived `STATUS.md` / `data/status.json` хранят observed state;
- local repositories владеют implementation backlog;
- новый public repository без записи в registry считается governance drift;
- автоматизация может обновлять факты, но не имеет права самостоятельно менять portfolio decisions.

**Следствие:** актуальность roadmap поддерживается не ручным копированием GitHub state, а разделением semantic intent и generated facts.

## Как добавлять следующее решение

Новая запись должна содержать:

- identifier `D-NNN`;
- status (`proposed`, `accepted`, `superseded`, `rejected`);
- дату;
- связанные roadmap issue/PR;
- короткое решение;
- последствия;
- при supersede — ссылку на новое решение.
