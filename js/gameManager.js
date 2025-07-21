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
        this.currentlyLookingAt = null;

        // NEU: Logik zur Waffenhaltung
        this.weaponHolder = new THREE.Group(); // Eine Gruppe, die an der Kamera hängt
        this.currentWeaponObject = null;       // Das aktuell sichtbare Waffen-3D-Modell
        this.currentWeaponName = '';           // Der Name der aktuell ausgerüsteten Waffe
    }

    setCamera(camera) {
        this.camera = camera;
        // Die Waffenhalterung wird direkt an die Kamera gehängt
        this.camera.add(this.weaponHolder);
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

    // NEU: Kernfunktion zum Ausrüsten einer Waffe
    equipWeapon(weaponName) {
        if (this.currentWeaponName === weaponName || !weaponName) {
            return;
        }

        if (this.currentWeaponObject) {
            this.weaponHolder.remove(this.currentWeaponObject);
        }

        const weaponAsset = this.assets.get(weaponName);
        if (weaponAsset) {
            this.currentWeaponObject = weaponAsset.scene.clone();

            // NEU: Der eigentliche Trick
            this.currentWeaponObject.traverse(child => {
                if (child.isMesh) {
                    // Sag dem Material, es soll den Tiefentest ignorieren.
                    // Das bedeutet, es wird immer im Vordergrund gezeichnet.
                    child.material.depthTest = false;
                }
            });

            this.currentWeaponObject.position.set(0.15, -0.15, -0.3);
            this.currentWeaponObject.rotation.y = Math.PI;

            this.weaponHolder.add(this.currentWeaponObject);
            this.currentWeaponName = weaponName;
            console.log(`Waffe ausgerüstet: ${weaponName}`);
        } else {
            console.error(`Waffen-Asset '${weaponName}' nicht gefunden!`);
        }
    }


    initializeSelf(data) {
        this.selfId = data.state.id;
        this.uiManager.updateHealth(data.state.health);

        // Die Startwaffe direkt beim Betreten des Spiels ausrüsten
        const initialWeapon = data.state.equipped_weapon;
        this.equipWeapon(initialWeapon);

        // HUD aktualisieren
        const weaponName = initialWeapon.charAt(0).toUpperCase() + initialWeapon.slice(1);
        this.uiManager.updateWeaponInfo(weaponName, data.state.ammo);
    }

    updatePlayerStateFromServer(newState) {
        if (newState.id === this.selfId) {
            this.uiManager.updateHealth(newState.health);

            // Prüfen, ob sich die Waffe geändert hat und ggf. das Modell austauschen
            if (this.currentWeaponName !== newState.equipped_weapon) {
                this.equipWeapon(newState.equipped_weapon);
            }

            const weaponName = newState.equipped_weapon.charAt(0).toUpperCase() + newState.equipped_weapon.slice(1);
            this.uiManager.updateWeaponInfo(weaponName, newState.ammo);
        }
    }

    // Ersetze deine bisherige setupWorldItems-Funktion mit dieser.
    setupWorldItems(itemsData) {
        // Alte Items und Marker entfernen
        this.worldItems.forEach(item => {
            if (item.marker) { // Prüft, ob ein Marker existiert
                this.scene.remove(item.marker);
            }
            this.scene.remove(item);
        });
        this.worldItems.clear();

        itemsData.forEach(item => {
            let modelShortName = item.type === 'weapon' ? item.name : 'munition';
            const asset = this.assets.get(modelShortName);

            if (asset) {
                const itemObject = asset.scene.clone();
                itemObject.position.set(item.position.x, item.position.y, item.position.z);

                // Wir machen die aufhebbaren Modelle deutlich größer
                itemObject.scale.set(3, 3, 3);

                itemObject.userData = {
                    itemId: item.id,
                    itemName: item.name,
                    itemType: item.type
                };

                // NEU: Ein sichtbarer Marker, der über dem Item schwebt
                const markerGeometry = new THREE.SphereGeometry(0.2, 16, 8);
                // Leuchtendes Material, das nicht von Licht beeinflusst wird
                const markerMaterial = new THREE.MeshBasicMaterial({
                    color: item.type === 'weapon' ? 0xffd700 : 0x00c8ff, // Gold für Waffen, Blau für Munition
                    transparent: true,
                    opacity: 0.7
                });
                const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
                markerMesh.position.copy(itemObject.position);
                markerMesh.position.y += 0.7; // Lässt den Marker leicht schweben

                // Wir verknüpfen den Marker mit dem Item, um ihn später entfernen zu können
                itemObject.marker = markerMesh;

                this.worldItems.set(item.id, itemObject);
                this.scene.add(itemObject); // Füge das 3D-Modell hinzu
                this.scene.add(markerMesh); // Füge den sichtbaren Marker hinzu
            } else {
                console.error(`Asset für "${modelShortName}" nicht gefunden!`);
            }
        });
    }

    update(delta) {
        if (!this.camera) return;
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(Array.from(this.worldItems.values()), true);
        if (intersects.length > 0 && intersects[0].distance < 3) {
            let hitObject = intersects[0].object;
            while (hitObject.parent && !hitObject.userData.itemId) {
                hitObject = hitObject.parent;
            }
            if (hitObject.userData.itemId) {
                const { itemId, itemName, itemType } = hitObject.userData;
                if (this.currentlyLookingAt !== itemId) {
                    this.currentlyLookingAt = itemId;
                    const nameToShow = (itemName || itemType).charAt(0).toUpperCase() + (itemName || itemType).slice(1);
                    this.uiManager.showInteractionPrompt(`[E] ${nameToShow} aufheben`);
                }
            }
        } else {
            if (this.currentlyLookingAt !== null) {
                this.currentlyLookingAt = null;
                this.uiManager.hideInteractionPrompt();
            }
        }
    }

    removeItemFromWorld(itemId) {
        if (this.worldItems.has(itemId)) {
            const itemObject = this.worldItems.get(itemId);

            // NEU: Entferne auch den zugehörigen Marker
            if (itemObject.marker) {
                this.scene.remove(itemObject.marker);
            }

            this.scene.remove(itemObject);
            this.worldItems.delete(itemId);

            // Verstecke die Interaktions-Nachricht
            this.uiManager.hideInteractionPrompt();
            this.currentlyLookingAt = null;
        }
    }

    // --- Die anderen Funktionen bleiben unverändert ---
    initializeOtherPlayers(playersData) { for (const id in playersData) { if (playersData.hasOwnProperty(id) && id != this.selfId) { this.addPlayer(playersData[id]); } } }
    addPlayer(playerData) { if (this.players.has(playerData.id) || playerData.id == this.selfId) return; const modelName = playerData.model.replace('.glb', ''); const playerAsset = this.assets.get(modelName); if (playerAsset) { const playerObject = playerAsset.scene.clone(); playerObject.position.set(playerData.position.x, playerData.position.y, playerData.position.z); const euler = new THREE.Euler(0, playerData.rotation.y, 0, 'YXZ'); playerObject.quaternion.setFromEuler(euler); this.players.set(playerData.id, playerObject); this.scene.add(playerObject); } }
    removePlayer(playerId) { if (this.players.has(playerId)) { const playerObject = this.players.get(playerId); this.scene.remove(playerObject); this.players.delete(playerId); } }
    updatePlayerState(playerData) { const playerObject = this.players.get(playerData.id); if (playerObject) { playerObject.position.lerp(new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z), 0.2); const euler = new THREE.Euler(0, playerData.rotation.y, 0, 'YXZ'); const targetQuaternion = new THREE.Quaternion().setFromEuler(euler); playerObject.quaternion.slerp(targetQuaternion, 0.2); } }
    handlePlayerHit(hitData) { if (hitData.victim_id === this.selfId) { this.uiManager.updateHealth(hitData.victim_health); document.body.style.boxShadow = "inset 0 0 40px #ff0000"; setTimeout(() => { document.body.style.boxShadow = "none"; }, 250); } }
    handleShotFired(shotData) { const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 }); let startPoint, direction; const shotLength = 100; if (shotData.shooter_id === this.selfId) { startPoint = this.camera.position.clone(); direction = new THREE.Vector3(); this.camera.getWorldDirection(direction); } else { const shooterObject = this.players.get(shotData.shooter_id); if (!shooterObject) return; startPoint = shooterObject.position.clone().add(new THREE.Vector3(0, 1.5, 0)); direction = new THREE.Vector3(0, 0, -1); direction.applyQuaternion(shooterObject.quaternion); } const endPoint = startPoint.clone().add(direction.multiplyScalar(shotLength)); const points = [startPoint, endPoint]; const tracerGeometry = new THREE.BufferGeometry().setFromPoints(points); const tracerLine = new THREE.Line(tracerGeometry, tracerMaterial); this.scene.add(tracerLine); setTimeout(() => { this.scene.remove(tracerLine); tracerGeometry.dispose(); tracerMaterial.dispose(); }, 100); }
}