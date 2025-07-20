export class NetworkManager {
    constructor() {
        this.socket = null;
        this.onWelcome = null;
        this.onCurrentPlayers = null;
        this.onNewPlayer = null;
        this.onPlayerDisconnected = null;
        this.onPlayerMoved = null;
        this.onWorldItems = null;

    }

    setCallbacks(onWelcome, onCurrentPlayers, onNewPlayer, onPlayerDisconnected, onPlayerMoved, onPlayerHit, onShotFired, onWorldItems) {
        this.onWelcome = onWelcome;
        this.onCurrentPlayers = onCurrentPlayers;
        this.onNewPlayer = onNewPlayer;
        this.onPlayerDisconnected = onPlayerDisconnected;
        this.onPlayerMoved = onPlayerMoved;
        this.onWorldItems = onWorldItems;
    }

    connect(url, playerName) {
        // Wir hängen den Namen als Parameter an die URL an
        this.socket = new WebSocket(`${url}?name=${encodeURIComponent(playerName)}`);

        this.socket.onopen = () => {
            console.log("WebSocket-Verbindung hergestellt.");
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'welcome':
                    this.onWelcome(data);
                    break;
                case 'current_players':
                    this.onCurrentPlayers(data.players);
                    break;
                case 'new_player':
                    this.onNewPlayer(data.player);
                    break;
                case 'player_disconnected':
                    this.onPlayerDisconnected(data.id);
                    break;
                case 'player_moved':
                    this.onPlayerMoved(data.player);
                    break;
                case 'shot_fired':
                    this.onShotFired(data);
                    break;
                case 'world_items':
                    this.onWorldItems(data.items);
                    break;
            }
        };

        this.socket.onclose = () => {
            console.log("WebSocket-Verbindung getrennt.");
        };

        this.socket.onerror = (error) => {
            console.error("WebSocket-Fehler:", error);
        };
    }

    sendPlayerState(position, rotation) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'update_state',
                position: { x: position.x, y: position.y, z: position.z },
                rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
            };
            this.socket.send(JSON.stringify(message));
        }
    }
    /**
    * NEU: Sendet eine Anfrage zum Aufheben eines Items an den Server.
    */
    sendPickupRequest(itemId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'pickup_item',
                id: itemId
            };
            this.socket.send(JSON.stringify(message));
        }
    }
}