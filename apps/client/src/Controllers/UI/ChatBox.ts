import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls/textBlock";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { InputText } from "@babylonjs/gui/2D/controls/inputText";
import { ScrollViewer } from "@babylonjs/gui/2D/controls/scrollViewers/scrollViewer";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { PlayerMessage, ServerMsg } from "../../../../shared/types";
import { generatePanel, getBg, getPadding } from "./Theme";

export class ChatBox {
    private _playerUI;
    private _chatUI: StackPanel;
    private _chatUIScroll: ScrollViewer;
    private _chatRoom;
    private _game;
    private _currentPlayer;
    private _entities;
    private _colors;

    private _chatButton;
    private _chatInput;
    public chatPanel;

    private _renderedCount: number = 0;
    private _scrollObserver = null;
    private _scrollFramesLeft: number = 0;

    public messages: PlayerMessage[] = [];

    constructor(_playerUI, _chatRoom, _currentPlayer, _entities, _game) {
        this._playerUI = _playerUI;
        this._chatRoom = _chatRoom;
        this._game = _game;
        this._currentPlayer = _currentPlayer;
        this._entities = _entities;

        this._colors = {
            event: "orange",
            system: "white",
            chat: "white",
            npc: "#4caf50",
        };

        // create ui
        this._createUI();

        // add ui events
        this._createEvents();

        // add messages
        this._refreshChatBox();
    }

    get chatInput(): InputText {
        return this._chatInput;
    }

    _createUI() {
        const chatPanel = generatePanel("chatPanel", "350px;", "200px", "-35px", "15px");
        chatPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        chatPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        chatPanel.isPointerBlocker = true;
        this._playerUI.addControl(chatPanel);
        this.chatPanel = chatPanel;

        const paddingPanel = new Rectangle("paddingPanel");
        paddingPanel.width = 1;
        paddingPanel.height = 1;
        paddingPanel.thickness = 0;
        paddingPanel.setPaddingInPixels(getPadding());
        chatPanel.addControl(paddingPanel);

        // add chat input
        const chatInput = new InputText("chatInput");
        chatInput.width = 0.8;
        chatInput.height = "24px;";
        chatInput.top = "0px";
        chatInput.color = "#FFF";
        chatInput.fontSize = "12px";
        chatInput.thickness = 0;
        chatInput.background = getBg();
        chatInput.placeholderText = "Write message here...";
        chatInput.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        chatInput.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        paddingPanel.addControl(chatInput);
        this._chatInput = chatInput;

        // add chat send button
        const chatButton = Button.CreateSimpleButton("chatButton", "SEND");
        chatButton.width = 0.2;
        chatButton.height = "24px;";
        chatButton.top = "0px";
        chatButton.color = "#FFF";
        chatButton.fontSize = "12px";
        chatButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        chatButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        paddingPanel.addControl(chatButton);
        this._chatButton = chatButton;

        // add scrollable container
        const chatScrollViewer = new ScrollViewer("chatScrollViewer");
        chatScrollViewer.width = 1;
        chatScrollViewer.height = "168px;";
        chatScrollViewer.top = "-22px";
        chatScrollViewer.thickness = 0;
        chatScrollViewer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        chatScrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        paddingPanel.addControl(chatScrollViewer);
        this._chatUIScroll = chatScrollViewer;

        // add stack panel
        const chatStackPanel = new StackPanel("chatStackPanel");
        chatStackPanel.width = "100%";
        chatStackPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        chatStackPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        chatStackPanel.paddingTop = "5px;";
        chatScrollViewer.addControl(chatStackPanel);
        this._chatUI = chatStackPanel;

        // focus chat
        chatInput.focus();

        // intial refresh chatbox
        this._refreshChatBox();
    }

    _createEvents() {
        // on click send
        this._chatButton.onPointerDownObservable.add(() => {
            this.sendMessage();
        });

        // chatbox on enter event
        this._chatInput.onKeyboardEventProcessedObservable.add((ev) => {
            if ((ev.key === "Enter" || ev.code === "Enter") && this._chatInput.text != "") {
                this.sendMessage();
            }
        });

        this._chatRoom.onMessage(ServerMsg.SERVER_MESSAGE, (message: PlayerMessage) => {
            message.color = this._colors["chat"];
            this.addNotificationMessage("system", message.message, new Date());
        });

        // receive player chat message
        this._chatRoom.onMessage(ServerMsg.CHAT_MESSAGE, (message: PlayerMessage) => {
            message.color = this._colors["chat"];
            this.processMessage(message);
        });

        // receive NPC (Bunny) message
        this._chatRoom.onMessage(ServerMsg.NPC_MESSAGE, (data: { name: string; message: string }) => {
            this._game.currentChats.push({
                type: "npc",
                senderID: "NPC",
                name: data.name,
                message: data.message,
                timestamp: 0,
                createdAt: new Date().toISOString(),
                color: this._colors["npc"],
            });
            this._refreshChatBox();
            this._showMessageAboveNpc(data.name, data.message);
        });
    }

    // set current player
    public setCurrentPlayer(currentPlayer) {
        this._currentPlayer = currentPlayer;
    }

    // process incoming messages
    public processMessage(message) {
        this._game.currentChats.push(message);
        this._refreshChatBox();
        this.showChatMessageAboveEntity(message);
    }

    // process incoming messages
    public addNotificationMessage(type, message, date) {
        this.processNotificationMessage({
            type: type,
            senderID: "SYSTEM",
            message: message,
            name: "SYSTEM",
            timestamp: 0,
            createdAt: date,
            color: this._colors[type],
        });
    }

    // process incoming messages
    public processNotificationMessage(message) {
        this._game.currentChats.push(message);
        this._refreshChatBox();
    }

    // show NPC response above the NPC's mesh in the 3D scene
    private _showMessageAboveNpc(npcName: string, message: string) {
        this._entities.forEach((entity) => {
            if (entity.name === npcName && entity.nameplateController) {
                entity.nameplateController.addChatMessage(message, 1.5, "#1b5e20");
            }
        });
    }

    // show chat message above player
    public showChatMessageAboveEntity(msg: PlayerMessage) {
        let player = this._entities.get(msg.senderID);
        if (msg.senderID === this._currentPlayer.sessionId) {
            player = this._currentPlayer;
        }
        if (player && player.nameplateController) {
            player.nameplateController.addChatMessage(msg.message);
        }
    }

    // send message to server
    private sendMessage() {
        this._chatRoom.send(ServerMsg.PLAYER_SEND_MESSAGE, {
            name: this._currentPlayer.name,
            message: this._chatInput.text,
            senderId: this._currentPlayer.sessionId,
        });
        this._chatInput.text = "";
        this._chatInput.focus();
    }

    // chat refresh
    public addChatMessage(msg: PlayerMessage) {
        this.messages.push(msg);
        this._refreshChatBox();
    }

    // chat refresh — append-only to preserve existing layout heights
    private _refreshChatBox() {
        if (!this._chatUI) {
            return false;
        }

        const chats = this._game.currentChats;

        // Full rebuild only if history was cleared (count went backwards)
        if (chats.length < this._renderedCount) {
            this._chatUI.getDescendants().forEach((el) => el.dispose());
            this._renderedCount = 0;
        }

        for (let i = this._renderedCount; i < chats.length; i++) {
            const msg = chats[i];

            let prefix = "[GLOBAL] " + msg.name + ": ";
            if (msg.type === "npc") {
                prefix = msg.name + " says: ";
            } else if (this._currentPlayer) {
                prefix = msg.senderID == this._currentPlayer.sessionId ? "You said: " : "[GLOBAL] " + msg.name + ": ";
            }

            const roomTxt = new TextBlock("chatMsgTxt_" + msg.createdAt);
            roomTxt.width = "100%";
            roomTxt.paddingLeft = "5px";
            roomTxt.paddingBottom = "2px";
            roomTxt.text = prefix + msg.message;
            roomTxt.textHorizontalAlignment = 0;
            roomTxt.fontSize = "12px";
            roomTxt.color = msg.color;
            roomTxt.textWrapping = TextWrapping.WordWrap;
            roomTxt.resizeToFit = true;
            roomTxt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            roomTxt.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            this._chatUI.addControl(roomTxt);
        }

        this._renderedCount = chats.length;
        this._scheduleScrollToBottom();
    }

    // Each call resets the countdown to 5 frames. A single persistent observer
    // counts down and fires scroll only after 5 consecutive frames with no new
    // messages. This handles the first-overflow case: scrollbar appears in frame
    // ~3 (stealing 20px of content width), TextBlocks reflow in frame ~4,
    // ScrollViewerWindow reads stabilised heights in frame ~5.
    // Resetting on every message means an NPC reply that arrives mid-countdown
    // (e.g. during the player-message countdown) gets its own full 5-frame wait.
    private _scheduleScrollToBottom() {
        this._scrollFramesLeft = 5;
        if (this._scrollObserver) return;

        this._scrollObserver = this._game.scene.onAfterRenderObservable.add(() => {
            this._scrollFramesLeft--;
            if (this._scrollFramesLeft > 0) return;

            this._game.scene.onAfterRenderObservable.remove(this._scrollObserver);
            this._scrollObserver = null;
            if (this._chatUIScroll) {
                this._chatUIScroll.verticalBar.value = 1;
            }
        });
    }
}
