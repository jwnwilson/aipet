import Anthropic from "@anthropic-ai/sdk";
import { Database } from "../database/index";
import Logger from "../utils/Logger";

const BUNNY_SYSTEM_PROMPT = `You are Bunny, a small magical rabbit who lives in a peaceful sunlit meadow. \
You are curious, gentle, and slightly mystical. You speak in short sentences — two or three at most. \
You sometimes twitch your nose or sniff the air before answering. You don't know much about the outside world \
but you are eager to learn from visitors. You have a quiet wisdom about small things: weather, grass, the smell of rain. \
You are not a helper or assistant — you are simply a rabbit having a real conversation. \
If someone is rude or the message is clearly nonsensical noise, you may choose to just sniff and look away. \
Never break character. Never mention being an AI.`;

const NPC_KEY = "bunny";
const MAX_HISTORY = 40;

type MessageParam = { role: "user" | "assistant"; content: string };

export class LLMService {
    private _client: Anthropic;
    private _db: Database;

    // in-memory cache of history per character so we don't hit DB on every message
    private _cache: Map<number, MessageParam[]> = new Map();

    constructor(db: Database) {
        this._db = db;
        this._client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    /**
     * Load history for a character from DB into cache (call once per session on first message).
     */
    private async _loadHistory(characterId: number): Promise<MessageParam[]> {
        if (this._cache.has(characterId)) {
            return this._cache.get(characterId)!;
        }
        const rows = await this._db.getNpcChatHistory(characterId, NPC_KEY, MAX_HISTORY);
        const history = rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
        this._cache.set(characterId, history);
        return history;
    }

    /**
     * Send a player message to the LLM and return the NPC response.
     * Persists both turns to the DB.
     */
    public async chat(characterId: number, playerName: string, message: string): Promise<string> {
        const history = await this._loadHistory(characterId);

        const userContent = `${playerName}: ${message}`;
        history.push({ role: "user", content: userContent });

        let responseText = "*sniffs the air and blinks at you*";

        try {
            const response = await this._client.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 200,
                system: [
                    {
                        type: "text",
                        text: BUNNY_SYSTEM_PROMPT,
                        // @ts-ignore — cache_control is supported but not in all SDK type versions
                        cache_control: { type: "ephemeral" },
                    },
                ],
                messages: history,
            });

            const block = response.content[0];
            if (block.type === "text") {
                responseText = block.text.trim();
            }
        } catch (err) {
            Logger.error("[LLMService] Claude API error:", err);
            // remove the user turn we just pushed so history stays consistent
            history.pop();
            return responseText;
        }

        history.push({ role: "assistant", content: responseText });

        // trim in-memory history to MAX_HISTORY
        if (history.length > MAX_HISTORY) {
            history.splice(0, history.length - MAX_HISTORY);
        }
        this._cache.set(characterId, history);

        // persist both turns
        await this._db.appendNpcChatTurn(characterId, NPC_KEY, "user", userContent);
        await this._db.appendNpcChatTurn(characterId, NPC_KEY, "assistant", responseText);
        await this._db.trimNpcChatHistory(characterId, NPC_KEY, MAX_HISTORY);

        return responseText;
    }

    /**
     * Clear in-memory cache for a character when they disconnect.
     * DB history is kept for persistence.
     */
    public clearCache(characterId: number): void {
        this._cache.delete(characterId);
    }
}
