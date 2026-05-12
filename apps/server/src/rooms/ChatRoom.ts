import { Room, Client } from "@colyseus/core";
import { ChatSchema } from "./schema/ChatSchema";
import Logger from "../utils/Logger";
import { ServerMsg } from "../../../shared/types";
import { Database } from "../database/index";
import { LLMService } from "../services/LLMService";
import { Config } from "../../../shared/Config";

export class ChatRoom extends Room {
    public maxClients = 1000;

    private _database: Database;
    private _llm: LLMService;

    // maps colyseus sessionId → character_id
    private _characterIds: Map<string, number> = new Map();

    // When room is initialized
    async onCreate(options: any) {
        Logger.info("[chat_room][onCreate] room created.", options);

        this.autoDispose = true;

        this._database = new Database(new Config());
        await this._database.init();
        this._llm = new LLMService(this._database);

        this.onMessage(ServerMsg.PLAYER_SEND_MESSAGE, async (client, message) => {
            Logger.info("[chat_room][message] message received from " + client.sessionId, message);

            // always broadcast the player message so everyone sees it immediately
            this.broadcast(ServerMsg.CHAT_MESSAGE, this.generateMessage(message.senderId, message));

            // get character_id for this session (may be 0 if not passed at join)
            const characterId = this._characterIds.get(client.sessionId) ?? 0;

            // fire LLM call async — don't block the handler
            this._respondAsNpc(client, characterId, message.name, message.message);
        });
    }

    private async _respondAsNpc(client: Client, characterId: number, playerName: string, playerMessage: string) {
        try {
            const reply = await this._llm.chat(characterId, playerName, playerMessage);
            this.broadcast(ServerMsg.NPC_MESSAGE, { name: "Bunny", message: reply });
        } catch (err) {
            Logger.error("[chat_room] LLM error, sending fallback.", err);
            this.broadcast(ServerMsg.NPC_MESSAGE, { name: "Bunny", message: "*sniffs the air and blinks at you*" });
        }
    }

    // When client successfully join the room
    onJoin(client: Client, options: any, auth: any) {
        Logger.info("[chat_room][message] client joined " + client.sessionId, options);

        if (options.character_id) {
            this._characterIds.set(client.sessionId, Number(options.character_id));
        }

        setTimeout(() => {
            this.broadcast(
                ServerMsg.SERVER_MESSAGE,
                this.generateMessage(options.sessionId, {
                    type: "system",
                    name: options.name,
                    message: options.name + " has joined the room.",
                })
            );
        }, 1000);
    }

    // When a client leaves the room
    onLeave(client: Client, consented: boolean) {
        const characterId = this._characterIds.get(client.sessionId);
        if (characterId !== undefined) {
            this._llm.clearCache(characterId);
            this._characterIds.delete(client.sessionId);
        }
        client.leave();
    }

    // Cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
    onDispose() {}

    // prepare chat message to be sent
    generateMessage(sessionId: string = "system", incomingMsg: any) {
        let msg = new ChatSchema();
        msg.senderID = sessionId;
        msg.name = incomingMsg.name;
        msg.message = incomingMsg.message;
        console.log(sessionId, msg);
        return msg;
    }
}
