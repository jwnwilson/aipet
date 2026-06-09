import { randomNumberInRange } from "../../../../shared/Utils";
import { AI_STATE, PetAction, ServerMsg } from "../../../../shared/types";
import { State } from "../brain/StateManager";

function getCompletionMessage(action: PetAction): string | null {
    switch (action) {
        case "EAT":
        case "DRINK":
            return "That was yummy!";
        case "SLEEP":
            return "That was a nice nap!";
        case "SOCIAL":
        case "FOLLOW":
            return "Hello human!";
        case "PLAY":
        case "FETCH":
            return "I like my toy!";
        default:
            return null;
    }
}

class IdleState extends State {
    enter(owner) {
        // apply stat reset for the action that just completed
        if (owner.AI_PENDING_ACTION && owner._state.aiService) {
            owner._state.aiService.applyPendingAction(owner.sessionId, owner.AI_PENDING_ACTION);
            const completionMsg = getCompletionMessage(owner.AI_PENDING_ACTION);
            if (completionMsg && owner._state._gameroom) {
                owner._state._gameroom.broadcast(ServerMsg.NPC_MESSAGE, { name: owner.name, message: completionMsg });
            }
            owner.AI_PENDING_ACTION = null;
        }
        owner.IDLE_TIMER = 0;
        owner.IDLE_TIMER_LENGTH = randomNumberInRange(1000, 4000);
        owner.ai_state = AI_STATE.IDLE;
    }

    execute(owner) {
        const isBunny = owner.AI_SPAWN_INFO?.key === "bunny" && owner._state.aiService;

        if (isBunny) {
            // While a tick is pending, freeze the idle timer and wait for the response
            if (owner.AI_TICK_PENDING) return;

            owner.IDLE_TIMER += owner._state.config.updateRate;
            if (owner.IDLE_TIMER > owner.IDLE_TIMER_LENGTH) {
                // Fire the AI behaviour tick; it will change state when it resolves
                owner._state.aiService.requestTick(owner, owner._state);
            }
            return;
        }

        // Non-bunny entities: original patrol logic
        if (owner.AI_SPAWN_INFO.type == "static") {
            return false;
        }

        if (owner.isAnyPlayerInAggroRange() && owner.AI_SPAWN_INFO.aggressive === true) {
            owner.setPlayerTarget(owner.AI_CLOSEST_PLAYER);
            owner._stateMachine.changeTo("CHASE");
        }

        if (owner.hasValidTarget() && owner.AI_SPAWN_INFO.aggressive === true) {
            owner._stateMachine.changeTo("CHASE");
            return false;
        }

        owner.IDLE_TIMER += owner._state.config.updateRate;
        if (owner.IDLE_TIMER > owner.IDLE_TIMER_LENGTH) {
            owner._stateMachine.changeTo("PATROL");
            return false;
        }
    }

    exit(_owner) {}
}

export default IdleState;
