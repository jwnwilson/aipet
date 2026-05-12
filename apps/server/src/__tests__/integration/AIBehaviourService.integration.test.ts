import http from "http";
import { AIBehaviourService } from "../../services/AIBehaviourService";
import { PetStatsService } from "../../services/PetStatsService";
import Logger from "../../utils/Logger";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makePos = (dist = 5) => ({ distanceTo: jest.fn().mockReturnValue(dist) });

const makeBunny = (overrides: Record<string, any> = {}) => ({
    sessionId: "bunny-1",
    type: "entity",
    AI_TICK_PENDING: false,
    AI_SPAWN_INFO: { key: "bunny" },
    IDLE_TIMER: 0,
    IDLE_TIMER_LENGTH: 3000,
    getPosition: jest.fn().mockReturnValue(makePos()),
    setRandomDestination: jest.fn(),
    setTargetDestination: jest.fn(),
    _stateMachine: { changeTo: jest.fn() },
    ...overrides,
});

const makeState = (extras: any[] = []) => {
    const all = new Map<string, any>(extras.map((e) => [e.sessionId, e]));
    const bunny = makeBunny();
    all.set(bunny.sessionId, bunny);
    return {
        entities: all,
        entityCTRL: { get: (id: string) => all.get(id) },
    };
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("AIBehaviourService — integration", () => {
    let server: http.Server;
    let serverUrl: string;
    let petStats: PetStatsService;
    let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

    const jsonReply = (res: http.ServerResponse, body: object, status = 200) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
    };

    beforeEach((done) => {
        handler = (_req, res) => { res.writeHead(503); res.end(); };
        server = http.createServer((req, res) => handler(req, res));
        server.listen(0, () => {
            const addr = server.address() as { port: number };
            serverUrl = `http://localhost:${addr.port}`;
            petStats = new PetStatsService();
            done();
        });
    });

    afterEach((done) => {
        server.closeAllConnections?.();
        server.close(done);
    });

    // ── POST /infer ────────────────────────────────────────────────────────────

    describe("POST /infer", () => {
        it("happy path: EXPLORE response moves bunny to random destination", async () => {
            handler = (_req, res) =>
                jsonReply(res, { action: "EXPLORE", target_object_id: null, confidence: 0.9 });

            const svc = new AIBehaviourService(petStats, serverUrl, 2000);
            const bunny = makeBunny();
            await svc.requestTick(bunny, makeState());

            expect(bunny.setRandomDestination).toHaveBeenCalledTimes(1);
            expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
        });

        it("happy path: IDLE response resets idle timer without patrolling", async () => {
            handler = (_req, res) =>
                jsonReply(res, { action: "IDLE", target_object_id: null, confidence: 1.0 });

            const svc = new AIBehaviourService(petStats, serverUrl, 2000);
            const bunny = makeBunny({ IDLE_TIMER: 9999 });
            await svc.requestTick(bunny, makeState());

            expect(bunny._stateMachine.changeTo).not.toHaveBeenCalled();
            expect(bunny.IDLE_TIMER).toBe(0);
        });

        it("missing target in state: falls back to random destination + PATROL", async () => {
            handler = (_req, res) =>
                jsonReply(res, { action: "SOCIAL", target_object_id: "ghost-id", confidence: null });

            const svc = new AIBehaviourService(petStats, serverUrl, 2000);
            const bunny = makeBunny();
            // makeState() has no entity with id "ghost-id"
            await svc.requestTick(bunny, makeState());

            expect(bunny.setRandomDestination).toHaveBeenCalledTimes(1);
            expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
        });

        it("HTTP 500: falls back to EXPLORE", async () => {
            handler = (_req, res) => { res.writeHead(500); res.end("error"); };

            const svc = new AIBehaviourService(petStats, serverUrl, 2000);
            const bunny = makeBunny();
            await svc.requestTick(bunny, makeState());

            expect(bunny.setRandomDestination).toHaveBeenCalledTimes(1);
            expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
            expect(bunny.AI_TICK_PENDING).toBe(false);
        });

        it("timeout: falls back to EXPLORE and clears AI_TICK_PENDING", async () => {
            // Server intentionally never responds so the client times out
            handler = () => { /* hang */ };

            const svc = new AIBehaviourService(petStats, serverUrl, 150);
            const bunny = makeBunny();
            await svc.requestTick(bunny, makeState());

            expect(bunny.setRandomDestination).toHaveBeenCalledTimes(1);
            expect(bunny._stateMachine.changeTo).toHaveBeenCalledWith("PATROL");
            expect(bunny.AI_TICK_PENDING).toBe(false);
        });
    });

    // ── GET /health ────────────────────────────────────────────────────────────

    describe("GET /health", () => {
        it("logs model name when service is reachable", async () => {
            handler = (_req, res) =>
                jsonReply(res, { status: "ok", model: "bunny-llm-v1.gguf" });

            const spy = jest.spyOn(Logger, "info");
            await AIBehaviourService.checkHealth(serverUrl);

            expect(spy).toHaveBeenCalledWith(expect.stringContaining("bunny-llm-v1.gguf"));
        });

        it("logs a warning (does not throw) when service is unreachable", async () => {
            const spy = jest.spyOn(Logger, "warning");
            // Point at a port nothing is listening on
            await AIBehaviourService.checkHealth("http://localhost:19991");

            expect(spy).toHaveBeenCalledWith(expect.stringContaining("[aipet_llm]"));
        });

        it("logs 'unknown' model when health response omits model field", async () => {
            handler = (_req, res) => jsonReply(res, { status: "ok" });

            const spy = jest.spyOn(Logger, "info");
            await AIBehaviourService.checkHealth(serverUrl);

            expect(spy).toHaveBeenCalledWith(expect.stringContaining("unknown"));
        });
    });
});
