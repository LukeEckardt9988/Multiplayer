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

        this.weaponHolder = new THREE.Group();
        this.currentWeaponObject = null;
        this.currentWeaponName = '';
        
        this.animationMixer = null;
        this.weaponActions = {};
        this.currentAction = null;
    }

    setCamera(camera) {
        this.camera = camera;
        this.camera.add(this.weaponHolder);
    }

    setAssets(assets) {
        this.assets = assets;
        const worldAsset = this.assets.get('welt');
        if (worldAsset) {
            this.scene.add(worldAsset.scene);
        }
    }

    equipWeapon(weaponName) {
        if (this.currentWeaponName === weaponName || !weaponName) return;

        if (this.currentWeaponObject) this.weaponHolder.remove(this.currentWeaponObject);
        
        this.animationMixer = null;
        this.weaponActions = {};
        this.currentAction = null;

        const weaponAsset = this.assets.get(weaponName);
        if (weaponAsset) {
            this.currentWeaponObject = weaponAsset.scene.clone();
            this.currentWeaponObject.traverse(child => {
                if (child.isMesh) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => { if (material) material.depthTest = false; });
                    } else if (child.material) {
                        child.material.depthTest = false;
                    }
                }
            });

            this.currentWeaponObject.position.set(0.15, -0.15, -0.3);
            this.currentWeaponObject.rotation.y = Math.PI;
            this.currentWeaponObject.scale.set(0.4, 0.4, 0.4);
            this.weaponHolder.add(this.currentWeaponObject);
            this.currentWeaponName = weaponName;

            this.animationMixer = new THREE.AnimationMixer(this.currentWeaponObject);
            const clips = weaponAsset.animations;
            ['Stay', 'Shot', 'Run', 'Load'].forEach(name => {
                const clip = THREE.AnimationClip.findByName(clips, name);
                if (clip) {
                    const action = this.animationMixer.clipAction(clip);
                    this.weaponActions[name] = action;
                    if (name === 'Shot' || name === 'Load') {
                        action.setLoop(THREE.LoopOnce);
                        action.clampWhenFinished = true;
                    }
                }
            });
            this.playAnimation('Stay');
        }
    }

    playAnimation(name) {
        if (this.currentAction?.name === name || !this.weaponActions[name]) return;
        const previousAction = this.currentAction;
        this.currentAction = this.weaponActions[name];
        this.currentAction.name = name;
        if (previousAction) {
            this.currentAction.reset().crossFadeFrom(previousAction, 0.2, true).play();
        } else {
            this.currentAction.reset().play();
        }
    }

    handleShoot() {
        if (this.weaponActions.Shot) {
            this.playAnimation('Shot');
            const onAnimationFinish = () => {
                this.playAnimation('Stay');
                this.animationMixer.removeEventListener('finished', onAnimationFinish);
            };
            this.animationMixer.addEventListener('finished', onAnimationFinish);
        }
    }
    
    setupWorldItems(itemsData) {
        this.worldItems.forEach(item => { if (item.marker) this.scene.remove(item.marker); this.scene.remove(item); });
        this.worldItems.clear();
        itemsData.forEach(item => {
            let modelShortName = item.type === 'weapon' ? item.name : 'munition';
            const asset = this.assets.get(modelShortName);
            if (asset) {
                const itemObject = asset.scene.clone();
                itemObject.position.set(item.position.x, item.position.y, item.position.z);
                itemObject.scale.set(3, 3, 3);
                itemObject.userData = { itemId: item.id, itemName: item.name, itemType: item.type };
                const markerGeo = new THREE.SphereGeometry(0.2, 16, 8);
                const markerMat = new THREE.MeshBasicMaterial({ color: item.type === 'weapon' ? 0xffd700 : 0x00c8ff, transparent: true, opacity: 0.7 });
                const markerMesh = new THREE.Mesh(markerGeo, markerMat);
                markerMesh.position.copy(itemObject.position);
                markerMesh.position.y += 0.7;
                itemObject.marker = markerMesh;
                this.worldItems.set(item.id, itemObject);
                this.scene.add(itemObject);
                this.scene.add(markerMesh);
            }
        });
    }

    spawnNewItem(itemData) {
        let modelShortName = itemData.type === 'weapon' ? itemData.name : 'munition';
        const asset = this.assets.get(modelShortName);
        if (asset) {
            const itemObject = asset.scene.clone();
            itemObject.position.set(itemData.position.x, itemData.position.y, itemData.position.z);
            itemObject.scale.set(3, 3, 3);
            itemObject.userData = { itemId: itemData.id, itemName: itemData.name, itemType: itemData.type };
            const markerGeo = new THREE.SphereGeometry(0.2, 16, 8);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.7 });
            const markerMesh = new THREE.Mesh(markerGeo, markerMat);
            markerMesh.position.copy(itemObject.position);
            markerMesh.position.y += 0.7;
            itemObject.marker = markerMesh;
            this.worldItems.set(itemData.id, itemObject);
            this.scene.add(itemObject);
            this.scene.add(markerMesh);
        }
    }

    update(delta) {
        if (this.animationMixer) this.animationMixer.update(delta);
        if (!this.camera) return;
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const intersects = this.raycaster.intersectObjects(Array.from(this.worldItems.values()), true);
        let hitFound = false;
        if (intersects.length > 0 && intersects[0].distance < 3) {
            let hitObject = intersects[0].object;
            while (hitObject.parent && !hitObject.userData.itemId) hitObject = hitObject.parent;
            if (hitObject.userData.itemId) {
                hitFound = true;
                const { itemId, itemName, itemType } = hitObject.userData;
                if (this.currentlyLookingAt !== itemId) {
                    this.currentlyLookingAt = itemId;
                    const nameToShow = (itemName || itemType).charAt(0).toUpperCase() + (itemName || itemType).slice(1);
                    this.uiManager.showInteractionPrompt(`[E] ${nameToShow} aufheben`);
                }
            }
        }
        if (!hitFound && this.currentlyLookingAt !== null) {
            this.currentlyLookingAt = null;
            this.uiManager.hideInteractionPrompt();
        }
    }
    
    // ----- Unveränderte Hilfsfunktionen -----
    initializeSelf(data){this.selfId=data.state.id;this.uiManager.updateHealth(data.state.health);const i=data.state.equipped_weapon;this.equipWeapon(i);const n=i.charAt(0).toUpperCase()+i.slice(1);this.uiManager.updateWeaponInfo(n,data.state.ammo)}
    updatePlayerStateFromServer(newState){if(newState.id===this.selfId){this.uiManager.updateHealth(newState.health);if(this.currentWeaponName!==newState.equipped_weapon){this.equipWeapon(newState.equipped_weapon)}const n=newState.equipped_weapon.charAt(0).toUpperCase()+newState.equipped_weapon.slice(1);this.uiManager.updateWeaponInfo(n,newState.ammo)}}
    removeItemFromWorld(itemId){if(this.worldItems.has(itemId)){const i=this.worldItems.get(itemId);if(i.marker){this.scene.remove(i.marker)}this.scene.remove(i);this.worldItems.delete(itemId);this.uiManager.hideInteractionPrompt();this.currentlyLookingAt=null}}
    initializeOtherPlayers(playersData){for(const id in playersData){if(playersData.hasOwnProperty(id)&&id!=this.selfId){this.addPlayer(playersData[id])}}}
    addPlayer(playerData){if(this.players.has(playerData.id)||playerData.id==this.selfId)return;const n=playerData.model.replace('.glb','');const a=this.assets.get(n);if(a){const p=a.scene.clone();p.position.set(playerData.position.x,playerData.position.y,playerData.position.z);const e=new THREE.Euler(0,playerData.rotation.y,0,'YXZ');p.quaternion.setFromEuler(e);this.players.set(playerData.id,p);this.scene.add(p)}}
    removePlayer(playerId){if(this.players.has(playerId)){const p=this.players.get(playerId);this.scene.remove(p);this.players.delete(playerId)}}
    updatePlayerState(playerData){const p=this.players.get(playerData.id);if(p){p.position.lerp(new THREE.Vector3(playerData.position.x,playerData.position.y,playerData.position.z),0.2);const e=new THREE.Euler(0,playerData.rotation.y,0,'YXZ');const t=new THREE.Quaternion().setFromEuler(e);p.quaternion.slerp(t,0.2)}}
    handlePlayerHit(hitData){if(hitData.victim_id===this.selfId){this.uiManager.updateHealth(hitData.victim_health);document.body.style.boxShadow="inset 0 0 40px #ff0000";setTimeout(()=>{document.body.style.boxShadow="none"},250)}}
    handleShotFired(shotData){const m=new THREE.LineBasicMaterial({color:16776960});let s,d;const l=100;if(shotData.shooter_id===this.selfId){s=this.camera.position.clone();d=new THREE.Vector3;this.camera.getWorldDirection(d)}else{const o=this.players.get(shotData.shooter_id);if(!o)return;s=o.position.clone().add(new THREE.Vector3(0,1.5,0));d=new THREE.Vector3(0,0,-1);d.applyQuaternion(o.quaternion)}const e=s.clone().add(d.multiplyScalar(l));const p=[s,e];const g=new THREE.BufferGeometry().setFromPoints(p);const t=new THREE.Line(g,m);this.scene.add(t);setTimeout(()=>{this.scene.remove(t);g.dispose();m.dispose()},100)}
}