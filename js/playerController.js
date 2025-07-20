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
        this.moveSpeed = 5.0;

        // Physik-Eigenschaften
        this.gravity = -20.0;
        this.jumpHeight = 8.0;
        this.canJump = false;

        this.updateInterval = setInterval(() => this.sendState(), 50);
        this.addEventListeners();
    }

    addEventListeners() {
        document.addEventListener('keydown', (event) => this.onKey(event.key, true));
        document.addEventListener('keyup', (event) => this.onKey(event.key, false));
        document.addEventListener('mousedown', (event) => this.onMouseDown(event));
    }

    onMouseDown(event) {
        if (!this.controls.isLocked || event.button !== 0) return;

        const position = this.camera.position;
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        // KORREKTUR 2: Die Funktion zum Schießen wieder aktiviert
        if (this.networkManager) {
             this.networkManager.sendShootAction(position, direction); 
        }
    }

    onKey(key, isPressed) {
        const lowerKey = key.toLowerCase();
        if (this.keys.hasOwnProperty(lowerKey)) {
            this.keys[lowerKey] = isPressed;
        }

        if (lowerKey === 'e' && isPressed) {
            window.game.requestItemPickup();
        }
    }

    enableControls() {
        this.controls.lock();
    }

    sendState() {
        if (!this.controls.isLocked) return;
        const position = this.camera.position;
        const rotation = this.camera.rotation;
        this.networkManager.sendPlayerState(position, { x: 0, y: rotation.y, z: 0 });
    }

    update(delta) {
        if (!this.controls.isLocked) return;
        
        // Schwerkraft
        this.velocity.y += this.gravity * delta;

        // Horizontale Bewegung
        this.direction.z = Number(this.keys.w) - Number(this.keys.s);
        this.direction.x = Number(this.keys.d) - Number(this.keys.a);
        this.direction.normalize();

        // KORREKTUR 1: Minuszeichen entfernt für korrekte W/S-Steuerung
        if (this.keys.w || this.keys.s) {
            this.velocity.z = this.direction.z * this.moveSpeed;
        } else {
            this.velocity.z = 0;
        }
        
        if (this.keys.a || this.keys.d) {
            this.velocity.x = this.direction.x * this.moveSpeed;
        } else {
            this.velocity.x = 0;
        }

        this.controls.moveRight(this.velocity.x * delta);
        this.controls.moveForward(this.velocity.z * delta);
        
        // Springen & Boden-Kollision
        if (this.keys[' '] && this.canJump) {
            this.velocity.y = this.jumpHeight;
            this.canJump = false;
        }

        this.controls.getObject().position.y += this.velocity.y * delta;

        if (this.controls.getObject().position.y < 1.7) {
            this.velocity.y = 0;
            this.controls.getObject().position.y = 1.7;
            this.canJump = true;
        }
    }
}