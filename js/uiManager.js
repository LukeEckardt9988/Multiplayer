export class UIManager {
    constructor() {
        this.blocker = document.getElementById('blocker');
        this.instructions = document.getElementById('instructions');
        this.playButton = document.getElementById('playButton');
        this.playerNameInput = document.getElementById('playerName');
        this.hud = document.getElementById('hud');
        this.healthBar = document.getElementById('health-bar');
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
}