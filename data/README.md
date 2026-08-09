# Control-plane data

Эта директория содержит два принципиально разных класса данных.

## `portfolio.json`

**Human-maintained semantic registry.**

Это machine-readable source of truth для:

- repository role/lifecycle/priority;
- portfolio objective and next gate;
- dependencies;
- canonical ownership;
- local epics / tracked issues;
- cross-repo workstreams.

Изменение `portfolio.json` является portfolio decision и должно проходить обычный review/PR.

## `status.json`

**Generated factual snapshot. Do not edit manually.**

Файл создаётся `scripts/sync-roadmap.mjs` из GitHub API и содержит:

- repository metadata;
- open issue/PR counts;
- timestamps;
- tracked issue states;
- portfolio workstream issue states;
- state hash.

Human-readable представление — [`../STATUS.md`](../STATUS.md).

Если intent и observed facts требуют разной реакции, intent не переписывается автоматически: человек/agent принимает portfolio decision отдельным изменением `portfolio.json`.
