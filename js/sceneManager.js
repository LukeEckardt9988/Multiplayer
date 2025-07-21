import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

export class SceneManager {
 constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.7, 5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        // =======================================================
        // DIES IST DIE FINALE UND WICHTIGSTE KORREKTUR
        // Diese Einstellung MUSS 'true' sein, damit deine
        // Waffe in der Hand korrekt gezeichnet werden kann.
        // =======================================================
        this.renderer.autoClear = true; 

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.setupLights();
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        this.scene.add(directionalLight);
    }
    
    // Unveränderte Funktionen
    onWindowResize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
    getScene() { return this.scene; }
    getCamera() { return this.camera; }
    getRenderer() { return this.renderer; }
    getClock() { return this.clock; }
}