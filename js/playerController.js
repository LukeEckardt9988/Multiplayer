import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/PointerLockControls.js';

export class PlayerController {
    constructor(camera, networkManager) {
        this.camera = camera;
        this.networkManager = networkManager;
        this.controls = new PointerLockControls(this.camera, document.body);

        this.keys = {
            'w': false, 'a': false, 's': false, 'd': false, ' ': false
        };
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 5.0; // Bewegungstempo

        // Sendet Updates alle 50ms (20 Mal pro Sekunde)
        this.updateInterval = setInterval(() => this.sendState(), 50);

        this.addEventListeners();
    }

    addEventListeners() {
        document.addEventListener('keydown', (event) => this.onKey(event.key, true));
        document.addEventListener('keyup', (event) => this.onKey(event.key, false));
    }

    onKey(key, isPressed) {
        const lowerKey = key.toLowerCase();
        if (this.keys.hasOwnProperty(lowerKey)) {
            this.keys[lowerKey] = isPressed;
        }
    }

    enableControls() {
        this.controls.lock();
    }

    // Sendet den aktuellen Zustand an den Server
    sendState() {
        if (!this.controls.isLocked) return;

        // Wir senden die Kameraposition und -rotation
        const position = this.camera.position;
        const rotation = this.camera.rotation; // Einfache Y-Rotation reicht oft
        this.networkManager.sendPlayerState(position, {x: 0, y: rotation.y, z: 0});
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        this.direction.z = Number(this.keys.w) - Number(this.keys.s);
        this.direction.x = Number(this.keys.d) - Number(this.keys.a);
        this.direction.normalize(); // Stellt sicher, dass diagonale Bewegung nicht schneller ist

        // Bewegung relativ zur Blickrichtung
        if (this.keys.w || this.keys.s) {
            this.velocity.z = this.direction.z * this.moveSpeed * delta;
            this.controls.moveForward(this.velocity.z);
        }
        if (this.keys.a || this.keys.d) {
            this.velocity.x = this.direction.x * this.moveSpeed * delta;
            this.controls.moveRight(this.velocity.x);
        }
    }
}