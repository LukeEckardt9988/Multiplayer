import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

export class GameManager {
    constructor(scene, uiManager) {
        this.scene = scene;
        this.uiManager = uiManager;
        this.assets = null;
        this.players = new Map();
        this.worldItems = new Map();
        this.selfId = null;
        this.camera = null;
        this.raycaster = new THREE.Raycaster();
        this.currentlyLookingAt = null; // Speichert die ID des Items, das wir ansehen
    }

    setCamera(camera) {
        this.camera = camera;
    }

    setAssets(assets) {
        this.assets = assets;
        const worldAsset = this.assets.get('welt');
        if (worldAsset) {
            this.scene.add(worldAsset.scene);
        } else {
            console.error("Welt-Modell ('welt.glb') konnte nicht gefunden werden.");
        }
    }

    /**
     * Erstellt die 3D-Objekte für alle Items in der Welt.
     */
    setupWorldItems(itemsData) {
        // Zuerst alte Items entfernen, falls die Welt neu geladen wird
        this.worldItems.forEach(item => this.scene.remove(item));
        this.worldItems.clear();

        itemsData.forEach(item => {
            let modelShortName;
            if (item.type === 'weapon') {
                modelShortName = item.name; // z.B. 'gewehr'
            } else if (item.type === 'ammo') {
                modelShortName = 'munition';
            }

            const asset = this.assets.get(modelShortName);
            if (asset) {
                const itemObject = asset.scene.clone();
                itemObject.position.set(item.position.x, item.position.y, item.position.z);

                // --- KORREKTUR: Skalierung anpassen, falls die Modelle zu klein sind ---
                itemObject.scale.set(1.5, 1.5, 1.5); // Passe diese Werte bei Bedarf an

                // Speichere alle wichtigen Infos direkt im 3D-Objekt
                itemObject.userData = {
                    itemId: item.id,
                    itemName: item.name, // 'gewehr', 'pistole', etc.
                    itemType: item.type  // 'weapon' oder 'ammo'
                };

                this.worldItems.set(item.id, itemObject);
                this.scene.add(itemObject);
            } else {
                console.error(`Asset mit Kurznamen "${modelShortName}" nicht im AssetLoader gefunden!`);
            }
        });
    }

    /**
     * Prüft, ob der Spieler ein Item ansieht und aktualisiert die UI.
     */
    update(delta) {
        if (!this.camera) return;

        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(Array.from(this.worldItems.values()), true);

        if (intersects.length > 0 && intersects[0].distance < 3) {
            // Finde das korrekte Parent-Objekt, das unsere userData enthält
            let hitObject = intersects[0].object;
            while (hitObject.parent && !hitObject.userData.itemId) {
                hitObject = hitObject.parent;
            }

            const { itemId, itemName, itemType } = hitObject.userData;

            if (this.currentlyLookingAt !== itemId) {
                this.currentlyLookingAt = itemId;
                const nameToShow = (itemName || itemType).charAt(0).toUpperCase() + (itemName || itemType).slice(1);
                this.uiManager.showInteractionPrompt(`[E] ${nameToShow} aufheben`);
            }
        } else {
            if (this.currentlyLookingAt !== null) {
                this.currentlyLookingAt = null;
                this.uiManager.hideInteractionPrompt();
            }
        }
    }

    // Die restlichen Funktionen (initializeSelf, addPlayer, etc.) bleiben unverändert
    initializeSelf(data) {
        this.selfId = data.state.id;
        console.log(`Willkommen! Deine ID ist ${this.selfId}`);
        this.uiManager.updateHealth(data.state.health);
        const weaponName = data.state.equipped_weapon.charAt(0).toUpperCase() + data.state.equipped_weapon.slice(1);
        this.uiManager.updateWeaponInfo(weaponName, data.state.ammo);
    }
    initializeOtherPlayers(playersData) { for (const id in playersData) { if (playersData.hasOwnProperty(id) && id != this.selfId) { this.addPlayer(playersData[id]); } } }
    addPlayer(playerData) { if (this.players.has(playerData.id) || playerData.id == this.selfId) return; const modelName = playerData.model.replace('.glb', ''); const playerAsset = this.assets.get(modelName); if (playerAsset) { const playerObject = playerAsset.scene.clone(); playerObject.position.set(playerData.position.x, playerData.position.y, playerData.position.z); const euler = new THREE.Euler(0, playerData.rotation.y, 0, 'YXZ'); playerObject.quaternion.setFromEuler(euler); this.players.set(playerData.id, playerObject); this.scene.add(playerObject); } }
    removePlayer(playerId) { if (this.players.has(playerId)) { const playerObject = this.players.get(playerId); this.scene.remove(playerObject); this.players.delete(playerId); } }
    updatePlayerState(playerData) { const playerObject = this.players.get(playerData.id); if (playerObject) { playerObject.position.lerp(new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z), 0.2); const euler = new THREE.Euler(0, playerData.rotation.y, 0, 'YXZ'); const targetQuaternion = new THREE.Quaternion().setFromEuler(euler); playerObject.quaternion.slerp(targetQuaternion, 0.2); } }
    handlePlayerHit(hitData) { if (hitData.victim_id === this.selfId) { this.uiManager.updateHealth(hitData.victim_health); document.body.style.boxShadow = "inset 0 0 40px #ff0000"; setTimeout(() => { document.body.style.boxShadow = "none"; }, 250); } }
    handleShotFired(shotData) { const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 }); let startPoint, direction; const shotLength = 100; if (shotData.shooter_id === this.selfId) { startPoint = this.camera.position.clone(); direction = new THREE.Vector3(); this.camera.getWorldDirection(direction); } else { const shooterObject = this.players.get(shotData.shooter_id); if (!shooterObject) return; startPoint = shooterObject.position.clone().add(new THREE.Vector3(0, 1.5, 0)); direction = new THREE.Vector3(0, 0, -1); direction.applyQuaternion(shooterObject.quaternion); } const endPoint = startPoint.clone().add(direction.multiplyScalar(shotLength)); const points = [startPoint, endPoint]; const tracerGeometry = new THREE.BufferGeometry().setFromPoints(points); const tracerLine = new THREE.Line(tracerGeometry, tracerMaterial); this.scene.add(tracerLine); setTimeout(() => { this.scene.remove(tracerLine); tracerGeometry.dispose(); tracerMaterial.dispose(); }, 100); }
}