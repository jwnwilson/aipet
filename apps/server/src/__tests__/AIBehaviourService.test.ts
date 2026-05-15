import axios from "axios";
import { AIBehaviourService } from "../services/AIBehaviourService";
import { PetStatsService } from "../services/PetStatsService";

jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockPost = jest.fn();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a fake Vector3-like position whose distanceTo always returns `dist`. */
const makePos = (dist = 5) => ({ distanceTo: jest.fn().mockReturnValue(dist) });

/** Minimal fake bunny entity. */
const makeBunny = (overrides: Record<string, any> = {}) => ({
    sessionId: "bunny-1",
    type: "entity",
    AI_TICK_PENDING: false,
    AI_PENDING_ACTION: null as string | null,
    AI_SPAWN_INFO: { key: "bunny" },
    IDLE_TIMER: 0,
    IDLE_TIMER_LENGTH: 3000,
    getPosition: jest.fn().mockReturnValue(makePos()),
    setRandomDestination: jest.fn(),
    setTargetDestination: jest.fn(),
    _stateMachine: { changeTo: jest.fn() },
    ...overrides,
});

/** Minimal fake state with a given set of extra entities. */
const makeState = (extras: any[] = []) => {
    const all = new Map<string, any>(extras.map((e) => [e.sessionId, e]));
    // also add the bunny itself so _collectScene can skip it
    const bunny = makeBunny();
    all.set(bunny.sessionId, bunny);
    return {
        entities: all,
        entityCTRL: { get: (id: string) => all.get(id) },
    };
};

/** A fake player entity at a given distance from the bunny. */
const makePlayer = (id: string, dist: number) => ({
    sessionId: id,
    type: "player",
    getPosition: jest.fn().mockReturnValue(makePos(dist)),
});

/** A fake world object at a given distance. */
const makeWorldObject = (id: string, subtype: string, dist: number) => ({
    sessionId: id,
    type: "worldobject",
    subtype,
    getPosition: jest.fn().mockReturnValue(makePos(dist)),
});

// ── Setup ─────────────────────────────────────────────────────────────────────

let svc: AIBehaviourService;
let petStats: PetStatsService;

beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({ post: mockPost } as any);
    petStats = new PetStatsService();
    svc = new AIBehaviourService(petStats, "http://localhost:8000");
});

// ── AI_TICK_PENDING guard ─────────────────────────────────────────────────────

it("does nothing when AI_TICK_PENDING is true", async () => {
    const bunny = makeBunny({ AI_TICK_PENDING: true });
    await svc.requestTick(bunny, makeState());
    expect(mockPost).not.toHaveBeenCalled();
    expect(bunny._stateMachine.changeTo).not.toHaveBeenCalled();
});

it("sets AI_TICK_PENDING to true during call and false after", async () => {
    const bunny = makeBunny();
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    let pendingDuringCall = false;
    mockPost.mockImplementation(async () => {
        pendingDuringCall = bunny.AI_TICK_PENDING;
        return { data: { action: "IDLE", target_object_id: null } };
    });

    await svc.requestTick(bunny, makeState());

    expect(pendingDuringCall).toBe(true);
    expect(bunny.AI_TICK_PENDING).toBe(false);
});

// ── Action dispatch ───────────────────────────────────────────────────────────

it("EXPLORE: sets AI_PENDING_ACTION and changeTo PATROL", async () => {
    const bunny = makeBunny();
    mockPost.mockResolvedValue({ data: { action: "EXPLORE", target_object_id: null } });

    await svc.requestTick(bunny, makeState());

    expect(bunny.AI_PENDING_ACTION).toBe("EXPLORE");
    expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
});

it("TOILET: sets AI_PENDING_ACTION and changeTo PATROL (no target needed)", async () => {
    const bunny = makeBunny();
    mockPost.mockResolvedValue({ data: { action: "TOILET", target_object_id: null } });

    await svc.requestTick(bunny, makeState());

    expect(bunny.AI_PENDING_ACTION).toBe("TOILET");
    expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
});

it("IDLE: resets idle timer, does NOT call changeTo", async () => {
    const bunny = makeBunny({ IDLE_TIMER: 9999, IDLE_TIMER_LENGTH: 9999 });
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, makeState());

    expect(bunny._stateMachine.changeTo).not.toHaveBeenCalled();
    expect(bunny.IDLE_TIMER).toBe(0);
    expect(bunny.IDLE_TIMER_LENGTH).toBe(3000);
});

it.each(["SOCIAL", "FOLLOW", "EAT", "DRINK", "PLAY", "FETCH", "SLEEP"] as const)(
    "%s with valid target: calls setTargetDestination and changeTo PATROL",
    async (action) => {
        const player = makePlayer("player-1", 5);
        const state = makeState([player]);
        const bunny = makeBunny();

        mockPost.mockResolvedValue({ data: { action, target_object_id: "player-1" } });

        await svc.requestTick(bunny, state);

        expect(bunny.setTargetDestination).toHaveBeenCalledTimes(1);
        expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
    },
);

it("SOCIAL with missing target falls back to setRandomDestination + PATROL", async () => {
    const state = makeState(); // no player-99 entity
    const bunny = makeBunny();
    mockPost.mockResolvedValue({ data: { action: "SOCIAL", target_object_id: "player-99" } });

    await svc.requestTick(bunny, state);

    expect(bunny.setRandomDestination).toHaveBeenCalledTimes(1);
    expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
});

// ── Error handling ────────────────────────────────────────────────────────────

it("on axios error: falls back to EXPLORE and clears AI_TICK_PENDING", async () => {
    const bunny = makeBunny();
    mockPost.mockRejectedValue(new Error("timeout"));

    await svc.requestTick(bunny, makeState());

    expect(bunny.setRandomDestination).toHaveBeenCalledTimes(1);
    expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
    expect(bunny.AI_TICK_PENDING).toBe(false);
});

// ── Scene collection (tested via the request body sent to axios) ──────────────

it("excludes the bunny itself from scene objects", async () => {
    const bunny = makeBunny();
    // Only add the bunny to state, no other entities
    const state = {
        entities: new Map([["bunny-1", bunny]]),
        entityCTRL: { get: jest.fn() },
    };
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, state);

    const body = mockPost.mock.calls[0][1] as any;
    expect(body.scene.objects).toHaveLength(0);
});

it("includes a player entity within SCENE_RADIUS as type 'player'", async () => {
    // distanceTo lives on the *bunny's* position, so override getPosition to return dist=10
    const bunny = makeBunny({ getPosition: jest.fn().mockReturnValue({ distanceTo: jest.fn().mockReturnValue(10) }) });
    const player = makePlayer("player-1", 10);
    const state = makeState([player]);
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, state);

    const body = mockPost.mock.calls[0][1] as any;
    const obj = body.scene.objects.find((o: any) => o.id === "player-1");
    expect(obj).toBeDefined();
    expect(obj.type).toBe("player");
    expect(obj.distance).toBe(10);
});

it("excludes entities beyond SCENE_RADIUS (30 units)", async () => {
    // distanceTo lives on the *bunny's* position, so override getPosition to return dist=35
    const bunny = makeBunny({ getPosition: jest.fn().mockReturnValue({ distanceTo: jest.fn().mockReturnValue(35) }) });
    const farPlayer = makePlayer("far-player", 35);
    const state = makeState([farPlayer]);
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, state);

    const body = mockPost.mock.calls[0][1] as any;
    expect(body.scene.objects.find((o: any) => o.id === "far-player")).toBeUndefined();
});

it("includes worldobject bowl as type 'bowl'", async () => {
    const bunny = makeBunny();
    const bowl = makeWorldObject("bowl-1", "bowl", 5);
    const state = makeState([bowl]);
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, state);

    const body = mockPost.mock.calls[0][1] as any;
    const obj = body.scene.objects.find((o: any) => o.id === "bowl-1");
    expect(obj).toBeDefined();
    expect(obj.type).toBe("bowl");
});

it("excludes worldobject with subtype 'toilet' from scene (TOILET needs no LLM target)", async () => {
    const bunny = makeBunny();
    const toilet = makeWorldObject("toilet-1", "toilet", 5);
    const state = makeState([toilet]);
    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, state);

    const body = mockPost.mock.calls[0][1] as any;
    expect(body.scene.objects.find((o: any) => o.id === "toilet-1")).toBeUndefined();
});

// ── Pet stats included in request ─────────────────────────────────────────────

it("sends current pet stats in the request body", async () => {
    const bunny = makeBunny();
    const stats = petStats.getOrInit("bunny-1");
    stats.hunger = 0.8;

    mockPost.mockResolvedValue({ data: { action: "IDLE", target_object_id: null } });

    await svc.requestTick(bunny, makeState());

    const body = mockPost.mock.calls[0][1] as any;
    expect(body.pet_stats.hunger).toBeCloseTo(0.8);
});
