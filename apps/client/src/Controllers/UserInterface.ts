import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";

import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";

import { ChatBox, DebugBox, MainMenu, Panel_Dialog, Cursor, Watermark } from "./UI";

import { Room } from "colyseus.js";

import { Entity } from "../Entities/Entity";
import { Player } from "../Entities/Player";
import { Item } from "../Entities/Item";
import { WorldObject } from "../Entities/WorldObject";

import { GameController } from "./GameController";

export class UserInterface {
    public _game: GameController;
    public _scene: Scene;
    public _engine: Engine;
    public _room: Room;
    private _chatRoom: Room;
    public _entities: Map<string, Player | Entity | Item | WorldObject>;
    private _currentPlayer;

    public MAIN_ADT: AdvancedDynamicTexture;
    public LABELS_ADT: AdvancedDynamicTexture;
    public _playerUI;

    public _loadedAssets; // delegated from _game._loadedAssets; consumed by Panel base class

    public _ChatBox: ChatBox;
    public _DebugBox: DebugBox;
    public _MainMenu: MainMenu;
    public _Cursor: Cursor;
    public _Watermark: Watermark;

    // active panel
    public panelDialog: Panel_Dialog;

    // stub references so Panel base class and MainMenu compile without errors
    public panelInventory = null;
    public panelAbilities = null;
    public panelCharacter = null;
    public panelHelp = null;
    public panelQuests = null;

    constructor(game: GameController, entities: Map<string, Player | Entity | Item | WorldObject>, currentPlayer) {
        this._game = game;
        this._scene = game.scene;
        this._engine = game.engine;
        this._room = game.currentRoom;
        this._chatRoom = game.currentChat;
        this._entities = entities;
        this._currentPlayer = currentPlayer;
        this._loadedAssets = game._loadedAssets;

        const LABELS_ADT = AdvancedDynamicTexture.CreateFullscreenUI("UI_Names", true, this._scene);
        this.LABELS_ADT = LABELS_ADT;

        const uiLayer = AdvancedDynamicTexture.CreateFullscreenUI("UI_Player", true, this._scene);
        uiLayer.renderScale = 1;
        this.MAIN_ADT = uiLayer;

        const uiLayerContainer = new Rectangle("uiLayerContainer");
        uiLayerContainer.width = 1;
        uiLayerContainer.height = 1;
        uiLayerContainer.thickness = 0;
        uiLayerContainer.fontFamily = "Arial, sans-serif";
        uiLayerContainer.fontSize = "14px;";
        uiLayer.addControl(uiLayerContainer);

        this._playerUI = uiLayerContainer;
    }

    public setCurrentPlayer(currentPlayer) {
        this._currentPlayer = currentPlayer;

        this._Cursor = new Cursor(this);
        this._Watermark = new Watermark(this);
        this._DebugBox = new DebugBox(this._playerUI, this._engine, this._scene, this._room, this._currentPlayer, this._entities);
        this._MainMenu = new MainMenu(this, currentPlayer);
        this._ChatBox = new ChatBox(this._playerUI, this._chatRoom, currentPlayer, this._entities, this._game);

        this.panelDialog = new Panel_Dialog(this, currentPlayer, {
            name: "Dialog Panel",
            width: "350px;",
            height: "400px;",
            top: "-50px;",
            left: "0px;",
            horizontal_position: Control.HORIZONTAL_ALIGNMENT_CENTER,
            vertical_position: Control.VERTICAL_ALIGNMENT_CENTER,
        });

        this.resize();
    }

    // no-op drag stubs — called by Panel base class; no draggable panels are active
    public startDragging(_panel) {}
    public stopDragging() {}

    public update() {}

    public slow_update() {
        if (this._DebugBox) {
            this._DebugBox.update();
        }
        if (this.panelDialog) {
            this.panelDialog.update();
        }
    }

    public resize() {
        if (this._engine.getRenderWidth() < 1100) {
            if (this._ChatBox) {
                this._ChatBox.chatPanel.top = "-115px;";
            }
        } else {
            if (this._ChatBox) {
                this._ChatBox.chatPanel.top = "-30px;";
            }
        }
    }
}
