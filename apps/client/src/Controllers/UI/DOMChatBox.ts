import { PlayerMessage, ServerMsg } from "../../../../shared/types";

const COLORS: Record<string, string> = {
    event: "#ff9800",
    system: "#ffffff",
    chat: "#ffffff",
    npc: "#4caf50",
};

export class DOMChatBox {
    private _container: HTMLDivElement;
    private _messageList: HTMLDivElement;
    private _inputEl: HTMLInputElement;

    private _chatRoom;
    private _game;
    private _currentPlayer;
    private _entities;

    private _userScrolled: boolean = false;
    private _autoScrolling: boolean = false;

    // Shim so UserInterface.resize() can write chatPanel.top without errors.
    // The setter translates the Babylon-style negative-top offset into a CSS bottom value.
    public chatPanel: { top: string };

    // Exposes a focus() shim so PlayerInput can call this._ui._ChatBox.chatInput.focus()
    public get chatInput() {
        return { focus: () => this._inputEl?.focus() };
    }

    constructor(_playerUI, chatRoom, currentPlayer, entities, game) {
        this._chatRoom = chatRoom;
        this._game = game;
        this._currentPlayer = currentPlayer;
        this._entities = entities;

        this._buildDOM();
        this._bindRoomEvents();
    }

    private _buildDOM() {
        const container = document.createElement("div");
        container.id = "dom-chat-box";
        container.style.cssText = [
            "position:fixed",
            "bottom:35px",
            "left:15px",
            "width:350px",
            "height:200px",
            "display:flex",
            "flex-direction:column",
            "background:rgba(0,0,0,0.5)",
            "border-radius:4px",
            "font-family:Arial,sans-serif",
            "font-size:12px",
            "color:#fff",
            "z-index:100",
            "box-sizing:border-box",
            "padding:6px",
            "gap:4px",
        ].join(";");
        this._container = container;
        document.body.appendChild(container);

        // chatPanel shim — maps Babylon-style top="-30px;" → bottom:30px
        const container_ = container;
        this.chatPanel = {
            get top() {
                return container_.style.bottom;
            },
            set top(v: string) {
                const px = Math.abs(parseInt(v, 10));
                if (!isNaN(px)) container_.style.bottom = px + "px";
            },
        };

        // scrollable message area
        const messageList = document.createElement("div");
        messageList.style.cssText = [
            "flex:1",
            "overflow-y:scroll",
            "display:flex",
            "flex-direction:column",
            "gap:2px",
            "scrollbar-width:thin",
            "scrollbar-color:rgba(255,255,255,0.3) transparent",
        ].join(";");
        this._messageList = messageList;
        container.appendChild(messageList);

        messageList.addEventListener("scroll", () => {
            if (this._autoScrolling) return;
            const el = this._messageList;
            this._userScrolled = el.scrollHeight - el.scrollTop - el.clientHeight > 50;
        });

        // input row
        const inputRow = document.createElement("div");
        inputRow.style.cssText = "display:flex;gap:4px;height:24px;flex-shrink:0";
        container.appendChild(inputRow);

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Write message here...";
        input.style.cssText = [
            "flex:1",
            "background:rgba(255,255,255,0.1)",
            "border:none",
            "border-radius:2px",
            "color:#fff",
            "padding:0 6px",
            "font-size:12px",
            "outline:none",
        ].join(";");
        this._inputEl = input;
        inputRow.appendChild(input);

        const sendBtn = document.createElement("button");
        sendBtn.textContent = "SEND";
        sendBtn.style.cssText = [
            "background:rgba(255,255,255,0.15)",
            "border:none",
            "border-radius:2px",
            "color:#fff",
            "cursor:pointer",
            "font-size:12px",
            "padding:0 8px",
        ].join(";");
        inputRow.appendChild(sendBtn);

        // Stop keydown from reaching Babylon.js canvas listeners while typing
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter" && input.value.trim()) {
                this._sendMessage();
            }
        });
        sendBtn.addEventListener("click", () => {
            if (input.value.trim()) this._sendMessage();
            input.focus();
        });

        input.focus();
    }

    private _bindRoomEvents() {
        this._chatRoom.onMessage(ServerMsg.SERVER_MESSAGE, (message: PlayerMessage) => {
            this.addNotificationMessage("system", message.message, new Date());
        });

        this._chatRoom.onMessage(ServerMsg.CHAT_MESSAGE, (message: PlayerMessage) => {
            message.color = COLORS["chat"];
            this.processMessage(message);
        });

        this._chatRoom.onMessage(ServerMsg.NPC_MESSAGE, (data: { name: string; message: string }) => {
            const msg: PlayerMessage = {
                type: "npc",
                senderID: "NPC",
                name: data.name,
                message: data.message,
                timestamp: 0,
                createdAt: new Date().toISOString(),
                color: COLORS["npc"],
            };
            this._game.currentChats.push(msg);
            this._appendMessage(data.name + " says: ", data.message, COLORS["npc"]);
            this._showMessageAboveNpc(data.name, data.message);
        });
    }

    private _sendMessage() {
        this._chatRoom.send(ServerMsg.PLAYER_SEND_MESSAGE, {
            name: this._currentPlayer.name,
            message: this._inputEl.value,
            senderId: this._currentPlayer.sessionId,
        });
        this._inputEl.value = "";
        this._inputEl.focus();
    }

    public setCurrentPlayer(currentPlayer) {
        this._currentPlayer = currentPlayer;
    }

    public processMessage(message: PlayerMessage) {
        this._game.currentChats.push(message);
        const isOwn = this._currentPlayer && message.senderID === this._currentPlayer.sessionId;
        const prefix = isOwn ? "You said: " : "[GLOBAL] " + message.name + ": ";
        this._appendMessage(prefix, message.message, message.color ?? COLORS["chat"]);
        this.showChatMessageAboveEntity(message);
    }

    public addNotificationMessage(type: string, message: string, _date: Date) {
        const color = COLORS[type] ?? COLORS["system"];
        this._game.currentChats.push({
            type,
            senderID: "SYSTEM",
            message,
            name: "SYSTEM",
            timestamp: 0,
            createdAt: new Date().toISOString(),
            color,
        });
        this._appendMessage("", message, color);
    }

    public showChatMessageAboveEntity(msg: PlayerMessage) {
        let player = this._entities.get(msg.senderID);
        if (msg.senderID === this._currentPlayer?.sessionId) {
            player = this._currentPlayer;
        }
        if (player?.nameplateController) {
            player.nameplateController.addChatMessage(msg.message);
        }
    }

    private _showMessageAboveNpc(npcName: string, message: string) {
        this._entities.forEach((entity) => {
            if (entity.name === npcName && entity.nameplateController) {
                entity.nameplateController.addChatMessage(message, 1.5, "#1b5e20");
            }
        });
    }

    private _appendMessage(prefix: string, text: string, color: string) {
        const line = document.createElement("div");
        line.style.cssText = `color:${color};word-break:break-word;padding-left:4px;line-height:1.4;flex-shrink:0`;

        if (prefix) {
            const bold = document.createElement("b");
            bold.textContent = prefix;
            line.appendChild(bold);
        }
        line.appendChild(document.createTextNode(text));
        this._messageList.appendChild(line);

        if (!this._userScrolled) {
            this._scrollToBottom();
        }
    }

    private _scrollToBottom() {
        this._autoScrolling = true;
        this._messageList.scrollTop = this._messageList.scrollHeight;
        requestAnimationFrame(() => {
            this._autoScrolling = false;
        });
    }

    public destroy() {
        this._container?.remove();
    }
}
