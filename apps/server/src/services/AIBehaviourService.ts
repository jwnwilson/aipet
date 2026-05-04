import axios from "axios";
import Logger from "../utils/Logger";
import { PetStatsService } from "./PetStatsService";
import { PetAction } from "../../../shared/types";

type SceneObjectType = "bowl" | "bed" | "toy" | "player" | "pet";

type SceneObject = {
    id: string;
    type: SceneObjectType;
    distance: number;
};

// Maximum distance (units) from bunny to include an object in the scene
const SCENE_RADIUS = 30;

export class AIBehaviourService {
    private _petStats: PetStatsService;
    private _llmUrl: string;
    private _tick = 0;

    constructor(petStats: PetStatsService, llmUrl: string) {
        this._petStats = petStats;
        this._llmUrl = llmUrl;
    }

    /**
     * Fire-and-forget behaviour tick for a single bunny entity.
     * Collects scene, calls POST /infer, dispatches the returned action.
     * Sets AI_TICK_PENDING to guard against concurrent calls.
     */
    public async requestTick(entity: any, state: any): Promise<void> {
        if (entity.AI_TICK_PENDING) return;
        entity.AI_TICK_PENDING = true;

        try {
            const sceneObjects = this._collectScene(entity, state);
            const petStats = this._petStats.getOrInit(entity.sessionId);

            const requestBody = {
                scene: { objects: sceneObjects, tick: this._tick++ },
                pet_stats: petStats,
            };

            const response = await axios.post(`${this._llmUrl}/infer`, requestBody, { timeout: 5000 });
            const { action, target_object_id } = response.data as { action: PetAction; target_object_id: string | null };

            this._dispatchAction(entity, state, action, target_object_id, sceneObjects);
        } catch (err) {
            Logger.error("[AIBehaviourService] inference error, falling back to EXPLORE:", err);
            entity.setRandomDestination(entity.getPosition());
            entity._stateMachine.changeTo("PATROL");
        } finally {
            entity.AI_TICK_PENDING = false;
        }
    }

    /**
     * Builds the list of scene objects visible to the bunny within SCENE_RADIUS.
     * Maps game entity types to LLM scene object types.
     */
    private _collectScene(entity: any, state: any): SceneObject[] {
        const objects: SceneObject[] = [];
        const bunnyPos = entity.getPosition();

        state.entities.forEach((other: any) => {
            if (other.sessionId === entity.sessionId) return;
            if (typeof other.getPosition !== "function") return;

            const dist: number = bunnyPos.distanceTo(other.getPosition());
            if (dist > SCENE_RADIUS) return;

            if (other.type === "player") {
                objects.push({ id: other.sessionId, type: "player", distance: dist });
            } else if (other.type === "entity" && other.AI_SPAWN_INFO?.key === "bunny") {
                objects.push({ id: other.sessionId, type: "pet", distance: dist });
            } else if (other.type === "worldobject") {
                const subtype = other.subtype as SceneObjectType | undefined;
                // toilet has no LLM target type — the bunny goes to a random spot instead
                if (subtype && subtype !== ("toilet" as any)) {
                    objects.push({ id: other.sessionId, type: subtype, distance: dist });
                }
            }
        });

        return objects;
    }

    /**
     * Maps an LLM action to a concrete state-machine transition on the bunny entity.
     */
    private _dispatchAction(
        entity: any,
        state: any,
        action: PetAction,
        targetId: string | null,
        sceneObjects: SceneObject[],
    ): void {
        Logger.info(`[AIBehaviourService] bunny ${entity.sessionId}: action=${action} target=${targetId ?? "none"}`);

        // Validate target exists in state when one is expected
        let targetEntity: any = null;
        if (targetId) {
            targetEntity = state.entityCTRL.get(targetId);
            if (!targetEntity) {
                Logger.warning(`[AIBehaviourService] target ${targetId} not found, falling back to EXPLORE`);
                entity.setRandomDestination(entity.getPosition());
                entity._stateMachine.changeTo("PATROL");
                this._petStats.applyAction(entity.sessionId, "EXPLORE");
                return;
            }
        }

        this._petStats.applyAction(entity.sessionId, action);

        switch (action) {
            case "IDLE":
                // Stay in IdleState; reset timer so the next tick fires in ~3s
                entity.IDLE_TIMER = 0;
                entity.IDLE_TIMER_LENGTH = 3000;
                break;

            case "EXPLORE":
            case "TOILET":
                entity.setRandomDestination(entity.getPosition());
                entity._stateMachine.changeTo("PATROL");
                break;

            case "SOCIAL":
            case "FOLLOW":
            case "EAT":
            case "DRINK":
            case "PLAY":
            case "FETCH":
            case "SLEEP":
                if (targetEntity) {
                    entity.setTargetDestination(targetEntity.getPosition());
                } else {
                    entity.setRandomDestination(entity.getPosition());
                }
                entity._stateMachine.changeTo("PATROL");
                break;
        }
    }
}
