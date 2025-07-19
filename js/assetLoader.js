import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';

export class AssetLoader {
    constructor() {
        this.loader = new GLTFLoader();
        this.assets = new Map();
        // Hier listen wir alle Modelle auf, die wir brauchen
        this.modelsToLoad = [
            { name: 'welt', url: 'models/welt.glb' },
            //{ name: 'person0', url: 'models/person.glb' }, // Wir nennen sie person0, person1 etc.
            { name: 'person1', url: 'models/person1.glb' },
            //{ name: 'person2', url: 'models/person2.glb' },
           // { name: 'person3', url: 'models/person3.glb' },
            { name: 'pistole', url: 'models/pistole.glb' },
           // { name: 'munition', url: 'models/monition.glb' }, // Korrektur von "monition" zu "munition"
        ];
    }

    // Lädt ein einzelnes Modell und gibt ein Promise zurück
    loadModel(modelInfo) {
        return new Promise((resolve, reject) => {
            this.loader.load(modelInfo.url, (gltf) => {
                this.assets.set(modelInfo.name, gltf);
                resolve(gltf);
            }, undefined, reject);
        });
    }

    // Lädt alle Modelle in der Liste
    async loadAll() {
        console.log("Lade alle 3D-Modelle...");
        const promises = this.modelsToLoad.map(model => this.loadModel(model));
        await Promise.all(promises);
        console.log("Alle Modelle erfolgreich geladen.");
    }

    // Gibt die geladenen Assets zurück
    getAssets() {
        return this.assets;
    }

    // Gibt ein einzelnes Asset zurück
    get(assetName) {
        return this.assets.get(assetName);
    }
}