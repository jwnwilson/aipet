import axios, { AxiosInstance } from "axios";
import Logger from "../utils/Logger";
import { PetStatsService } from "./PetStatsService";
import { PetAction } from "../../../shared/types";

type SceneObjectType = "bowl" | "bed" | "toy" | "player" | "pet";

type SceneObject = {
    id: string;
    type: SceneObjectType;
    distance: number;
};

const SCENE_RADIUS = 30;

export class AIBehaviourService {
    private _petStats: PetStatsService;
    private _axios: AxiosInstance;
    private _tick = 0;
    private _tokenCache: { token: string; expiresAt: number } | null = null;

    constructor(
        petStats: PetStatsService,
        llmUrl: string,
        timeoutMs = parseInt(process.env.AIPET_LLM_TIMEOUT_MS ?? "20000", 10),
    ) {
        this._petStats = petStats;
        this._axios = axios.create({ baseURL: llmUrl, timeout: timeoutMs });
    }

    private async _getAccessToken(): Promise<string | null> {
        if (!process.env.AUTH0_M2M_CLIENT_ID) return null;

        const now = Date.now();
        if (this._tokenCache && this._tokenCache.expiresAt - 60_000 > now) {
            return this._tokenCache.token;
        }

        const res = await axios.post(
            `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
            {
                grant_type: "client_credentials",
                client_id: process.env.AUTH0_M2M_CLIENT_ID,
                client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
                audience: process.env.AUTH0_M2M_AUDIENCE,
            },
            { timeout: 5000 },
        );
        this._tokenCache = {
            token: res.data.access_token,
            expiresAt: now + res.data.expires_in * 1000,
        };
        return this._tokenCache.token;
    }

    static async checkHealth(url: string): Promise<void> {
        try {
            const res = await axios.get<{ status: string; model?: string }>(`${url}/health`, { timeout: 3000 });
            Logger.info(`[aipet_llm] connected — model: ${res.data?.model ?? "unknown"}`);
        } catch {
            Logger.warning("[aipet_llm] service unreachable — behaviour AI will fall back to EXPLORE");
        }
    }

    public applyPendingAction(sessionId: string, action: PetAction): void {
        this._petStats.applyAction(sessionId, action);
    }

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
            Logger.info(`LLM Request: ${JSON.stringify(requestBody)}`);

            const token = await this._getAccessToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await this._axios.post("/infer", requestBody, { headers });

            Logger.info(`LLM Response: ${JSON.stringify(response.data)}`);

            const { action, target_object_id } = response.data as { action: PetAction; target_object_id: string | null };

            this._dispatchAction(entity, state, action, target_object_id);
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

        switch (action) {
            case "IDLE":
                // Stay in IdleState; reset timer so the next tick fires in ~3s
                entity.IDLE_TIMER = 0;
                entity.IDLE_TIMER_LENGTH = 3000;
                this._petStats.applyAction(entity.sessionId, action);
                break;

            case "EXPLORE":
            case "TOILET":
                // stat reset deferred to arrival (IdleState.enter via AI_PENDING_ACTION)
                entity.AI_PENDING_ACTION = action;
                entity._stateMachine.changeTo("PATROL");
                break;

            case "SOCIAL":
            case "FOLLOW":
            case "EAT":
            case "DRINK":
            case "PLAY":
            case "FETCH":
            case "SLEEP":
                // stat reset deferred to arrival (IdleState.enter via AI_PENDING_ACTION)
                entity.AI_PENDING_ACTION = action;
                entity._stateMachine.changeTo("PATROL");
                if (targetEntity) {
                    entity.setTargetDestination(targetEntity.getPosition());
                }
                break;
        }
    }
}
