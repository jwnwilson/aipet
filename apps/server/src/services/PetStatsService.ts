import { PetAction } from "../../../shared/types";

export type PetStats = {
    hunger: number;
    boredom: number;
    social: number;
    toilet: number;
    tiredness: number;
};

// How fast each stat rises per second (1.0 = full need in this many seconds)
const DECAY_RATES: Record<keyof PetStats, number> = {
    hunger: 0.005,    // full in ~200s
    boredom: 0.003,   // full in ~333s
    social: 0.002,    // full in ~500s
    toilet: 0.004,    // full in ~250s
    tiredness: 0.003, // full in ~333s
};

const INITIAL_STATS: PetStats = {
    hunger: 0.2,
    boredom: 0.2,
    social: 0.1,
    toilet: 0.1,
    tiredness: 0.2,
};

// Which stat gets reset to 0 when an action completes
const ACTION_STAT_RESET: Partial<Record<PetAction, keyof PetStats>> = {
    EAT: "hunger",
    DRINK: "hunger",
    PLAY: "boredom",
    FETCH: "boredom",
    SOCIAL: "social",
    FOLLOW: "social",
    TOILET: "toilet",
    SLEEP: "tiredness",
};

export class PetStatsService {
    private _stats = new Map<string, PetStats>();

    getOrInit(sessionId: string): PetStats {
        if (!this._stats.has(sessionId)) {
            this._stats.set(sessionId, { ...INITIAL_STATS });
        }
        return this._stats.get(sessionId)!;
    }

    update(sessionId: string, deltaMs: number): void {
        const stats = this.getOrInit(sessionId);
        const dt = deltaMs / 1000;
        for (const key of Object.keys(DECAY_RATES) as Array<keyof PetStats>) {
            stats[key] = Math.min(1, stats[key] + DECAY_RATES[key] * dt);
        }
    }

    applyAction(sessionId: string, action: PetAction): void {
        const statKey = ACTION_STAT_RESET[action];
        if (statKey) {
            this.getOrInit(sessionId)[statKey] = 0;
        }
    }

    remove(sessionId: string): void {
        this._stats.delete(sessionId);
    }
}
