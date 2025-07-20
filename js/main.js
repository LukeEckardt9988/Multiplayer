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

        // Startbildschirm anzeigen
        this.uiManager.showStartScreen((playerName) => {
            this.networkManager.setCallbacks(
                (state) => this.gameManager.initializeSelf(state),
                (players) => this.gameManager.initializeOtherPlayers(players),
                (player) => this.gameManager.addPlayer(player),
                (id) => this.gameManager.removePlayer(id),
                (playerData) => this.gameManager.updatePlayerState(playerData),
                (hitData) => this.gameManager.handlePlayerHit(hitData),
                (shotData) => this.gameManager.handleShotFired(shotData),
                (items) => this.gameManager.setupWorldItems(items)
            );
            this.networkManager.connect('ws://127.0.0.1:8080', playerName);

            this.playerController = new PlayerController(this.sceneManager.getCamera(), this.networkManager);
            this.playerController.enableControls();

            this.uiManager.showHUD();

            // ==========================================
            //  NEU: Starte die Debug-Ausgabe jede Sekunde
            // ==========================================
            setInterval(() => this.debugLogPositions(), 1000);

            this.animate();
        });
    }

    /**
     * NEU: Diese Funktion gibt die Positionen in der Konsole aus.
     */
    debugLogPositions() {
        // Funktioniert nur, wenn das Spiel läuft
        if (!this.playerController || !this.playerController.controls.isLocked) return;

        console.clear(); // Löscht die alte Ausgabe für eine saubere Ansicht

        const playerPosition = this.sceneManager.getCamera().position;
        console.log(`%c--- DEBUG-INFO (aktualisiert jede Sekunde) ---`, 'color: yellow; font-weight: bold;');
        console.log(`Meine Position: X=${playerPosition.x.toFixed(1)}, Y=${playerPosition.y.toFixed(1)}, Z=${playerPosition.z.toFixed(1)}`);

        console.log("--- Items in der Welt ---");
        if (this.gameManager.worldItems.size === 0) {
            console.log("Keine Items vom Server empfangen oder platziert.");
            return;
        }

        // Gehe durch alle platzierten Items und berechne die Distanz
        this.gameManager.worldItems.forEach((itemObject, itemId) => {
            const itemPosition = itemObject.position;
            const distance = playerPosition.distanceTo(itemPosition);

            console.log(
                `Item [${itemObject.userData.itemId.substring(0, 10)}] ` +
                `an Position: { X: ${itemPosition.x}, Y: ${itemPosition.y}, Z: ${itemPosition.z} } | ` +
                `Entfernung zu mir: ${distance.toFixed(1)} Meter`
            );
        });
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
    /**
    * NEU: Wird vom PlayerController aufgerufen, wenn 'E' gedrückt wird.
    */
    requestItemPickup() {
        // Prüfe, ob wir gerade ein Item ansehen
        const itemId = this.gameManager.currentlyLookingAt;
        if (itemId) {
            console.log(`Fordere an, Item ${itemId} aufzuheben...`);
            this.networkManager.sendPickupRequest(itemId);
        }
    }
}

window.onload = () => new Game();