<?php
namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

/**
 * Eine einfache Vektor-Klasse, um 3D-Berechnungen zu erleichtern.
 */
class Vector3 {
    public $x, $y, $z;

    public function __construct($x = 0, $y = 0, $z = 0) {
        $this->x = $x;
        $this->y = $y;
        $this->z = $z;
    }

    /**
     * Berechnet die Distanz zu einem anderen Vektor.
     */
    public function distanceTo(Vector3 $v): float {
        $dx = $this->x - $v->x;
        $dy = $this->y - $v->y;
        $dz = $this->z - $v->z;
        return sqrt($dx * $dx + $dy * $dy + $dz * $dz);
    }
}

/**
 * Der Haupt-Gameserver, der die gesamte Multiplayer-Logik verwaltet.
 */
class GameServer implements MessageComponentInterface {
    protected $clients;
    protected $playerStates;
    protected $worldItems;
    protected $gameConfig;

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->playerStates = [];
        $this->worldItems = [];
        
        // Zentrale Konfiguration für alle Spiel-Elemente
        $this->gameConfig = [
            'weapons' => [
                'pistole' => [
                    'name' => 'Pistole',
                    'model' => 'pistole.glb',
                    'damage' => 10,
                    'fire_rate_ms' => 400 // Schuss alle 400ms
                ],
                'gewehr' => [
                    'name' => 'Gewehr',
                    'model' => 'gewehr.glb',
                    'damage' => 25,
                    'fire_rate_ms' => 800 // Schuss alle 800ms
                ],
                // Hier kannst du deine 3 weiteren Waffen hinzufügen
            ],
            'ammo' => [
                'model' => 'monition.glb',
                'amount' => 15
            ]
        ];

        $this->initializeWorldItems();
        echo "WebSocket Game-Server wurde erfolgreich gestartet.\n";
    }

    /**
     * Füllt die Welt zu Beginn mit Items basierend auf der Konfiguration.
     */
    public function initializeWorldItems() {
        // Lege eine Waffe auf die Karte
        $this->worldItems[] = [
            'id' => 'item_'.uniqid(),
            'type' => 'weapon',
            'name' => 'gewehr',
            'position' => ['x' => 10, 'y' => 1, 'z' => 10]
        ];

        // Lege 5 Munitionspakete auf die Karte
        for ($i = 0; $i < 5; $i++) {
            $this->worldItems[] = [
                'id' => 'item_'.uniqid(),
                'type' => 'ammo',
                'position' => ['x' => rand(-20, 20), 'y' => 1, 'z' => rand(-20, 20)]
            ];
        }
    }

    /**
     * Wird aufgerufen, wenn sich ein neuer Spieler (Client) verbindet.
     */
    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        $sessionId = $conn->resourceId;

        $queryString = $conn->httpRequest->getUri()->getQuery();
        parse_str($queryString, $queryParams);
        $playerName = htmlspecialchars($queryParams['name'] ?? 'Spieler_' . $sessionId);

        // Erstellt den Anfangszustand für den neuen Spieler
        $this->playerStates[$sessionId] = [
            'id' => $sessionId,
            'name' => $playerName,
            'model' => 'person1.glb',
            'health' => 100,
            'position' => ['x' => rand(-5, 5), 'y' => 1, 'z' => rand(-5, 5)],
            'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
            'equipped_weapon' => 'pistole',
            'ammo' => 30,
            'last_shot_timestamp' => 0 // Für Feuerraten-Check
        ];

        echo "Neue Verbindung von '{$playerName}' (ID: {$sessionId})\n";

        // Sende dem neuen Spieler seine eigenen Daten, alle Spieler und alle Welt-Items
        $conn->send(json_encode(['type' => 'welcome', 'state' => $this->playerStates[$sessionId]]));
        $conn->send(json_encode(['type' => 'current_players', 'players' => $this.playerStates]));
        $conn->send(json_encode(['type' => 'world_items', 'items' => $this.worldItems]));
        
        // Informiere alle anderen über den neuen Spieler
        $this->broadcast(json_encode(['type' => 'new_player', 'player' => $this->playerStates[$sessionId]]), $conn);
    }

    /**
     * Wird aufgerufen, wenn eine Nachricht von einem Spieler empfangen wird.
     */
    public function onMessage(ConnectionInterface $from, $msg) {
        $senderId = $from->resourceId;
        if (!isset($this->playerStates[$senderId])) return;

        $data = json_decode($msg, true);
        $type = $data['type'] ?? '';

        switch ($type) {
            case 'update_state':
                $this->playerStates[$senderId]['position'] = $data['position'];
                $this->playerStates[$senderId]['rotation'] = $data['rotation'];
                $this->broadcast(json_encode(['type' => 'player_moved', 'player' => $this->playerStates[$senderId]]), $from);
                break;

            case 'shoot':
                $this->handleShoot($senderId, $data);
                break;
        }
    }

    /**
     * Verarbeitet die Schuss-Logik mit Feuerrate und dynamischem Schaden.
     */
    public function handleShoot($shooterId, $shootData) {
        $player = &$this->playerStates[$shooterId];
        $weaponKey = $player['equipped_weapon'];
        $weaponConfig = $this->gameConfig['weapons'][$weaponKey];

        // 1. Feuerraten-Check (Server-seitig)
        $now = microtime(true) * 1000;
        if ($now - $player['last_shot_timestamp'] < $weaponConfig['fire_rate_ms']) {
            return; // Zu schnell geschossen, der Server ignoriert den Schuss.
        }
        $player['last_shot_timestamp'] = $now;

        $this->broadcast(json_encode(['type' => 'shot_fired', 'shooter_id' => $shooterId]));
        
        $shotOrigin = new Vector3($shootData['position']['x'], $shootData['position']['y'], $shootData['position']['z']);

        // 2. Treffererkennung
        foreach ($this->playerStates as $targetId => &$targetState) {
            if ($shooterId === $targetId) continue;

            $targetPosition = new Vector3($targetState['position']['x'], $targetState['position']['y'], $targetState['position']['z']);
            
            // Sehr einfache Distanz-basierte Treffererkennung
            if ($shotOrigin->distanceTo($targetPosition) < 2.0) {
                
                // 3. Schaden abziehen basierend auf der Waffe
                $targetState['health'] = max(0, $targetState['health'] - $weaponConfig['damage']);
                
                $this->broadcast(json_encode([
                    'type' => 'player_hit',
                    'victim_id' => $targetId,
                    'victim_health' => $targetState['health'],
                    'shooter_id' => $shooterId
                ]));
                
                // 4. Tod und Respawn behandeln
                if ($targetState['health'] <= 0) {
                    // Simpler Respawn für den Moment
                    $targetState['health'] = 100;
                    $targetState['position'] = ['x' => rand(-20, 20), 'y' => 1, 'z' => rand(-20, 20)];
                    $this->broadcast(json_encode(['type' => 'player_respawned', 'player' => $targetState]));
                }
                break; // Ein Schuss trifft nur ein Ziel.
            }
        }
    }

    /**
     * Wird aufgerufen, wenn ein Spieler die Verbindung trennt.
     */
    public function onClose(ConnectionInterface $conn) {
        $sessionId = $conn->resourceId;
        if(isset($this->playerStates[$sessionId])) {
            $playerName = $this->playerStates[$sessionId]['name'];
            unset($this->playerStates[$sessionId]);
        } else {
            $playerName = "Unbekannt";
        }
        $this->clients->detach($conn);
        $this->broadcast(json_encode(['type' => 'player_disconnected', 'id' => $sessionId]));
        echo "Verbindung von '{$playerName}' (ID: {$sessionId}) wurde getrennt.\n";
    }

    /**
     * Wird bei einem Fehler aufgerufen.
     */
    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "Ein Fehler ist aufgetreten: {$e->getMessage()}\n";
        $conn->close();
    }
    
    /**
     * Hilfsfunktion zum Senden einer Nachricht an alle verbundenen Clients.
     */
    protected function broadcast($message, $exclude = null) {
        foreach ($this->clients as $client) {
            if ($client !== $exclude) {
                $client->send($message);
            }
        }
    }
}