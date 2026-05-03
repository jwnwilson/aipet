# CLAUDE.md — AI Pet (Bunny World)

## Project Overview

A 3D AI pet sandbox where a player walks around a peaceful meadow and interacts with an AI-powered bunny NPC. Built on top of a stripped-down MMORPG engine (Babylon.js + Colyseus).

The bunny has two AI modes running in parallel:
1. **Autonomous behaviour** — a local LLM (`aipet_llm`) polls every few seconds with scene state + pet stats and returns an action for the bunny to execute (EAT, SLEEP, SOCIAL, EXPLORE, etc.)
2. **Chat / dialogue** — when a player clicks the bunny a dialog panel opens; the player can type messages and the bunny responds via Claude API

The bunny can also interact with other players and (eventually) other bunnies.

## Tech Stack

| Layer | Tech |
|---|---|
| 3D engine | Babylon.js 6 (WebGL, WebXR-ready) |
| Multiplayer sync | Colyseus 0.15 (WebSocket rooms + schema state) |
| Backend | Express + TypeScript, Node 18+ |
| Database | SQLite3 (via a thin wrapper at `apps/server/src/database/`) |
| Behaviour AI | Local LLM service (`aipet_llm`, FastAPI, GGUF model) — see API contract below |
| Chat AI | `@anthropic-ai/sdk` — Claude Haiku 4.5 with prompt caching (`LLMService`) |
| Build | Turborepo + pnpm workspaces; Webpack (client), ts-node-dev (server) |

## Monorepo Structure

```
apps/
  client/     Babylon.js frontend (Webpack)
  server/     Express + Colyseus backend
  shared/     Types shared between client and server
packages/
  ui/                 (unused for now)
  eslint-config/
  typescript-config/
```

The companion `aipet_llm` project lives at `../aipet_llm` (sibling directory). It is a separate Python FastAPI service.

## Running the Project

```bash
pnpm dev          # starts both client (port 8080) and server (port 3000) via Turbo
```

The server requires these env vars in `apps/server/.env`:
- `ANTHROPIC_API_KEY` — for the Claude chat service
- `AIPET_LLM_URL` — URL of the aipet_llm service (default: `http://localhost:8000`)

## aipet_llm API Contract

The behaviour LLM is accessed at `POST /infer`. The game server is responsible for building the request and executing the returned action.

### Request — `InferenceRequest`

```typescript
{
  scene: {
    objects: Array<{
      id: string;            // unique id of the game entity / object
      type: "bowl" | "bed" | "toy" | "player" | "pet";
      distance: number;      // metres from the bunny (no position coords)
    }>;
    tick: number;            // monotonically increasing game tick
  };
  pet_stats: {
    hunger:    number;       // 0.0–1.0 (1.0 = very hungry)
    boredom:   number;
    social:    number;       // 1.0 = craving social interaction
    toilet:    number;
    tiredness: number;
  };
}
```

### Response — `InferenceResponse`

```typescript
{
  action: Action;                    // see enum below
  target_object_id: string | null;   // id from scene.objects, or null
  confidence: number | null;
}
```

### Action Enum

| Action  | Target required | Valid target types |
|---------|-----------------|--------------------|
| EAT     | Yes             | bowl               |
| DRINK   | Yes             | bowl               |
| PLAY    | Yes             | toy                |
| FETCH   | Yes             | toy                |
| SLEEP   | Yes             | bed                |
| SOCIAL  | Yes             | player, pet        |
| FOLLOW  | Yes             | player, pet        |
| TOILET  | No              | —                  |
| IDLE    | No              | —                  |
| EXPLORE | No              | —                  |

The LLM only returns actions whose required target type is present in the scene. If it returns an action with a missing or invalid target, the game server must fall back to `IDLE`.

### Health check

`GET /health` → `{ "status": "ok", "model": "<path>" }`

---

## Key Server Architecture (`apps/server/src/`)

### Rooms (`rooms/`)

- `GameRoom.ts` — Colyseus room; one instance per game session
- `state/GameRoomState.ts` — message handlers (onMessage switch). Active messages: `PLAYER_MOVE`, `PLAYER_MOVE_TO`, `PLAYER_INTERACT`
- `controllers/` — spawning, movement, stats
- `brain/` — NPC state machine (only `IdleState` + `PatrolState` active)

### Services (`services/`)

- `LLMService.ts` — Claude-powered chat. `chat(characterId, playerName, message) → string`. Uses SQLite for history persistence + in-memory cache per character.
- `AIBehaviourService.ts` *(to be built)* — behaviour tick loop. Collects scene state around each bunny, calls `POST /infer` on the aipet_llm service, dispatches the returned action to the bunny's state machine.

### Key integration point — `AIBehaviourService`

The service must:
1. Be called on a per-bunny timer (after each action completes, or every N seconds)
2. Collect all `SceneObject`s visible to the bunny (players, other pets, fixed world objects) with distances
3. Map game entity types → LLM `type` strings
4. Read/update pet stats from a per-bunny in-memory store (decay hunger/boredom over time; reset stats after relevant actions)
5. Call `POST /infer` on the LLM service (`AIPET_LLM_URL`)
6. Map the returned `Action` → bunny state machine transition or movement command

---

## Key Client Architecture (`apps/client/src/`)

- `Controllers/UserInterface.ts` — mounts all UI panels
- `Controllers/UI/Panels/Panel_Dialog.ts` — dialog panel (currently scripted step-based; needs replacing with free-form chat for the bunny)
- `Controllers/UI/ChatBox.ts` — global chat (not used for bunny dialogue)
- `Entities/Player.ts` — left-click sends `PLAYER_INTERACT` and calls `panelDialog.open(target)`

---

## Shared Types (`apps/shared/src/types.ts`)

All client↔server message names live here as the `ServerMsg` enum.

---

## Current State

- Player can walk to the bunny and click it — `Panel_Dialog` opens
- Server receives `PLAYER_INTERACT` but only logs it (LLM chat not yet wired)
- `LLMService` (chat) is complete; `AIBehaviourService` (behaviour loop) does not exist yet
- Bunny renders as a humanoid placeholder (mage texture) — no bunny mesh yet
- World is a flat green 200×200 plane (procedural, no `.glb` loaded)
- No world objects (bowls, beds, toys) exist in the scene yet

---

## What Is Deliberately Disabled

The codebase was stripped from a full MMORPG. These systems exist in code but are disabled:
- Combat, abilities, loot, quests, inventory, equipment
- NPC chase/attack/dead brain states
- Hotbar, resurrect UI, experience bar, casting bar

Do not re-enable these unless explicitly asked.
