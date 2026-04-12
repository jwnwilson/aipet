import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { EntityActions } from "./Entity/EntityActions";
import { Entity } from "./Entity";
import State from "../../../client/src/Screens/Screens";
import { Ability, EntityState, ServerMsg } from "../../../shared/types";
import { GameScene } from "../Screens/GameScene";
import { PlayerAbility } from "./Player/PlayerAbility";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Color3 } from "@babylonjs/core/Maths/math.color";

export class Player extends Entity {
    public game;
    public entities;
    public interval;
    public abilityController: PlayerAbility;

    public onPointerObservable;

    public player_data;
    public moveDecal;

    public closestEntity;
    public closestEntityDistance;

    public input_sequence: number = 0;

    // sounds
    public footstepInterval = 400;
    public footstepCurrent = 0;

    constructor(name, scene, gamescene: GameScene, entity) {
        super(name, scene, gamescene, entity);

        this.entities = gamescene._entities;

        this._input = gamescene._input;

        this.type = "player";

        this.spawnPlayer();
    }

    private async spawnPlayer() {
        // add player controllers
        this.cameraController = this._gamescene._camera;
        this.cameraController.attach(this);
        this.actionsController = new EntityActions(this._scene, this._game._loadedAssets, this.entities, this._gamescene);
        // DISABLED: this.abilityController = new PlayerAbility(this);

        // register player server messages
        this.registerServerMessages();

        // player mouse events
        this.onPointerObservable = this._scene.onPointerObservable.add((pointerInfo: any) => {
            // on left mouse click
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 0) {
                this.leftClick(pointerInfo);
            }

            // on right mouse click
            if (pointerInfo.type === PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 2) {
                this.rightClick(pointerInfo);
            }

            // on wheel mouse
            if (pointerInfo.type === PointerEventTypes.POINTERWHEEL) {
                /////////////////////////////////////////////////////////////////////
                // camera zoom on mouse wheel
                this.cameraController.zoom(pointerInfo.event.deltaY);
            }

            // check if selected entity is too far
            // todo: should be done on server side?
            if (this._game.selectedEntity && this._game.selectedEntity.sessionId) {
                let currentPos = this.getPosition();
                let targetPos = this._game.selectedEntity.getPosition();
                let distanceBetween = Vector3.Distance(currentPos, targetPos);
                if (distanceBetween > this._game.config.PLAYER_LOSE_FOCUS_DISTANCE) {
                    this._game.selectedEntity = null;
                }
            }
        });
    }

    getMeshMetadata(pointerInfo) {
        if (!pointerInfo._pickInfo.pickedMesh) return false;

        if (!pointerInfo._pickInfo.pickedMesh.metadata) return false;

        if (pointerInfo._pickInfo.pickedMesh.metadata === null) return false;

        return pointerInfo._pickInfo.pickedMesh.metadata;
    }

    public rightClick(pointerInfo) {
        let metadata = this.getMeshMetadata(pointerInfo);

        if (!metadata) return false;

        if (metadata.type === "entity") {
            let target = this.entities[metadata.sessionId];
        }
    }

    // process left click for player
    public leftClick(pointerInfo) {
        let metadata = this.getMeshMetadata(pointerInfo);

        if (!metadata) return false;

        // select entity / interact
        if (metadata.type === "player" || metadata.type === "entity") {
            let targetSessionId = metadata.sessionId;
            let target = this.entities.get(targetSessionId);

            // show nameplate
            if (target.characterLabel) {
                target.characterLabel.isVisible = true;
            }

            if (!target.spawnInfo?.interactable) return false;

            // if close enough, open dialog
            let playerPos = this.getPosition();
            let entityPos = target.getPosition();
            let distanceBetween = Vector3.Distance(playerPos, entityPos);
            if (distanceBetween < this._game.config.PLAYER_INTERACTABLE_DISTANCE) {
                // notify server of interaction
                this._game.sendMessage(ServerMsg.PLAYER_INTERACT, { sessionId: target.sessionId });

                // open dialog
                this._ui.panelDialog.open(target);

                // stop movement while talking
                this._input.left_click = false;
                this._input.vertical = 0;
                this._input.horizontal = 0;
                this._input.player_can_move = false;
            }
        }

        // DISABLED: item pickup

        // move to clicked point
        if (metadata.type === "environment" && !this.isDead) {
            /*
            // deselect any entity
            this._game.selectedEntity = false;

            // removed click to move
            // todo: add client prediction.
            let destination = pointerInfo._pickInfo.pickedPoint;
            let pickedMesh = pointerInfo._pickInfo.pickedMesh;

            console.log("[LEFT CLICK]", destination);

            const foundPath = this._navMesh.getRegionForPoint(destination);
            if (foundPath) {
                // remove decal if already exist
                if (this.moveDecal) {
                    this.moveDecal.dispose();
                }

                // add decal to show destination
                var decalMaterial = this._scene.getMaterialByName("decal_target");
                this.moveDecal = MeshBuilder.CreateDecal("decal", pickedMesh, { position: destination });
                this.moveDecal.material = decalMaterial;

                // remove decal after 1 second
                setTimeout(() => {
                    this.moveDecal.dispose();
                }, 1000);

                // send to server
                this._game.sendMessage(ServerMsg.PLAYER_MOVE_TO, {
                    x: destination._x,
                    y: destination._y,
                    z: destination._z,
                });
            }
            */
        }
    }

    // update at engine rate 60fps
    public update(delta) {
        // run super function first
        super.update(delta);

        // action controller
        if (this.actionsController) {
            this.actionsController.update();
        }

        // update camera
        this.cameraController.update();
    }

    // update at server rate
    public updateServerRate(delta) {
        // run super function first
        super.updateServerRate(delta);

        if (this.moveController) {
            // process player movement
            this.moveController.processMove();
        }

        // DISABLED: ability controller update (combat system)
        // DISABLED: dead / ressurect UI

        // sounds
        if (this.isMoving && this.footstepCurrent > this.footstepInterval) {
            this._gamescene._sound.play("SOUND_player_walking");
            this.footstepCurrent = 0;
        }
        this.footstepCurrent += delta;
    }

    public updateSlowRate(delta: any): void {
        // run super function first
        super.updateSlowRate(delta);

        // close dialog if player walks away from interactable entity
        if (this.isMoving && this.closestEntity?.interactableButtons) {
            if (this.closestEntityDistance > 5) {
                this._ui.panelDialog.close();
            }
        }
    }

    /**
     * This function is called every time the player moves, so that
     * the closest interactable entity can be highlighted on screen.
     */
    public findCloseToInteractableEntity() {
        let minDistanceSquared = Infinity;
        let playerPos = this.getPosition();
        this.entities.forEach((entity) => {
            if (entity.type === "entity" && entity.interactableButtons && entity.health > 0) {
                entity.interactableButtons.isVisible = false;
                let entityPos = entity.getPosition();
                let distanceSquared = Vector3.Distance(playerPos, entityPos);
                if (distanceSquared < minDistanceSquared) {
                    this.closestEntity = entity;
                    this.closestEntityDistance = distanceSquared;
                    minDistanceSquared = distanceSquared;
                }
            }
        });
    }

    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////
    // server message handler

    public registerServerMessages() {
        this._room.onMessage(ServerMsg.SERVER_MESSAGE, (data) => {
            console.log("ServerMsg.SERVER_MESSAGE", data);
            this._ui._ChatBox.addNotificationMessage(data.type, data.message, data.message);
        });

        // on teleport confirmation
        this._room.onMessage(ServerMsg.PLAYER_TELEPORT, (location) => {
            console.log("ServerMsg.PLAYER_TELEPORT", location);
            this.teleport(location);
        });

        // DISABLED: PLAYER_CASTING_START, PLAYER_CASTING_CANCEL, PLAYER_ABILITY_CAST (combat system)
    }

    public async remove() {
        super.remove();

        // remove any pointer event
        if (this.onPointerObservable && this._scene.onPointerObservable.hasObservers()) {
            this._scene.onBeforeRenderObservable.remove(this.onPointerObservable);
        }
    }

    /**
     * when current player quits the game
     */
    public async quit() {
        // leave colyseus rooms
        if (this._room) {
            await this._room.leave();
        }

        if (this._game.currentChat) {
            await this._game.currentChat.leave();
        }

        // clear cached chats
        this._game.currentChats = [];

        // switch scene
        this._game.setScene(State.CHARACTER_SELECTION);
    }

    public async teleport(location) {
        // leave colyseus room
        if (this._room) {
            await this._room.leave();
        }

        // update auth data
        this._game.setLocation(location);

        // switch scene
        this._game.setScene(State.GAME);
    }
}
