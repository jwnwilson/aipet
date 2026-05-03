# Bunny World — Build Plan

## Current state

The bunny is a humanoid placeholder on a flat green plane. The player can click it and a dialog panel opens, but nothing else happens. `LLMService` (Claude chat) is wired but never called. No behaviour AI loop exists. No world objects (bowl, bed, toy) are in the scene.

The `aipet_llm` project (`../aipet_llm`) provides a FastAPI inference service at `POST /infer`. Its schema is locked — see CLAUDE.md for the full contract. Both projects must stay in sync on that contract.

---

## Step 1 — AI behaviour loop (highest priority)

Wire the bunny's autonomous behaviour to the `aipet_llm` inference service.

**1a. Pet stats — server-side model**

Create `apps/server/src/services/PetStatsService.ts`:
- Per-bunny in-memory store of `{ hunger, boredom, social, toilet, tiredness }` (all `0.0–1.0`)
- Stats decay on a timer (hunger +0.01/s, boredom +0.005/s, etc.)
- `applyAction(action)` method that resets the relevant stat after an action resolves (e.g. `EAT` → hunger = 0)
- Expose `getStats(entitySessionId): PetStats`

**1b. Scene collector — server-side**

Add a `collectScene(bunnyEntity, allEntities): SceneObject[]` helper:
- Finds all entities within a configurable radius of the bunny
- Maps Colyseus entity types → LLM object types:
  - player entity → `"player"`
  - `race: "bunny"` entity → `"pet"`
  - world object type `"bowl"` → `"bowl"`, etc.
- Returns `{ id: sessionId, type, distance }` — no coordinates

**1c. `AIBehaviourService` — behaviour tick**

Create `apps/server/src/services/AIBehaviourService.ts`:
- Holds a reference to `PetStatsService` and a configurable `AIPET_LLM_URL` (from env)
- `tick(bunnyEntity, allEntities): Promise<void>`:
  1. Calls `collectScene()` to build scene objects
  2. Calls `PetStatsService.getStats()` for pet stats
  3. Posts to `${AIPET_LLM_URL}/infer` via `axios`
  4. Validates response: if `target_object_id` is set, confirms that id exists in the scene; falls back to `IDLE` otherwise
  5. Dispatches action to the bunny's state machine (see mapping below)
- Tick is triggered from the bunny's `IdleState` or `PatrolState` after the current action completes

**Action → game behaviour mapping:**

| LLM Action | Game behaviour |
|---|---|
| IDLE | Stay in `IdleState`, wait |
| EXPLORE | Trigger `PatrolState` (random nav-mesh point) |
| SOCIAL / FOLLOW | Move toward target entity via `moveCTRL` |
| SLEEP | Play sleep animation, pause movement for N seconds |
| EAT / DRINK | Move to target bowl, play eat animation, call `PetStatsService.applyAction()` |
| PLAY / FETCH | Move to target toy, play interact animation |
| TOILET | Move to open ground, play toilet animation |

**1d. Shared types**

Add to `apps/shared/src/types.ts`:
- `PetAction` type mirroring the LLM `Action` enum (string literal union) — keeps client and server aligned without importing from the Python project

**Acceptance test:** Bunny autonomously switches between idling, patrolling, and moving toward the player based on its pet stats — all without player input.

---

## Step 2 — Placeholder world objects (required for Step 1 to be meaningful)

Place labelled placeholder objects in the scene so the LLM has targets to choose from and the behaviour loop can be tested end-to-end. No real art assets needed at this stage — coloured boxes with a text label are sufficient.

**2a. Server — world object spawn entries**

In `apps/server/src/data/LocationsDB.ts` (the `lh_town` entry), add static spawn entries for:
- 1× `bowl` — placed near bunny start position
- 1× `bed` — placed in a corner of the meadow
- 1× `toy` — placed mid-field
- 1× `toilet` — placed away from other objects (used as a destination for the `TOILET` action even though no LLM target is required)

Give each a `type: "worldobject"` and a `subtype` field (`"bowl"`, `"bed"`, `"toy"`, `"toilet"`) so the scene collector can map them to LLM `SceneObject` types. `toilet` maps to no LLM type (TOILET action needs no target) but the entity is useful for server-side movement destination.

**2b. Client — placeholder mesh rendering**

In `AssetsController.ts`, when `location.procedural = true`, spawn a placeholder mesh per world object:
- Use a `MeshBuilder.CreateBox` for each object, positioned to match the server spawn positions
- Apply a distinct flat colour per type: bowl = blue, bed = brown, toy = yellow, toilet = white
- Add a `TextBlock` billboard label above each mesh showing its type name

This is intentionally temporary — real assets replace these boxes in Step 5.

**Acceptance test:** All four objects are visible in the scene; the bunny navigates toward the bowl when hunger is high and toward the bed when tiredness is high.

---

## Step 3 — Chat / dialogue UI

Wire up the player → bunny conversation flow using `LLMService` (Claude).

**3a. Shared types**

Add to `apps/shared/src/types.ts`:
- `NPC_DIALOG_MESSAGE` — client → server: `{ npcSessionId: string, text: string }`
- `NPC_DIALOG_RESPONSE` — server → client: `{ npcSessionId: string, text: string }`

**3b. Server — call LLMService on interact**

In `apps/server/src/rooms/state/GameRoomState.ts`, replace the `PLAYER_INTERACT` placeholder comment with:
- On `PLAYER_INTERACT`: open a "dialogue session" (store `{ playerSessionId, npcSessionId }` in memory)
- On `NPC_DIALOG_MESSAGE`: call `llmService.chat(characterId, playerName, text)`, send response back to that client only via `NPC_DIALOG_RESPONSE`

**3c. Client — replace Panel_Dialog with chat UI**

Replace the scripted step-based `Panel_Dialog` with a free-form chat interface:
- Scrollable message history (alternating player / bunny lines)
- Text input + send button at the bottom (Enter key also sends)
- On send: emit `NPC_DIALOG_MESSAGE`
- On `NPC_DIALOG_RESPONSE`: append bunny reply; show a typing indicator while waiting

**Acceptance test:** Click bunny → panel opens → type "hello" → bunny replies in character within ~2s.

---

## Step 4 — Bunny mesh

Replace the humanoid placeholder with a real bunny model.

- Source or create a low-poly `.glb` bunny mesh (CC0 or custom)
- Add a `bunny` race entry in `apps/server/src/data/RacesDB.ts`
- Update the spawn data in `apps/server/src/data/LocationsDB.ts` to use `race: "bunny"`
- Add the mesh to `AssetsController.ts` asset loading list

Don't block Steps 1–3 on this.

---

## Step 5 — World aesthetics

Make the world feel alive. No gameplay or server changes needed.

- **Ground**: add a grass texture to the existing 200×200 ground mesh (tiling UV)
- **Sky**: swap the flat sky-blue background for a skybox texture or gradient
- **Ambient props**: scatter a handful of static flower/rock meshes (no physics, no interaction)
- **Lighting**: add a directional sun light; tune the existing hemispheric light

---

## Step 6 — Personality & depth

Extend what the bunny can do:

- **Mood**: derive a `mood` string from pet stats (e.g. `hungry`, `sleepy`, `playful`) and include it in the `aipet_llm` system prompt context for more natural dialogue
- **Memory summary**: after 20 chat turns, summarise the conversation into a short "memory" string; prepend to the Claude system prompt on next session for long-term recall
- **Multiple bunnies**: the `AIBehaviourService` tick loop should already support N bunnies — test with 2–3 and tune stat decay rates

---

## Out of scope

- Combat, quests, inventory, loot — stay disabled
- Voice / TTS
- Kubernetes deployment
