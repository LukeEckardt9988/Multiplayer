export class UIManager {
    constructor() {
        this.blocker = document.getElementById('blocker');
        this.instructions = document.getElementById('instructions');
        this.playButton = document.getElementById('playButton');
        this.playerNameInput = document.getElementById('playerName');
        this.hud = document.getElementById('hud');
        this.healthBar = document.getElementById('health-bar');
        this.equippedWeaponEl = document.getElementById('equipped-weapon');
        this.ammoCountEl = document.getElementById('ammo-count');
        this.interactionPromptEl = document.getElementById('interaction-prompt');
    }

    showStartScreen(onStart) {
        this.blocker.style.display = 'block';

        const startHandler = () => {
            const playerName = this.playerNameInput.value.trim();
            if (playerName === "") {
                alert("Bitte gib einen Namen ein!");
                return;
            }

            this.blocker.style.display = 'none';
            // Wir übergeben den Namen an die onStart Funktion
            onStart(playerName);
            this.playButton.removeEventListener('click', startHandler);
        };

        this.playButton.addEventListener('click', startHandler, false);
    }

    showHUD() {
        if (this.hud) {
            this.hud.style.display = 'block';
        }
    }

    updateHealth(currentHealth, maxHealth = 100) {
        if (this.healthBar) {
            const healthPercentage = (currentHealth / maxHealth) * 100;
            this.healthBar.style.width = `${healthPercentage}%`;
        }
    }
    updateWeaponInfo(weaponName, ammo) {
        if (this.equippedWeaponEl) this.equippedWeaponEl.innerText = weaponName;
        if (this.ammoCountEl) this.ammoCountEl.innerText = ammo;
    }

    /**
     * Zeigt eine Interaktions-Nachricht an (z.B. "Waffe aufheben").
     * @param {string} text - Der anzuzeigende Text.
     */
    showInteractionPrompt(text) {
        if (this.interactionPromptEl) {
            this.interactionPromptEl.innerText = text;
            this.interactionPromptEl.style.display = 'block';
        }
    }

    /**
     * Versteckt die Interaktions-Nachricht.
     */
    hideInteractionPrompt() {
        if (this.interactionPromptEl) {
            this.interactionPromptEl.style.display = 'none';
        }
    }
} 