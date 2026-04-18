# Engineering tickets

Independent work units for parallel agents. Read [PLAN.md](../PLAN.md) and [DESIGN.md](../DESIGN.md) first — they are the source of truth.

## Dependency graph

```
┌─────────────────────────────────┐
│  01-scaffold  (solo, blocks all)│
└────────────────┬────────────────┘
                 │
     ┌───────────┼───────────┬───────────┐
     ▼           ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ 02 Lane A│ │ 03 Lane B│ │ 04 Lane C│ │ 05 Lane D│
│ research │ │ orchestr.│ │ screens  │ │ screens  │
│ backend  │ │ + calend.│ │   1-2    │ │   3-4    │
└─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │            │
      └────────────┴────────────┴────────────┘
                     │
                     ▼
            ┌──────────────────┐
            │ 06 integration + │
            │     polish       │
            └──────────────────┘
```

## Lane conventions

- Only edit files inside your lane's tree per [PLAN.md §2.2](../PLAN.md). If you need to touch shared files in §2.1, STOP and flag for coordination.
- `SessionDO` is extended by Lanes A and B. These extensions are additive methods, no rewrites. Stubs for both lanes' methods land in ticket 01 so there's no collision.
- Import types from `lib/types.ts`, `lib/events.ts`, `lib/serialized-parts.ts` only. Do not duplicate domain types in lane-local files.
- Structured tool errors via `toolError()` from `lib/errors.ts`. No thrown exceptions at tool boundaries.

## Agent briefing template

When assigning a ticket to an agent, include in your prompt:

```
You are implementing ticket issues/XX-<name>.md in the gtm-hackathon repo.
Before any code:
  1. Read CLAUDE.md for repo rules.
  2. Read PLAN.md in full — that is the architecture contract.
  3. Read DESIGN.md — that is the visual contract.
  4. Read your ticket top-to-bottom.
  5. Read any tickets listed in "Depends on" to understand what's already landed.
  6. Confirm the scope covered by the ticket; ask before expanding.

Work strictly inside your lane's directory tree. Do not modify shared files
in PLAN.md §2.1 without flagging.
```

## Ticket list

1. [01-scaffold.md](01-scaffold.md) — repo init, shared contracts, fixture. **Solo, blocks everything.**
2. [02-lane-a-research-backend.md](02-lane-a-research-backend.md) — research agent, chat API, AskInline HIL.
3. [03-lane-b-orchestrator-calendar.md](03-lane-b-orchestrator-calendar.md) — calendar orchestrator, Nano Banana 2, R2, SSE.
4. [04-lane-c-screens-1-2.md](04-lane-c-screens-1-2.md) — URL + socials input, research stream UI.
5. [05-lane-d-screens-3-4.md](05-lane-d-screens-3-4.md) — Confirm WedgeCard + monthly calendar + DayModal.
6. [06-integration-polish.md](06-integration-polish.md) — live Apify run, demo rehearsal, deploy.
