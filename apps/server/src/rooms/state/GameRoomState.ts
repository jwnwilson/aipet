import { Client } from "@colyseus/core";
import { Schema, type, MapSchema, filterChildren } from "@colyseus/schema";
import { BrainSchema, Entity, EquipmentSchema, LootSchema, PlayerSchema } from "../schema";

import { spawnCTRL } from "../controllers/spawnCTRL";
import { entityCTRL } from "../controllers/entityCTRL";
import { gameDataCTRL } from "../controllers/gameDataCTRL";

import { GameRoom } from "../GameRoom";

import { NavMesh, Vector3 } from "../../../../shared/Libs/yuka-min";
import Logger from "../../utils/Logger";
import { ServerMsg } from "../../../../shared/types";
import { Config } from "../../../../shared/Config";

export class GameRoomState extends Schema {
    // networked variables
    /*
    @filterChildren(function (client, key, value: BrainSchema | LootSchema | PlayerSchema, root) {
        const isSelf = value.sessionId === client.sessionId;
        const player = (this as GameRoomState).entityCTRL.get(client.sessionId);
        const isWithinXBounds = Math.abs(player.x - value.x) < Config.PLAYER_VIEW_DISTANCE;
        const isWithinZBounds = Math.abs(player.z - value.z) < Config.PLAYER_VIEW_DISTANCE;
        const isWithinBounds = isWithinXBounds && isWithinZBounds;
        return isSelf || isWithinBounds;
    })*/
    @type({ map: Entity }) entities = new MapSchema<BrainSchema | LootSchema | PlayerSchema>();

    @type("number") serverTime: number = 0.0;

    // not networked variables
    public _gameroom: GameRoom = null;
    public spawnCTRL: spawnCTRL;
    public navMesh: NavMesh = null;
    public entityCTRL: entityCTRL;
    public gameData: gameDataCTRL;

    public config: Config;
    public roomDetails;

    private spawnTimer = 0;
    private spawnInterval = 60000;

    constructor(gameroom: GameRoom, _navMesh: NavMesh, ...args: any[]) {
        super(...args);
        this._gameroom = gameroom;
        this.config = gameroom.config;
        this.navMesh = _navMesh;

        this.init();
    }

    public async init() {
        // load game data
        // in the future, it'll be in the database
        this.gameData = new gameDataCTRL();
        await this.gameData.initialize();

        // get location details
        this.roomDetails = this.gameData.get("location", this._gameroom.metadata.location);

        // load controllers
        this.entityCTRL = new entityCTRL(this);
        this.spawnCTRL = new spawnCTRL(this);
    }

    public update(deltaTime: number) {
        // updating entities
        if (this.entityCTRL.hasEntities()) {
            this.entityCTRL.all.forEach((entity) => {
                entity.update(deltaTime);
                // todo: remove item/loot that's been on the ground over 5 minutes
            });
        }

        // update spawn controller
        this.spawnCTRL.update(deltaTime);
    }

    getEntity(sessionId) {
        return this.entityCTRL.get(sessionId);
    }

    deleteEntity(sessionId) {
        this.entities.delete(sessionId);
    }

    removeTarget(sessionId) {
        this.entityCTRL.all.forEach((entity) => {
            if (entity.type === "entity" && entity.AI_TARGET && entity.AI_TARGET.sessionId === sessionId) {
                entity.AI_TARGET = null;
            }
        });
    }

    /**
     * Add player
     * @param client
     */
    addPlayer(client: Client): void {
        // prepare player data
        let data = client.auth;

        let player_data = {
            strength: data.strength ?? 0,
            endurance: data.endurance ?? 0,
            agility: data.agility ?? 0,
            intelligence: data.intelligence ?? 0,
            wisdom: data.wisdom ?? 0,
            experience: data.experience ?? 0,
            gold: data.gold ?? 0,
            points: data.points ?? 0,
        };

        let player = {
            id: data.id,

            x: data.x ?? 0,
            y: data.y ?? 0,
            z: data.z ?? 0,
            rot: data.rot ?? 0,

            health: data.health,
            maxHealth: data.health,
            mana: data.mana,
            maxMana: data.mana,
            level: data.level,

            sessionId: client.sessionId,
            name: data.name,
            type: "player",
            race: data.race,
            material: data.material,
            head: data.head,

            location: data.location,
            sequence: 0,
            blocked: false,

            initial_player_data: player_data,
            initial_abilities: data.abilities ?? [],
            initial_inventory: data.inventory ?? [],
            initial_equipment: data.equipment ?? [],
            initial_quests: data.quests ?? [],
            initial_hotbar: data.hotbar ?? [],
        };

        this.entityCTRL.add(new PlayerSchema(this, player));

        // set player as online
        this._gameroom.database.toggleOnlineStatus(client.auth.id, 1);

        // log
        Logger.info(`[gameroom][onJoin] player ${client.sessionId} joined room ${this._gameroom.roomId}.`);
    }

    processMessage(client, type, data) {
        ////////////////////////////////////
        ////////// SERVER EVENTS ///////////
        ////////////////////////////////////

        if (type !== ServerMsg.PING) {
            Logger.info(`[gameroom][` + ServerMsg[type] + `] player message`, data);
        }

        if (type === ServerMsg.PING) {
            client.send(ServerMsg.PONG, data);
        }

        ////////////////////////////////////
        ////////// PLAYER EVENTS ///////////
        ////////////////////////////////////
        const playerState: PlayerSchema = this.getEntity(client.sessionId) as PlayerSchema;
        if (!playerState) {
            return false;
        }

        /////////////////////////////////////
        // on player ressurect
        if (type === ServerMsg.PLAYER_RESSURECT) {
            playerState.ressurect();
        }

        // make sure player is not dead
        if (playerState.isDead) {
            return false;
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        /////////////////////////////////////
        // on player reset position
        if (type === ServerMsg.PLAYER_RESET_POSITION) {
            playerState.resetPosition();
        }

        /////////////////////////////////////
        // on player input
        if (type === ServerMsg.PLAYER_MOVE) {
            playerState.moveCTRL.processPlayerInput(data);
        }

        // on player click to move
        if (type === ServerMsg.PLAYER_MOVE_TO) {
            playerState.moveCTRL.setTargetDestination(new Vector3(data.x, data.y, data.z));
        }

        /////////////////////////////////////
        // on player interact with entity (bunny / NPC)
        if (type === ServerMsg.PLAYER_INTERACT) {
            const targetState = this.getEntity(data.sessionId);
            Logger.info(`[PLAYER_INTERACT] player ${client.sessionId} interacted with ${data.sessionId}`);
            // placeholder: future AI dialogue logic goes here
        }

        /* DISABLED: combat, loot, abilities, quests
        if (type === ServerMsg.PLAYER_LEARN_SKILL) { ... }
        if (type === ServerMsg.PLAYER_ADD_STAT_POINT) { ... }
        if (type === ServerMsg.PLAYER_PICKUP) { ... }
        if (type === ServerMsg.PLAYER_DROP_ITEM) { ... }
        if (type === ServerMsg.PLAYER_BUY_ITEM) { ... }
        if (type === ServerMsg.PLAYER_SELL_ITEM) { ... }
        if (type === ServerMsg.PLAYER_USE_ITEM) { ... }
        if (type === ServerMsg.PLAYER_UNEQUIP_ITEM) { ... }
        if (type === ServerMsg.PLAYER_QUEST_UPDATE) { ... }
        if (type === ServerMsg.PLAYER_HOTBAR_ACTIVATED) { ... }
        */

        /////////
        /////// DEBUG /////////////////

        // debug: add random entities
        if (type === ServerMsg.DEBUG_BOTS) {
            this.spawnCTRL.debug_bots();
        }

        /*
        if (process.env.NODE_ENV !== "production") {
            let amountToChange = 100;

            // debug: add 100 entities
            if (type === ServerMsg.DEBUG_INCREASE_ENTITIES) {
                this.spawnCTRL.debug_increase(amountToChange);
            }

            // debug: delete 100 entities
            if (type === ServerMsg.DEBUG_DECREASE_ENTITIES) {
                let i = 1;
                this.spawnCTRL.debug_decrease(amountToChange);
                this.entities.forEach((entity) => {
                    if (
                        entity instanceof BrainSchema &&
                        entity.AI_SPAWN_INFO &&
                        (entity.AI_SPAWN_INFO.key === "lh_town_thief" || entity.AI_SPAWN_INFO.key === "lh_town_bandits") &&
                        i <= amountToChange
                    ) {
                        this.spawnCTRL.removeEntity(entity);
                        i++;
                    }
                });
            }
        }*/

        if (type === ServerMsg.DEBUG_REMOVE_ENTITIES) {
            if (this.entityCTRL.hasEntities()) {
                this.entityCTRL.all.forEach((entity) => {
                    if (entity.type !== "player") {
                        this.spawnCTRL.removeEntity(entity);
                    }
                });
            }
        }
    }
}
