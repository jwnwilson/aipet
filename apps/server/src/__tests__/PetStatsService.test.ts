import { PetStatsService } from "../services/PetStatsService";

describe("PetStatsService", () => {
    let svc: PetStatsService;

    beforeEach(() => {
        svc = new PetStatsService();
    });

    // ── Initialisation ──────────────────────────────────────────────────────

    it("returns default stats for a new session", () => {
        const stats = svc.getOrInit("pet-1");
        expect(stats.hunger).toBeCloseTo(0.2);
        expect(stats.boredom).toBeCloseTo(0.2);
        expect(stats.social).toBeCloseTo(0.1);
        expect(stats.toilet).toBeCloseTo(0.1);
        expect(stats.tiredness).toBeCloseTo(0.2);
    });

    it("returns the same object on repeated calls (no re-init)", () => {
        const a = svc.getOrInit("pet-1");
        a.hunger = 0.9;
        const b = svc.getOrInit("pet-1");
        expect(b.hunger).toBeCloseTo(0.9);
    });

    // ── Decay ────────────────────────────────────────────────────────────────

    it("increases hunger by correct amount after 1 second", () => {
        const stats = svc.getOrInit("pet-1");
        const before = stats.hunger;
        svc.update("pet-1", 1000);
        // decay rate: 0.005 / s
        expect(stats.hunger).toBeCloseTo(before + 0.005, 5);
    });

    it("increases all stats proportionally for 500ms", () => {
        const stats = svc.getOrInit("pet-1");
        svc.update("pet-1", 500);
        expect(stats.hunger).toBeCloseTo(0.2 + 0.005 * 0.5, 5);
        expect(stats.boredom).toBeCloseTo(0.2 + 0.003 * 0.5, 5);
        expect(stats.social).toBeCloseTo(0.1 + 0.002 * 0.5, 5);
        expect(stats.toilet).toBeCloseTo(0.1 + 0.004 * 0.5, 5);
        expect(stats.tiredness).toBeCloseTo(0.2 + 0.003 * 0.5, 5);
    });

    it("clamps stats at 1.0 and never exceeds it", () => {
        const stats = svc.getOrInit("pet-1");
        stats.hunger = 0.999;
        svc.update("pet-1", 10000); // large delta would push past 1.0
        expect(stats.hunger).toBe(1);
    });

    // ── applyAction ──────────────────────────────────────────────────────────

    it.each([
        ["EAT", "hunger"],
        ["DRINK", "hunger"],
    ] as const)("applyAction(%s) resets %s to 0", (action, stat) => {
        const stats = svc.getOrInit("pet-1");
        stats[stat] = 0.8;
        svc.applyAction("pet-1", action);
        expect(stats[stat]).toBe(0);
    });

    it.each([
        ["PLAY", "boredom"],
        ["FETCH", "boredom"],
    ] as const)("applyAction(%s) resets %s to 0", (action, stat) => {
        const stats = svc.getOrInit("pet-1");
        stats[stat] = 0.8;
        svc.applyAction("pet-1", action);
        expect(stats[stat]).toBe(0);
    });

    it.each([
        ["SOCIAL", "social"],
        ["FOLLOW", "social"],
    ] as const)("applyAction(%s) resets %s to 0", (action, stat) => {
        const stats = svc.getOrInit("pet-1");
        stats[stat] = 0.8;
        svc.applyAction("pet-1", action);
        expect(stats[stat]).toBe(0);
    });

    it("applyAction(TOILET) resets toilet to 0", () => {
        const stats = svc.getOrInit("pet-1");
        stats.toilet = 0.8;
        svc.applyAction("pet-1", "TOILET");
        expect(stats.toilet).toBe(0);
    });

    it("applyAction(SLEEP) resets tiredness to 0", () => {
        const stats = svc.getOrInit("pet-1");
        stats.tiredness = 0.8;
        svc.applyAction("pet-1", "SLEEP");
        expect(stats.tiredness).toBe(0);
    });

    it.each(["IDLE", "EXPLORE"] as const)("applyAction(%s) does not change any stat", (action) => {
        const stats = svc.getOrInit("pet-1");
        const snapshot = { ...stats };
        svc.applyAction("pet-1", action);
        expect(stats).toEqual(snapshot);
    });

    // ── remove ────────────────────────────────────────────────────────────────

    it("remove clears the entry so getOrInit returns fresh defaults", () => {
        const stats = svc.getOrInit("pet-1");
        stats.hunger = 0.9;
        svc.remove("pet-1");
        const fresh = svc.getOrInit("pet-1");
        expect(fresh.hunger).toBeCloseTo(0.2);
    });
});
