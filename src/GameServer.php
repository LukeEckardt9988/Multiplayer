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
     * @param Vector3 $v Der andere Vektor.
     * @return float Die Distanz.
     */
    public function distanceTo(Vector3 $v) {
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
    protected $playerStates; // Speichert den Live-Zustand aller Spieler

    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->playerStates = [];
        echo "WebSocket Game-Server wurde erfolgreich gestartet.\n";
    }

    /**
     * Wird aufgerufen, wenn sich ein neuer Spieler (Client) verbindet.
     */
    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        $sessionId = $conn->resourceId;

        // Liest den Spielernamen aus der Verbindungs-URL (z.B. ws://host:8080?name=MeinName)
        $queryString = $conn->httpRequest->getUri()->getQuery();
        parse_str($queryString, $queryParams);
        $playerName = trim($queryParams['name'] ?? 'Spieler_' . $sessionId);
        $playerName = htmlspecialchars($playerName); // Sicherheitsmaßnahme

        echo "Neue Verbindung von '{$playerName}' (ID: {$sessionId})\n";

        // Erstellt den Anfangszustand für den neuen Spieler
        $this->playerStates[$sessionId] = [
            'id' => $sessionId,
            'name' => $playerName,
            'model' => 'person1.glb', // Alle Spieler nutzen dieses Modell
            'position' => ['x' => 0, 'y' => 1, 'z' => 5], // Feste Startposition
            'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
            'health' => 100
        ];

        // 1. Sende dem neuen Spieler seine eigene ID und seinen Zustand
        $conn->send(json_encode(['type' => 'welcome', 'your_id' => $sessionId, 'state' => $this->playerStates[$sessionId]]));

        // 2. Sende dem neuen Spieler die Zustände aller anderen, bereits verbundenen Spieler
        $conn->send(json_encode(['type' => 'current_players', 'players' => $this->playerStates]));

        // 3. Informiere alle anderen Spieler über den neuen Spieler
        foreach ($this->clients as $client) {
            if ($conn !== $client) {
                $client->send(json_encode(['type' => 'new_player', 'player' => $this->playerStates[$sessionId]]));
            }
        }
    }

    /**
     * Wird aufgerufen, wenn eine Nachricht von einem Spieler empfangen wird.
     */
    public function onMessage(ConnectionInterface $from, $msg) {
        $senderId = $from->resourceId;
        $data = json_decode($msg, true);
        $type = $data['type'] ?? '';

        switch ($type) {
            case 'update_state':
                if (isset($this->playerStates[$senderId])) {
                    $this->playerStates[$senderId]['position'] = $data['position'];
                    $this->playerStates[$senderId]['rotation'] = $data['rotation'];

                    // Sende die neue Position an alle ANDEREN Clients
                    foreach ($this->clients as $client) {
                        if ($from !== $client) {
                            $client->send(json_encode(['type' => 'player_moved', 'player' => $this->playerStates[$senderId]]));
                        }
                    }
                }
                break;

            case 'shoot':
                $this->handleShoot($senderId, $data);
                break;
        }
    }

    /**
     * Verarbeitet die Schuss-Logik.
     */
    public function handleShoot($shooterId, $shootData) {
        if (!isset($this->playerStates[$shooterId])) return;

        $shotOrigin = new Vector3($shootData['position']['x'], $shootData['position']['y'], $shootData['position']['z']);

        // Informiere alle Clients, dass ein Schuss abgefeuert wurde (für Effekte)
        $this->broadcast(json_encode(['type' => 'shot_fired', 'shooter_id' => $shooterId]));

        // Treffererkennung gegen alle anderen Spieler
        foreach ($this->playerStates as $targetId => $targetState) {
            if ($shooterId === $targetId) continue; // Man kann sich nicht selbst treffen

            $targetPosition = new Vector3($targetState['position']['x'], $targetState['position']['y'], $targetState['position']['z']);

            // Vereinfachte Treffererkennung: Ist das Ziel nahe am Schützen?
            // HINWEIS: Dies ist eine sehr einfache Methode. Echte Spiele nutzen Raycasting.
            $distance = $shotOrigin->distanceTo($targetPosition);
            if ($distance < 2.0) { // Ein großzügiger Hitbox-Radius von 2.0 Einheiten

                // Reduziere die Gesundheit des Ziels
                $newHealth = max(0, $targetState['health'] - 25); // 25 Schaden
                $this->playerStates[$targetId]['health'] = $newHealth;

                // Informiere alle über den Treffer
                $this->broadcast(json_encode([
                    'type' => 'player_hit',
                    'victim_id' => $targetId,
                    'victim_health' => $newHealth,
                    'shooter_id' => $shooterId
                ]));

                // Handle Tod und Respawn
                if ($newHealth <= 0) {
                    $this->playerStates[$targetId]['health'] = 100; // Gesundheit zurücksetzen
                    $this->playerStates[$targetId]['position'] = ['x' => rand(-10, 10), 'y' => 1, 'z' => rand(-10, 10)]; // Neue Zufallsposition
                    
                    $this->broadcast(json_encode([
                        'type' => 'player_respawned',
                        'player' => $this->playerStates[$targetId]
                    ]));
                }
                // Ein Schuss trifft nur das erste Ziel in dieser einfachen Logik
                break;
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

        // Informiere alle verbleibenden Spieler, dass jemand gegangen ist
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
    protected function broadcast($message) {
        foreach ($this->clients as $client) {
            $client->send($message);
        }
    }
}