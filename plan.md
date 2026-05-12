# Bunny World — Build Plan

## Current state

The bunny is a humanoid placeholder on a flat green plane. The player can click it and a dialog panel opens, but nothing else happens. `LLMService` (Claude chat) is wired but never called. No behaviour AI loop exists. No world objects (bowl, bed, toy) are in the scene.

The `aipet_llm` project (`../aipet_llm`) provides a FastAPI inference service at `POST /infer`. Its schema is locked — see CLAUDE.md for the full contract. Both projects must stay in sync on that contract.

---

## Testing approach

Server unit tests live in `apps/server/src/__tests__/`. Framework: **Jest + ts-jest**. Run with:

```bash
pnpm --filter server test
```

Each step that adds server logic also adds unit tests. Client/Babylon.js code is not unit tested — validate those changes visually in the browser.

---

## Step 1 — AI behaviour loop ✓

Wire the bunny's autonomous behaviour to the `aipet_llm` inference service.

**1a. Pet stats — server-side model**

`apps/server/src/services/PetStatsService.ts`:
- Per-bunny in-memory store of `{ hunger, boredom, social, toilet, tiredness }` (all `0.0–1.0`)
- Stats decay on every game tick; `applyAction(action)` resets the relevant stat
- `getOrInit(sessionId)` creates default stats on first call

**1b. Scene collector — server-side**

Private `_collectScene(bunnyEntity, state)` inside `AIBehaviourService`:
- Finds all entities within 30 units of the bunny
- Maps entity types → LLM object types (player → `"player"`, bunny entity → `"pet"`, worldobject subtype passthrough)
- Returns `{ id, type, distance }` — no coordinates

**1c. `AIBehaviourService` — behaviour tick**

`apps/server/src/services/AIBehaviourService.ts`:
- `requestTick(entity, state)` — fire-and-forget; guarded by `AI_TICK_PENDING` flag
- Calls `POST /infer` (timeout 5s); on error falls back to EXPLORE
- Dispatches returned action to the bunny's state machine

**Action → game behaviour mapping:**

| LLM Action | Game behaviour |
|---|---|
| IDLE | Reset idle timer; stay in `IdleState` |
| EXPLORE | `setRandomDestination` + `changeTo("PATROL")` |
| SOCIAL / FOLLOW | `setTargetDestination(target)` + `changeTo("PATROL")` |
| EAT / DRINK / PLAY / FETCH / SLEEP | `setTargetDestination(target)` + `changeTo("PATROL")` |
| TOILET | `setRandomDestination` + `changeTo("PATROL")` |

**1d. Shared types**

`PetAction` union type added to `apps/shared/types.ts`.

**Acceptance test:** Bunny autonomously switches between idling, patrolling, and moving toward the player based on its pet stats — all without player input.

**Tests (`src/__tests__/`) — done:**
- `PetStatsService.test.ts` — stat initialisation, decay math, clamp at 1.0, every `applyAction` mapping, `remove` cleanup
- `AIBehaviourService.test.ts` — `AI_TICK_PENDING` guard, EXPLORE/IDLE/SOCIAL/FOLLOW/EAT dispatch, missing-target fallback, axios error fallback, scene object type mapping, distance filter

---

## Step 2 — aipet_llm API integration & verification

Ensure the game server can reliably connect to the aipet_llm inference service — whether running locally during development or at a hosted URL in production — and that the integration is covered by tests that exercise the real HTTP contract.

**2a. Connection configuration**

- `AIPET_LLM_URL` env var is already read by `AIBehaviourService`; document the default (`http://localhost:8000`) in `apps/server/.env.example`
- Add an `AIPET_LLM_TIMEOUT_MS` env var (default: `5000`) so the timeout is tunable without code changes
- Keep a single axios instance (created once in `AIBehaviourService`) with `baseURL` and `timeout` set from env — no per-call config

**2b. Startup health check**

In `apps/server/src/index.ts` (or wherever the Colyseus server starts), before accepting connections:
- `GET /health` on the configured `AIPET_LLM_URL`
- If reachable: log `[aipet_llm] connected — model: <path>`
- If unreachable: log a warning and continue (the behaviour service already falls back to EXPLORE on error, so the game is still playable without it)

**2c. Integration tests**

`apps/server/src/__tests__/integration/AIBehaviourService.integration.test.ts`:
- Spin up a lightweight HTTP server (`http.createServer` or `nock`) that replays valid `/infer` responses matching the locked schema in CLAUDE.md
- Test matrix:
  - Happy path: valid `InferenceResponse` is parsed and the correct action is dispatched
  - Invalid target type in response → fallback to `IDLE`
  - HTTP 500 from the inference service → fallback to `EXPLORE`
  - Request timeout (server delays > `AIPET_LLM_TIMEOUT_MS`) → fallback to `EXPLORE`
  - `/health` check succeeds → startup log emitted
  - `/health` check fails → warning logged, server continues

Run integration tests with:

```bash
pnpm --filter server test:integration
```

Add a `test:integration` script to `apps/server/package.json` using a separate Jest config (`jest.integration.config.js`) so they are not included in the regular `pnpm test` run.

**Acceptance test:** With `AIPET_LLM_URL=http://localhost:8000` pointing at a running aipet_llm instance, the server starts, logs a successful health check, and the bunny autonomously acts on inferred actions. With the service stopped, the server still starts and the bunny falls back to exploring.

---

## Step 3 — Placeholder world objects (required for Step 1 to be meaningful)

Place labelled placeholder objects in the scene so the LLM has targets to choose from and the behaviour loop can be tested end-to-end. No real art assets needed at this stage — coloured boxes with a text label are sufficient.

**3a. Server — world object spawn entries**

In `apps/server/src/data/LocationsDB.ts` (the `lh_town` entry), add static spawn entries for:
- 1× `bowl` — placed near bunny start position
- 1× `bed` — placed in a corner of the meadow
- 1× `toy` — placed mid-field
- 1× `toilet` — placed away from other objects (used as a destination for the `TOILET` action even though no LLM target is required)

Give each a `type: "worldobject"` and a `subtype` field (`"bowl"`, `"bed"`, `"toy"`, `"toilet"`) so the scene collector can map them to LLM `SceneObject` types. `toilet` maps to no LLM type (TOILET action needs no target) but the entity is useful for server-side movement destination.

**3b. Client — placeholder mesh rendering**

In `AssetsController.ts`, when `location.procedural = true`, spawn a placeholder mesh per world object:
- Use a `MeshBuilder.CreateBox` for each object, positioned to match the server spawn positions
- Apply a distinct flat colour per type: bowl = blue, bed = brown, toy = yellow, toilet = white
- Add a `TextBlock` billboard label above each mesh showing its type name

This is intentionally temporary — real assets replace these boxes in Step 6.

**Acceptance test:** All four objects are visible in the scene; the bunny navigates toward the bowl when hunger is high and toward the bed when tiredness is high.

**Tests:**
- `AIBehaviourService.test.ts` additions: scene collector includes `worldobject` entities with correct subtype; excludes `toilet` from LLM scene objects (since TOILET needs no target); distance filter applies to world objects the same as entities

---

## Step 4 — Chat / dialogue UI

Wire up the player → bunny conversation flow using `LLMService` (Claude).

**4a. Shared types**

Add to `apps/shared/src/types.ts`:
- `NPC_DIALOG_MESSAGE` — client → server: `{ npcSessionId: string, text: string }`
- `NPC_DIALOG_RESPONSE` — server → client: `{ npcSessionId: string, text: string }`

**4b. Server — call LLMService on interact**

In `apps/server/src/rooms/state/GameRoomState.ts`, replace the `PLAYER_INTERACT` placeholder comment with:
- On `PLAYER_INTERACT`: open a "dialogue session" (store `{ playerSessionId, npcSessionId }` in memory)
- On `NPC_DIALOG_MESSAGE`: call `llmService.chat(characterId, playerName, text)`, send response back to that client only via `NPC_DIALOG_RESPONSE`

**4c. Client — replace Panel_Dialog with chat UI**

Replace the scripted step-based `Panel_Dialog` with a free-form chat interface:
- Scrollable message history (alternating player / bunny lines)
- Text input + send button at the bottom (Enter key also sends)
- On send: emit `NPC_DIALOG_MESSAGE`
- On `NPC_DIALOG_RESPONSE`: append bunny reply; show a typing indicator while waiting

**Acceptance test:** Click bunny → panel opens → type "hello" → bunny replies in character within ~2s.

**Tests:**
- `LLMService.test.ts`: mock `@anthropic-ai/sdk` and the database; verify `chat()` appends to history, persists both turns, trims at MAX_HISTORY, returns fallback text on API error

---

## Step 5 — Bunny mesh

Replace the humanoid placeholder with a real bunny model.

- Source or create a low-poly `.glb` bunny mesh (CC0 or custom)
- Add a `bunny` race entry in `apps/server/src/data/RacesDB.ts`
- Update the spawn data in `apps/server/src/data/LocationsDB.ts` to use `race: "bunny"`
- Add the mesh to `AssetsController.ts` asset loading list

Don't block Steps 1–4 on this.

**Tests:** None — visual change only.

---

## Step 6 — World aesthetics

Make the world feel alive. No gameplay or server changes needed.

- **Ground**: add a grass texture to the existing 200×200 ground mesh (tiling UV)
- **Sky**: swap the flat sky-blue background for a skybox texture or gradient
- **Ambient props**: scatter a handful of static flower/rock meshes (no physics, no interaction)
- **Lighting**: add a directional sun light; tune the existing hemispheric light

**Tests:** None — visual change only.

---

## Step 7 — Personality & depth

Extend what the bunny can do:

- **Mood**: derive a `mood` string from pet stats (e.g. `hungry`, `sleepy`, `playful`) and include it in the `aipet_llm` system prompt context for more natural dialogue
- **Memory summary**: after 20 chat turns, summarise the conversation into a short "memory" string; prepend to the Claude system prompt on next session for long-term recall
- **Multiple bunnies**: the `AIBehaviourService` tick loop should already support N bunnies — test with 2–3 and tune stat decay rates

**Tests:**
- `PetStatsService.test.ts` additions: mood derivation returns correct label for each dominant stat; ties resolved deterministically

---

## Out of scope

- Combat, quests, inventory, loot — stay disabled
- Voice / TTS
- Kubernetes deployment
