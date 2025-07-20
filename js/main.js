import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { SceneManager } from './sceneManager.js';
import { AssetLoader } from './assetLoader.js';
import { NetworkManager } from './networkManager.js';
import { GameManager } from './gameManager.js';
import { PlayerController } from './playerController.js';
import { UIManager } from './uiManager.js';

class Game {
    constructor() {
        this.sceneManager = new SceneManager();
        this.assetLoader = new AssetLoader();
        this.uiManager = new UIManager();
        this.gameManager = new GameManager(this.sceneManager.getScene(), this.uiManager);
        this.gameManager.setCamera(this.sceneManager.getCamera());
        this.networkManager = new NetworkManager();

        this.init();
        window.game = this;
    }

    async init() {
        await this.assetLoader.loadAll();
        this.gameManager.setAssets(this.assetLoader.getAssets());

        this.uiManager.showStartScreen((playerName) => {
            this.networkManager.setCallbacks(
                (state) => this.gameManager.initializeSelf(state),
                (players) => this.gameManager.initializeOtherPlayers(players),
                (player) => this.gameManager.addPlayer(player),
                (id) => this.gameManager.removePlayer(id),
                (playerData) => this.gameManager.updatePlayerState(playerData),
                (hitData) => this.gameManager.handlePlayerHit(hitData),
                (shotData) => this.gameManager.handleShotFired(shotData),
                (items) => this.gameManager.setupWorldItems(items),
                (itemId) => this.gameManager.removeItemFromWorld(itemId), // Diese Zeilen müssen noch implementiert werden
                (newState) => this.gameManager.updatePlayerStateFromServer(newState) // Diese auch
            );
            this.networkManager.connect('ws://127.0.0.1:8080', playerName);

            this.playerController = new PlayerController(this.sceneManager.getCamera(), this.networkManager);
            this.playerController.enableControls();
            
            this.uiManager.showHUD();
            
            this.animate();
        });
    }

    requestItemPickup() {
        const itemId = this.gameManager.currentlyLookingAt;
        if (itemId) {
            this.networkManager.sendPickupRequest(itemId);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.sceneManager.getClock().getDelta();
        if (this.playerController && this.playerController.controls.isLocked) {
             this.playerController.update(delta);
        }
        this.gameManager.update(delta);
        this.sceneManager.getRenderer().render(this.sceneManager.getScene(), this.sceneManager.getCamera());
    }
}

window.onload = () => new Game();