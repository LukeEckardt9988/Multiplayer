<?php

namespace MyApp;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

// Vector3 Klasse bleibt unverändert
class Vector3
{
    public $x, $y, $z;
    public function __construct($x = 0, $y = 0, $z = 0)
    {
        $this->x = $x;
        $this->y = $y;
        $this->z = $z;
    }
    public function distanceTo(Vector3 $v): float
    {
        $dx = $this->x - $v->x;
        $dy = $this->y - $v->y;
        $dz = $this->z - $v->z;
        return sqrt($dx * $dx + $dy * $dy + $dz * $dz);
    }
}

class GameServer implements MessageComponentInterface
{
    // Eigenschaften bleiben unverändert
    protected $clients;
    protected $playerStates;
    protected $worldItems;
    protected $gameConfig;

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        $this->playerStates = [];
        $this->worldItems = [];
        $this->gameConfig = [
            'weapons' => [
                'pistole' => ['name' => 'Pistole', 'model' => 'pistole.glb', 'damage' => 10, 'fire_rate_ms' => 400],
                'gewehr' => ['name' => 'Gewehr', 'model' => 'gewehr.glb', 'damage' => 25, 'fire_rate_ms' => 800],
            ],
            'ammo' => ['model' => 'munition.glb', 'amount' => 15]
        ];
        $this->initializeWorldItems();
        echo "WebSocket Game-Server wurde erfolgreich gestartet.\n";
    }

    public function initializeWorldItems()
    {
        // Diese Zeile fügt das Gewehr hinzu. Stelle sicher, dass sie da ist!
        $this->worldItems[] = ['id' => 'item_' . uniqid(), 'type' => 'weapon', 'name' => 'gewehr', 'position' => ['x' => 10, 'y' => 1, 'z' => 10]];

        // Diese Schleife fügt 5 Munitionspakete hinzu.
        for ($i = 0; $i < 5; $i++) {
            $this->worldItems[] = ['id' => 'item_' . uniqid(), 'type' => 'ammo', 'position' => ['x' => rand(-20, 20), 'y' => 1, 'z' => rand(-20, 20)]];
        }
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        $sessionId = $conn->resourceId;
        $queryString = $conn->httpRequest->getUri()->getQuery();
        parse_str($queryString, $queryParams);
        $playerName = htmlspecialchars($queryParams['name'] ?? 'Spieler_' . $sessionId);

        $this->playerStates[$sessionId] = [
            'id' => $sessionId,
            'name' => $playerName,
            'model' => 'person1.glb',
            'health' => 100,
            'position' => ['x' => rand(-5, 5), 'y' => 1, 'z' => rand(-5, 5)],
            'rotation' => ['x' => 0, 'y' => 0, 'z' => 0],
            'equipped_weapon' => 'pistole',
            'ammo' => 30,
            'last_shot_timestamp' => 0
        ];

        echo "Neue Verbindung von '{$playerName}' (ID: {$sessionId})\n";

        $conn->send(json_encode(['type' => 'welcome', 'state' => $this->playerStates[$sessionId]]));
        $conn->send(json_encode(['type' => 'current_players', 'players' => $this->playerStates]));
        $conn->send(json_encode(['type' => 'world_items', 'items' => $this->worldItems]));
        $this->broadcast(json_encode(['type' => 'new_player', 'player' => $this->playerStates[$sessionId]]), $conn);
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
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
            case 'pickup_item':
                // KORREKTUR 1: Punkt '.' durch Pfeil '->' ersetzt
                $this->handleItemPickup($senderId, $data['id']);
                break;
        }
    }

    /**
     * Verarbeitet die Logik zum Aufheben von Items.
     */
    public function handleItemPickup($playerId, $itemId)
    {
        $player = &$this->playerStates[$playerId];
        $itemIndex = -1;
        foreach ($this->worldItems as $index => $item) {
            if ($item['id'] === $itemId) {
                $itemIndex = $index;
                break;
            }
        }
        if ($itemIndex === -1) return;

        $item = $this->worldItems[$itemIndex];
        $playerPosition = new Vector3($player['position']['x'], $player['position']['y'], $player['position']['z']);
        $itemPosition = new Vector3($item['position']['x'], $item['position']['y'], $item['position']['z']);

        if ($playerPosition->distanceTo($itemPosition) > 3) return;

        $itemToDrop = null;

        if ($item['type'] === 'weapon') {
            $currentWeaponName = $player['equipped_weapon'];
            $itemToDrop = [
                'id' => 'item_' . uniqid(),
                'type' => 'weapon',
                'name' => $currentWeaponName,
                'position' => $player['position']
            ];
            $player['equipped_weapon'] = $item['name'];
        } elseif ($item['type'] === 'ammo') {
            $player['ammo'] += $this->gameConfig['ammo']['amount'];
        }

        array_splice($this->worldItems, $itemIndex, 1);
        $this->broadcast(json_encode(['type' => 'item_removed', 'id' => $itemId]));

        if ($itemToDrop !== null) {
            $this->worldItems[] = $itemToDrop;

            // HIER IST DIE KORREKTUR: Punkt durch Pfeil ersetzt
            $this->broadcast(json_encode(['type' => 'new_item_spawned', 'item' => $itemToDrop]));
        }

        foreach ($this->clients as $client) {
            if ($client->resourceId == $playerId) {
                $client->send(json_encode(['type' => 'player_state_update', 'state' => $player]));
                break;
            }
        }
    }

    // KORREKTUR 2: handleShoot-Funktion aus handleItemPickup herausgezogen
    public function handleShoot($shooterId, $shootData)
    {
        $player = &$this->playerStates[$shooterId];
        $weaponKey = $player['equipped_weapon'];
        $weaponConfig = $this->gameConfig['weapons'][$weaponKey];
        $now = microtime(true) * 1000;
        if ($now - $player['last_shot_timestamp'] < $weaponConfig['fire_rate_ms']) {
            return;
        }
        $player['last_shot_timestamp'] = $now;
        $this->broadcast(json_encode(['type' => 'shot_fired', 'shooter_id' => $shooterId]));
        $shotOrigin = new Vector3($shootData['position']['x'], $shootData['position']['y'], $shootData['position']['z']);
        foreach ($this->playerStates as $targetId => &$targetState) {
            if ($shooterId === $targetId) continue;
            $targetPosition = new Vector3($targetState['position']['x'], $targetState['position']['y'], $targetState['position']['z']);
            if ($shotOrigin->distanceTo($targetPosition) < 2.0) {
                $targetState['health'] = max(0, $targetState['health'] - $weaponConfig['damage']);
                $this->broadcast(json_encode(['type' => 'player_hit', 'victim_id' => $targetId, 'victim_health' => $targetState['health'], 'shooter_id' => $shooterId]));
                if ($targetState['health'] <= 0) {
                    $targetState['health'] = 100;
                    $targetState['position'] = ['x' => rand(-20, 20), 'y' => 1, 'z' => rand(-20, 20)];
                    $this->broadcast(json_encode(['type' => 'player_respawned', 'player' => $targetState]));
                }
                break;
            }
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $sessionId = $conn->resourceId;
        $playerName = "Unbekannt";
        if (isset($this->playerStates[$sessionId])) {
            $playerName = $this->playerStates[$sessionId]['name'];
            unset($this->playerStates[$sessionId]);
        }
        $this->clients->detach($conn);
        $this->broadcast(json_encode(['type' => 'player_disconnected', 'id' => $sessionId]));
        echo "Verbindung von '{$playerName}' (ID: {$sessionId}) wurde getrennt.\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "Ein Fehler ist aufgetreten: {$e->getMessage()}\n";
        $conn->close();
    }

    protected function broadcast($message, $exclude = null)
    {
        foreach ($this->clients as $client) {
            if ($client !== $exclude) {
                $client->send($message);
            }
        }
    }
}
