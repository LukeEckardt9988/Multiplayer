export class NetworkManager {
    constructor() {
        this.socket = null;
        this.onWelcome = null;
        this.onCurrentPlayers = null;
        this.onNewPlayer = null;
        this.onPlayerDisconnected = null;
        this.onPlayerMoved = null;
        this.onPlayerHit = null;
        this.onShotFired = null;
        this.onWorldItems = null;
        // NEU
        this.onItemRemoved = null;
        this.onPlayerStateUpdate = null;
    }

    setCallbacks(onWelcome, onCurrentPlayers, onNewPlayer, onPlayerDisconnected, onPlayerMoved, onPlayerHit, onShotFired, onWorldItems, onItemRemoved, onPlayerStateUpdate) {
        this.onWelcome = onWelcome;
        this.onCurrentPlayers = onCurrentPlayers;
        this.onNewPlayer = onNewPlayer;
        this.onPlayerDisconnected = onPlayerDisconnected;
        this.onPlayerMoved = onPlayerMoved;
        this.onPlayerHit = onPlayerHit;
        this.onShotFired = onShotFired;
        this.onWorldItems = onWorldItems;
        // NEU
        this.onItemRemoved = onItemRemoved;
        this.onPlayerStateUpdate = onPlayerStateUpdate;
    }

    connect(url, playerName) {
        this.socket = new WebSocket(`${url}?name=${encodeURIComponent(playerName)}`);

        this.socket.onopen = () => console.log("WebSocket-Verbindung hergestellt.");
        this.socket.onclose = () => console.log("WebSocket-Verbindung getrennt.");
        this.socket.onerror = (error) => console.error("WebSocket-Fehler:", error);

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'welcome': this.onWelcome(data); break;
                case 'current_players': this.onCurrentPlayers(data.players); break;
                case 'new_player': this.onNewPlayer(data.player); break;
                case 'player_disconnected': this.onPlayerDisconnected(data.id); break;
                case 'player_moved': this.onPlayerMoved(data.player); break;
                case 'player_hit': this.onPlayerHit(data); break;
                case 'shot_fired': this.onShotFired(data); break;
                case 'world_items': this.onWorldItems(data.items); break;
                // NEUE NACHRICHTEN VOM SERVER
                case 'item_removed': this.onItemRemoved(data.id); break;
                case 'player_state_update': this.onPlayerStateUpdate(data.state); break;
            }
        };
    }

    sendPlayerState(position, rotation) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'update_state', position, rotation }));
        }
    }

    // FEHLENDE FUNKTION HINZUGEFÜGT
    sendShootAction(position, direction) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'shoot', position, direction }));
        }
    }

    sendPickupRequest(itemId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'pickup_item', id: itemId }));
        }
    }
}