const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3033;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/fortnite_multiplayer.html';

    let filePath = path.join(PUBLIC_DIR, reqUrl);
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('403 Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('404 Não Encontrado');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const headers = {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Clear-Site-Data': '"cache"'
        };

        if (req.method === 'HEAD') {
            res.writeHead(200, headers);
            return res.end();
        }

        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    });
});

const SERVER_BUILD_VERSION = '2.7.0';

const wss = new WebSocketServer({ server });

let nextPlayerCounter = 1;

// ==========================================
// ELEVAÇÃO DO TERRENO & SPAWNS
// ==========================================
function getGroundHeight(x, z) {
    const dist = Math.hypot(x, z);
    let y = Math.sin(x * 0.045) * Math.cos(z * 0.045) * 5.0 + Math.cos(x * 0.02) * 2.5;
    if (dist > 95) y -= (dist - 95) * 0.6;
    return Math.max(y, -2.8);
}

const BLUE_SPAWNS = [
    { x: -50, z: -50 },
    { x: -42, z: -18 },
    { x: -55, z: 12 },
    { x: -18, z: -48 },
    { x: -32, z: 32 },
    { x: -26, z: -24 }
];

const RED_SPAWNS = [
    { x: 50, z: 50 },
    { x: 42, z: 18 },
    { x: 55, z: -12 },
    { x: 18, z: 48 },
    { x: 32, z: -32 },
    { x: 26, z: 24 }
];

// ==========================================
// LABIRINTO & COLISÕES FÍSICAS NO SERVIDOR
// ==========================================
const MAZE_GRID = [
    [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1]
];

const CELL_SIZE = 3.8;
const WALL_THICKNESS = 0.7;
const GRID_ROWS = MAZE_GRID.length;
const GRID_COLS = MAZE_GRID[0].length;
const OFFSET_X = -((GRID_COLS * CELL_SIZE) / 2);
const OFFSET_Z = -((GRID_ROWS * CELL_SIZE) / 2);

const mazeColliders = [];
for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
        if (MAZE_GRID[r][c] === 1) {
            const wx = OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2;
            const wz = OFFSET_Z + r * CELL_SIZE + CELL_SIZE / 2;
            mazeColliders.push({
                minX: wx - CELL_SIZE / 2,
                maxX: wx + CELL_SIZE / 2,
                minZ: wz - WALL_THICKNESS / 2,
                maxZ: wz + WALL_THICKNESS / 2
            });
        }
    }
}

function checkWallCollisionWithBuilds(x, z, radius = 0.55, builds = []) {
    // 1. Labirinto
    for (let i = 0; i < mazeColliders.length; i++) {
        const b = mazeColliders[i];
        if (x + radius > b.minX && x - radius < b.maxX &&
            z + radius > b.minZ && z - radius < b.maxZ) {
            return true;
        }
    }
    // 2. Construções
    for (let i = 0; i < builds.length; i++) {
        const b = builds[i];
        if (b.buildType === 'wall') {
            const hw = 1.8;
            const ht = 0.45;
            const cos = Math.abs(Math.cos(b.rotY || 0));
            const sin = Math.abs(Math.sin(b.rotY || 0));
            const boundX = hw * sin + ht * cos;
            const boundZ = hw * cos + ht * sin;
            if (x + radius > b.x - boundX && x - radius < b.x + boundX &&
                z + radius > b.z - boundZ && z - radius < b.z + boundZ) {
                return true;
            }
        }
    }
    return false;
}

function isLineOfSightBlockedInRoom(x1, z1, x2, z2, builds = []) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    if (dist < 0.5) return false;
    const steps = Math.ceil(dist / 0.75);
    const dx = (x2 - x1) / steps;
    const dz = (z2 - z1) / steps;
    for (let s = 1; s < steps; s++) {
        const testX = x1 + dx * s;
        const testZ = z1 + dz * s;
        if (checkWallCollisionWithBuilds(testX, testZ, 0.32, builds)) {
            return true;
        }
    }
    return false;
}

// ==========================================
// POOL DE BOTS DISPONÍVEIS (8 AZUL / 8 VERMELHO)
// ==========================================
const ALL_BOTS_POOL = [
    { id: 'BOT_1', name: 'Bot João', team: 'blue', color: '#2563eb' },
    { id: 'BOT_2', name: 'Bot Carol', team: 'blue', color: '#3b82f6' },
    { id: 'BOT_3', name: 'Bot Sophia', team: 'blue', color: '#0284c7' },
    { id: 'BOT_4', name: 'Bot Leo', team: 'blue', color: '#06b6d4' },
    { id: 'BOT_5', name: 'Bot Lucas', team: 'blue', color: '#38bdf8' },
    { id: 'BOT_6', name: 'Bot Arthur', team: 'blue', color: '#60a5fa' },
    { id: 'BOT_7', name: 'Bot Gabriel', team: 'blue', color: '#1d4ed8' },
    { id: 'BOT_8', name: 'Bot Enzo', team: 'blue', color: '#0369a1' },
    { id: 'BOT_9', name: 'Bot Diniz', team: 'red', color: '#dc2626' },
    { id: 'BOT_10', name: 'Bot Conrado', team: 'red', color: '#ef4444' },
    { id: 'BOT_11', name: 'Bot Joãoz', team: 'red', color: '#b91c1c' },
    { id: 'BOT_12', name: 'Bot Miguel', team: 'red', color: '#f87171' },
    { id: 'BOT_13', name: 'Bot Davi', team: 'red', color: '#e11d48' },
    { id: 'BOT_14', name: 'Bot Heitor', team: 'red', color: '#be123c' },
    { id: 'BOT_15', name: 'Bot Matheus', team: 'red', color: '#f43f5e' },
    { id: 'BOT_16', name: 'Bot Pedro', team: 'red', color: '#991b1b' }
];

// ==========================================
// CLASSE GAMEROOM (ARQUITETURA DE SALAS)
// ==========================================
class GameRoom {
    constructor(id, name, options = {}) {
        this.id = id;
        this.name = name;
        this.isDefault = !!options.isDefault;
        this.targetBotCount = Math.max(0, Math.min(16, options.botCount !== undefined ? options.botCount : 6));
        this.targetKills = options.targetKills || 25;
        this.map = options.map || 'island';
        this.createdAt = Date.now();

        this.players = new Map(); // id => player
        this.worldBuilds = [];
        this.teamScores = { blue: 0, red: 0 };
        this.activeBotsList = [];
        this.botStates = new Map();

        this.blueSpawnIdx = 0;
        this.redSpawnIdx = 0;

        this.isRoundResetting = false;
        this.stormState = this.createNewStormState();
        this.lastBotTick = Date.now();

        this.initBots();
    }

    createNewStormState() {
        return {
            x: 0,
            z: 0,
            targetX: (Math.random() - 0.5) * 55, // Posição de destino aleatória na ilha
            targetZ: (Math.random() - 0.5) * 55,
            radius: 135, // Começa fora do mapa
            minRadius: 8,
            shrinkSpeed: 0.35,
            lastUpdate: Date.now(),
            lastDmgTick: Date.now()
        };
    }

    getGroundSpawnForTeam(team) {
        const storm = this.stormState || { x: 0, z: 0, radius: 135 };
        // Margem de segurança de 10 metros para dentro do raio seguro da tempestade
        const safeRadius = Math.max(6, (storm.radius || 135) - 10);
        const stormX = storm.x || 0;
        const stormZ = storm.z || 0;

        // 1. Tentar os pontos fixos da base do time que estejam comprovadamente fora do gás tóxico
        const teamSpawns = (team === 'red') ? RED_SPAWNS : BLUE_SPAWNS;
        const validBaseSpawns = teamSpawns.filter(pt => {
            const dist = Math.hypot(pt.x - stormX, pt.z - stormZ);
            return dist < safeRadius;
        });

        if (validBaseSpawns.length > 0) {
            const idx = (team === 'red') ? (this.redSpawnIdx++ % validBaseSpawns.length) : (this.blueSpawnIdx++ % validBaseSpawns.length);
            const pt = validBaseSpawns[idx];
            for (let i = 0; i < 8; i++) {
                const ox = (Math.random() - 0.5) * 5;
                const oz = (Math.random() - 0.5) * 5;
                const x = pt.x + ox;
                const z = pt.z + oz;
                if (Math.hypot(x - stormX, z - stormZ) < safeRadius && !checkWallCollisionWithBuilds(x, z, 0.7, this.worldBuilds)) {
                    const y = getGroundHeight(x, z);
                    return { x, y, z };
                }
            }
            return { x: pt.x, y: getGroundHeight(pt.x, pt.z), z: pt.z };
        }

        // 2. Se a base do time já foi tomada pelo gás tóxico, gera spawn OBRIGATORIAMENTE DENTRO DA SAFE ZONE
        // Polarizado ligeiramente para o quadrante do time (Vermelho: +X,+Z / Azul: -X,-Z)
        const teamAngle = (team === 'red') ? Math.PI * 0.25 : -Math.PI * 0.75;
        for (let i = 0; i < 35; i++) {
            const angle = teamAngle + (Math.random() - 0.5) * Math.PI * 0.85;
            const r = Math.random() * Math.max(2, safeRadius * 0.75);
            const x = stormX + Math.cos(angle) * r;
            const z = stormZ + Math.sin(angle) * r;
            const islandDist = Math.hypot(x, z);
            if (islandDist < 85 && !checkWallCollisionWithBuilds(x, z, 0.7, this.worldBuilds)) {
                const y = getGroundHeight(x, z);
                return { x, y, z };
            }
        }

        // Fallback garantido no centro seguro da tempestade
        return { x: stormX, y: getGroundHeight(stormX, stormZ), z: stormZ };
    }

    broadcast(msg, excludeWs = null) {
        const data = JSON.stringify(msg);
        this.players.forEach(p => {
            if (p.ws && p.ws !== excludeWs && p.ws.readyState === 1) {
                p.ws.send(data);
            }
        });
    }

    getAliveCount() {
        let count = 0;
        this.players.forEach(p => {
            if (p.isAlive) count++;
        });
        return count;
    }

    getHumanPlayerCount() {
        let count = 0;
        this.players.forEach(p => {
            if (!p.isBot) count++;
        });
        return count;
    }

    getPlayerList() {
        const list = [];
        this.players.forEach(p => {
            list.push({
                id: p.id,
                name: p.name,
                team: p.team || 'blue',
                skinColor: p.skinColor,
                x: p.x,
                y: p.y,
                z: p.z,
                yaw: p.yaw,
                hp: p.hp,
                shield: p.shield,
                kills: p.kills,
                deaths: p.deaths || 0,
                isGliding: p.isGliding,
                isAlive: p.isAlive,
                isBot: !!p.isBot
            });
        });
        return list;
    }

    getDetails() {
        return {
            id: this.id,
            name: this.name,
            map: this.map || 'island',
            isDefault: this.isDefault,
            playerCount: this.getHumanPlayerCount(),
            maxPlayers: 16,
            botCount: this.targetBotCount,
            targetKills: this.targetKills,
            teamScores: this.teamScores,
            stormRadius: Math.round(this.stormState.radius),
            isPlaying: !this.isRoundResetting
        };
    }

    setBotCount(count) {
        this.targetBotCount = Math.max(0, Math.min(16, parseInt(count, 10) || 0));

        const blueCount = Math.ceil(this.targetBotCount / 2);
        const redCount = Math.floor(this.targetBotCount / 2);

        const needed = [];
        for (let i = 0; i < blueCount; i++) needed.push(ALL_BOTS_POOL[i]);
        for (let i = 0; i < redCount; i++) needed.push(ALL_BOTS_POOL[8 + i]);

        const neededIds = new Set(needed.map(b => b.id));

        // Remove bots excedentes
        for (let i = this.activeBotsList.length - 1; i >= 0; i--) {
            const b = this.activeBotsList[i];
            if (!neededIds.has(b.id)) {
                this.players.delete(b.id);
                this.botStates.delete(b.id);
                this.activeBotsList.splice(i, 1);
                this.broadcast({
                    type: 'player_left',
                    id: b.id,
                    name: b.name,
                    aliveCount: this.getAliveCount(),
                    teamScores: this.teamScores,
                    players: this.getPlayerList()
                });
            }
        }

        // Adiciona novos bots necessários
        const currentActiveIds = new Set(this.activeBotsList.map(b => b.id));
        needed.forEach(cfg => {
            if (!currentActiveIds.has(cfg.id)) {
                const spawn = this.getGroundSpawnForTeam(cfg.team);
                const botPlayer = {
                    id: cfg.id,
                    ws: null,
                    name: cfg.name,
                    team: cfg.team,
                    skinColor: cfg.color,
                    x: spawn.x,
                    y: spawn.y,
                    z: spawn.z,
                    yaw: cfg.team === 'red' ? Math.PI : 0,
                    hp: 100,
                    shield: 100,
                    kills: 0,
                    deaths: 0,
                    isGliding: false,
                    isAlive: true,
                    isBot: true
                };
                this.players.set(cfg.id, botPlayer);

                this.botStates.set(cfg.id, {
                    respawnTime: 0,
                    nextShootTime: Date.now() + 2000 + Math.random() * 2000,
                    patrolAngle: Math.random() * Math.PI * 2,
                    patrolRadius: 15 + Math.random() * 30
                });
                this.activeBotsList.push(cfg);

                this.broadcast({
                    type: 'player_joined',
                    player: {
                        id: botPlayer.id,
                        name: botPlayer.name,
                        team: botPlayer.team,
                        skinColor: botPlayer.skinColor,
                        x: botPlayer.x,
                        y: botPlayer.y,
                        z: botPlayer.z,
                        yaw: botPlayer.yaw,
                        hp: botPlayer.hp,
                        shield: botPlayer.shield,
                        kills: botPlayer.kills,
                        deaths: botPlayer.deaths,
                        isGliding: botPlayer.isGliding,
                        isAlive: botPlayer.isAlive
                    },
                    aliveCount: this.getAliveCount(),
                    teamScores: this.teamScores
                });
            }
        });

        this.broadcast({
            type: 'bot_count_updated',
            count: this.targetBotCount,
            players: this.getPlayerList(),
            aliveCount: this.getAliveCount()
        });
        broadcastRoomListToLobby();
    }

    initBots() {
        this.setBotCount(this.targetBotCount);
    }

    resetRound(reason = 'score', winningTeam = null) {
        if (this.isRoundResetting) return;
        this.isRoundResetting = true;

        if (reason === 'gas') {
            console.log(`☣️ [GÁS TÓXICO] A névoa tóxica tomou toda a ilha na sala "${this.name}"! Reiniciando em 5s...`);
            if (!winningTeam) {
                if (this.teamScores.blue > this.teamScores.red) winningTeam = 'blue';
                else if (this.teamScores.red > this.teamScores.blue) winningTeam = 'red';
                else winningTeam = 'draw';
            }
        } else {
            console.log(`🏆 [FIM DE RODADA] Time ${winningTeam ? winningTeam.toUpperCase() : 'VENCEDOR'} venceu na sala "${this.name}"! Reiniciando em 5s...`);
        }

        this.broadcast({
            type: 'round_ended',
            reason: reason,
            winningTeam: winningTeam,
            blueScore: this.teamScores.blue,
            redScore: this.teamScores.red,
            countdown: 5
        });

        setTimeout(() => {
            this.teamScores.blue = 0;
            this.teamScores.red = 0;
            this.worldBuilds.length = 0;
            this.stormState = this.createNewStormState();

            this.players.forEach(p => {
                const spawn = this.getGroundSpawnForTeam(p.team);
                p.hp = 100;
                p.shield = 100;
                p.kills = 0;
                p.deaths = 0;
                p.isAlive = true;
                p.isGliding = false;
                p.x = spawn.x;
                p.y = spawn.y;
                p.z = spawn.z;
            });

            this.isRoundResetting = false;
            console.log(`🔥 [NOVA RODADA] Sala "${this.name}" reiniciada com sucesso!`);

            this.broadcast({
                type: 'round_restarted',
                teamScores: this.teamScores,
                stormRadius: this.stormState.radius,
                stormX: this.stormState.x,
                stormZ: this.stormState.z,
                builds: [],
                players: this.getPlayerList()
            });

            broadcastRoomListToLobby();
        }, 5000);
    }

    updateStorm(dt, now) {
        if (this.isRoundResetting) return;

        // Encolhe o Gás Tóxico
        if (this.players.size > 0 && this.stormState.radius > this.stormState.minRadius) {
            this.stormState.radius = Math.max(this.stormState.minRadius, this.stormState.radius - this.stormState.shrinkSpeed * dt);
            const progress = Math.min(1.0, (135 - this.stormState.radius) / (135 - this.stormState.minRadius));
            this.stormState.x = this.stormState.targetX * progress;
            this.stormState.z = this.stormState.targetZ * progress;
        }

        // Se o Gás Tóxico fechou completamente a ilha, finaliza a rodada!
        if (this.stormState.radius <= this.stormState.minRadius + 0.1) {
            this.resetRound('gas');
            return;
        }

        // Broadcast periódico do raio e centro do Gás Tóxico
        this.broadcast({
            type: 'storm_update',
            radius: this.stormState.radius,
            x: this.stormState.x,
            z: this.stormState.z
        });

        // Dano contínuo de Gás Tóxico (a cada 1 segundo)
        if (now - this.stormState.lastDmgTick >= 1000) {
            this.stormState.lastDmgTick = now;
            const gasDamage = Math.max(6, Math.floor(15 - (this.stormState.radius / 10)));
            let aliveAny = false;

            this.players.forEach(p => {
                if (!p.isAlive) return;
                aliveAny = true;
                const dist = Math.hypot(p.x - this.stormState.x, p.z - this.stormState.z);
                if (dist > this.stormState.radius) {
                    p.hp = Math.max(0, p.hp - gasDamage);

                    this.broadcast({
                        type: 'player_damaged',
                        targetId: p.id,
                        attackerId: 'GAS_TOXICO',
                        attackerName: 'Gás Tóxico',
                        attackerTeam: 'gas',
                        targetName: p.name,
                        targetTeam: p.team,
                        shield: p.shield,
                        hp: p.hp,
                        damage: gasDamage,
                        isHeadshot: false,
                        weapon: 'gas'
                    });

                    if (p.hp <= 0) {
                        p.hp = 0;
                        p.shield = 0;
                        p.isAlive = false;
                        p.deaths = (p.deaths || 0) + 1;

                        this.broadcast({
                            type: 'player_eliminated',
                            victimId: p.id,
                            victimName: p.name,
                            victimTeam: p.team,
                            killerId: 'GAS_TOXICO',
                            killerName: 'Gás Tóxico',
                            killerTeam: 'gas',
                            killerKills: 0,
                            weapon: 'gas',
                            aliveCount: this.getAliveCount(),
                            teamScores: this.teamScores,
                            winningTeam: null
                        });

                        this.broadcast({
                            type: 'score_update',
                            teamScores: this.teamScores,
                            players: this.getPlayerList()
                        });

                        if (p.isBot) {
                            const bState = this.botStates.get(p.id);
                            if (bState) bState.respawnTime = now + 4500;
                        }
                    }
                }
            });

            // Se todos os players morreram no gás
            if (this.players.size > 0 && this.getAliveCount() === 0) {
                this.resetRound('gas');
            }
        }
    }

    updateBots(dt, now) {
        if (this.isRoundResetting) return;
        if (this.getHumanPlayerCount() === 0) return;

        this.activeBotsList.forEach(cfg => {
            const bot = this.players.get(cfg.id);
            const state = this.botStates.get(cfg.id);
            if (!bot || !state) return;

            // Respawn automático do Bot
            if (!bot.isAlive) {
                if (now > state.respawnTime && state.respawnTime > 0) {
                    const spawn = this.getGroundSpawnForTeam(bot.team);
                    bot.hp = 100;
                    bot.shield = 100;
                    bot.isAlive = true;
                    bot.x = spawn.x;
                    bot.y = spawn.y;
                    bot.z = spawn.z;
                    state.respawnTime = 0;

                    this.broadcast({
                        type: 'player_respawned',
                        id: bot.id,
                        name: bot.name,
                        team: bot.team,
                        x: bot.x,
                        y: bot.y,
                        z: bot.z,
                        hp: 100,
                        shield: 100,
                        isGliding: false,
                        aliveCount: this.getAliveCount(),
                        teamScores: this.teamScores
                    });
                }
                return;
            }

            // Busca inimigo mais próximo
            let closestDist = 52.0;
            let target = null;

            for (const other of this.players.values()) {
                if (!other.isAlive || other.team === bot.team) continue;
                const dist = Math.hypot(other.x - bot.x, other.z - bot.z);
                if (dist < closestDist) {
                    closestDist = dist;
                    target = other;
                }
            }

            let isMoving = false;

            if (target) {
                const losBlocked = isLineOfSightBlockedInRoom(bot.x, bot.z, target.x, target.z, this.worldBuilds);
                const dx = target.x - bot.x;
                const dz = target.z - bot.z;
                bot.yaw = Math.atan2(dx, dz) + Math.PI;

                if (closestDist > 8.5) {
                    const speed = 7.5;
                    const dirX = Math.sin(bot.yaw - Math.PI);
                    const dirZ = Math.cos(bot.yaw - Math.PI);
                    const nextX = bot.x + dirX * speed * dt;
                    const nextZ = bot.z + dirZ * speed * dt;
                    if (!checkWallCollisionWithBuilds(nextX, bot.z, 0.55, this.worldBuilds)) bot.x = nextX;
                    if (!checkWallCollisionWithBuilds(bot.x, nextZ, 0.55, this.worldBuilds)) bot.z = nextZ;
                    isMoving = true;
                } else if (closestDist < 5.0) {
                    const speed = 4.0;
                    const dirX = Math.sin(bot.yaw);
                    const dirZ = Math.cos(bot.yaw);
                    const nextX = bot.x + dirX * speed * dt;
                    const nextZ = bot.z + dirZ * speed * dt;
                    if (!checkWallCollisionWithBuilds(nextX, bot.z, 0.55, this.worldBuilds)) bot.x = nextX;
                    if (!checkWallCollisionWithBuilds(bot.x, nextZ, 0.55, this.worldBuilds)) bot.z = nextZ;
                    isMoving = true;
                }

                if (!losBlocked && now > state.nextShootTime) {
                    state.nextShootTime = now + 1400 + Math.random() * 1200;

                    this.broadcast({
                        type: 'player_fired',
                        id: bot.id,
                        weapon: 'scar',
                        origin: { x: bot.x, y: bot.y + 1.4, z: bot.z },
                        target: { x: target.x, y: target.y + 1.2, z: target.z }
                    });

                    const hitChance = Math.max(0.20, 0.60 - (closestDist / 60));
                    if (Math.random() < hitChance) {
                        const dmg = 20 + Math.floor(Math.random() * 12);
                        const isHeadshot = Math.random() < 0.15;
                        const totalDmg = isHeadshot ? dmg * 2 : dmg;

                        let remainingDmg = totalDmg;
                        if (target.shield > 0) {
                            const sDmg = Math.min(target.shield, remainingDmg);
                            target.shield -= sDmg;
                            remainingDmg -= sDmg;
                        }
                        if (remainingDmg > 0) {
                            target.hp = Math.max(0, target.hp - remainingDmg);
                        }

                        this.broadcast({
                            type: 'player_damaged',
                            targetId: target.id,
                            attackerId: bot.id,
                            attackerName: bot.name,
                            attackerTeam: bot.team,
                            targetName: target.name,
                            targetTeam: target.team,
                            shield: target.shield,
                            hp: target.hp,
                            damage: totalDmg,
                            isHeadshot: isHeadshot,
                            weapon: 'scar'
                        });

                        if (target.hp <= 0) {
                            target.hp = 0;
                            target.shield = 0;
                            target.isAlive = false;
                            target.deaths = (target.deaths || 0) + 1;
                            bot.kills++;

                            if (bot.team === 'blue') this.teamScores.blue++;
                            else if (bot.team === 'red') this.teamScores.red++;

                            let winningTeam = null;
                            if (this.teamScores.blue >= this.targetKills) winningTeam = 'blue';
                            if (this.teamScores.red >= this.targetKills) winningTeam = 'red';

                            this.broadcast({
                                type: 'player_eliminated',
                                victimId: target.id,
                                victimName: target.name,
                                victimTeam: target.team,
                                killerId: bot.id,
                                killerName: bot.name,
                                killerTeam: bot.team,
                                killerKills: bot.kills,
                                weapon: 'scar',
                                aliveCount: this.getAliveCount(),
                                teamScores: this.teamScores,
                                winningTeam: winningTeam
                            });

                            this.broadcast({
                                type: 'score_update',
                                teamScores: this.teamScores,
                                players: this.getPlayerList()
                            });

                            if (winningTeam && !this.isRoundResetting) {
                                this.resetRound('score', winningTeam);
                            }

                            if (target.isBot) {
                                const tState = this.botStates.get(target.id);
                                if (tState) tState.respawnTime = now + 4500;
                            }
                        }
                    }
                }
            } else {
                state.patrolAngle += 0.5 * dt;
                const targetX = Math.cos(state.patrolAngle) * state.patrolRadius;
                const targetZ = Math.sin(state.patrolAngle) * state.patrolRadius;
                const dx = targetX - bot.x;
                const dz = targetZ - bot.z;
                const dist = Math.hypot(dx, dz);

                if (dist > 2.0) {
                    bot.yaw = Math.atan2(dx, dz) + Math.PI;
                    const speed = 5.2;
                    const nextX = bot.x + (dx / dist) * speed * dt;
                    const nextZ = bot.z + (dz / dist) * speed * dt;
                    if (!checkWallCollisionWithBuilds(nextX, bot.z, 0.55, this.worldBuilds)) bot.x = nextX;
                    if (!checkWallCollisionWithBuilds(bot.x, nextZ, 0.55, this.worldBuilds)) bot.z = nextZ;
                    isMoving = true;
                }
            }

            // Fuga do Gás Tóxico
            const distToSafeCenter = Math.hypot(bot.x - this.stormState.x, bot.z - this.stormState.z);
            if (distToSafeCenter > Math.max(8.0, this.stormState.radius - 6.0)) {
                const angleToCenter = Math.atan2(this.stormState.x - bot.x, this.stormState.z - bot.z);
                bot.yaw = angleToCenter + Math.PI;
                const speed = 7.5;
                const nextX = bot.x + Math.sin(angleToCenter) * speed * dt;
                const nextZ = bot.z + Math.cos(angleToCenter) * speed * dt;
                if (!checkWallCollisionWithBuilds(nextX, bot.z, 0.55, this.worldBuilds)) bot.x = nextX;
                if (!checkWallCollisionWithBuilds(bot.x, nextZ, 0.55, this.worldBuilds)) bot.z = nextZ;
                isMoving = true;
            }

            // Confinamento na ilha
            const curDist = Math.hypot(bot.x, bot.z);
            if (curDist > 85.0) {
                bot.x = (bot.x / curDist) * 85.0;
                bot.z = (bot.z / curDist) * 85.0;
            }

            bot.y = getGroundHeight(bot.x, bot.z);

            this.broadcast({
                type: 'player_moved',
                id: bot.id,
                x: bot.x,
                y: bot.y,
                z: bot.z,
                yaw: bot.yaw,
                isGliding: false,
                isMoving: isMoving
            });
        });
    }

    handleGrenadeExplosion(sender, data) {
        const { grenadeType, x, y, z } = data;

        if (grenadeType === 'he') {
            // Granada Explosiva causa dano em área (raio 7.5m)
            const blastRadius = 7.5;
            this.broadcast({
                type: 'grenade_exploded',
                grenadeType: 'he',
                x: x,
                y: y,
                z: z,
                radius: blastRadius
            });

            this.players.forEach(target => {
                if (!target.isAlive || target.team === sender.team) return;
                const dist = Math.hypot(target.x - x, target.z - z);
                if (dist <= blastRadius) {
                    if (isLineOfSightBlockedInRoom(x, z, target.x, target.z, this.worldBuilds)) {
                        return; // Protegido por parede
                    }
                    const factor = 1.0 - (dist / blastRadius);
                    const dmg = Math.max(15, Math.floor(95 * factor));

                    let remainingDmg = dmg;
                    if (target.shield > 0) {
                        const sDmg = Math.min(target.shield, remainingDmg);
                        target.shield -= sDmg;
                        remainingDmg -= sDmg;
                    }
                    if (remainingDmg > 0) {
                        target.hp = Math.max(0, target.hp - remainingDmg);
                    }

                    this.broadcast({
                        type: 'player_damaged',
                        targetId: target.id,
                        attackerId: sender.id,
                        attackerName: sender.name,
                        attackerTeam: sender.team,
                        targetName: target.name,
                        targetTeam: target.team,
                        shield: target.shield,
                        hp: target.hp,
                        damage: dmg,
                        isHeadshot: false,
                        weapon: 'grenade_he'
                    });

                    if (target.hp <= 0) {
                        target.hp = 0;
                        target.shield = 0;
                        target.isAlive = false;
                        target.deaths = (target.deaths || 0) + 1;
                        sender.kills++;

                        if (sender.team === 'blue') this.teamScores.blue++;
                        else if (sender.team === 'red') this.teamScores.red++;

                        let winningTeam = null;
                        if (this.teamScores.blue >= this.targetKills) winningTeam = 'blue';
                        if (this.teamScores.red >= this.targetKills) winningTeam = 'red';

                        this.broadcast({
                            type: 'player_eliminated',
                            victimId: target.id,
                            victimName: target.name,
                            victimTeam: target.team,
                            killerId: sender.id,
                            killerName: sender.name,
                            killerTeam: sender.team,
                            killerKills: sender.kills,
                            weapon: 'grenade_he',
                            aliveCount: this.getAliveCount(),
                            teamScores: this.teamScores,
                            winningTeam: winningTeam
                        });

                        this.broadcast({
                            type: 'score_update',
                            teamScores: this.teamScores,
                            players: this.getPlayerList()
                        });

                        if (winningTeam && !this.isRoundResetting) {
                            this.resetRound('score', winningTeam);
                        }

                        if (target.isBot) {
                            const tState = this.botStates.get(target.id);
                            if (tState) tState.respawnTime = Date.now() + 4500;
                        }
                    }
                }
            });
        } else if (grenadeType === 'flash') {
            // Granada de Luz (0 dano, efeito de cegueira flashbang)
            this.broadcast({
                type: 'grenade_exploded',
                grenadeType: 'flash',
                x: x,
                y: y,
                z: z,
                radius: 35.0
            });
        } else if (grenadeType === 'smoke') {
            // Granada de Fumaça (0 dano, cortina volumétrica de fumaça por 15 segundos)
            this.broadcast({
                type: 'grenade_exploded',
                grenadeType: 'smoke',
                x: x,
                y: y,
                z: z,
                duration: 15
            });
        }
    }
}

// ==========================================
// GERENCIADOR DE SALAS (ROOM MANAGER)
// ==========================================
const rooms = new Map();

// Inicializa salas padrões permanentes com os cenários temáticos
rooms.set('room_oficial', new GameRoom('room_oficial', 'Ilha Oficial (Bernardonite)', { botCount: 6, targetKills: 25, map: 'island', isDefault: true }));
rooms.set('room_chernobyl', new GameRoom('room_chernobyl', 'Chernobyl Radioativo (10 Bots)', { botCount: 10, targetKills: 25, map: 'chernobyl', isDefault: true }));
rooms.set('room_espacial', new GameRoom('room_espacial', 'Estação Espacial Orbital (8 Bots)', { botCount: 8, targetKills: 25, map: 'space_station', isDefault: true }));
rooms.set('room_caos', new GameRoom('room_caos', 'Guerra Total em Chernobyl (16 Bots)', { botCount: 16, targetKills: 35, map: 'chernobyl', isDefault: true }));
rooms.set('room_x1', new GameRoom('room_x1', 'Duelo X1 na Estação Espacial', { botCount: 0, targetKills: 15, map: 'space_station', isDefault: true }));

function getRoomList() {
    const list = [];
    rooms.forEach(r => list.push(r.getDetails()));
    return list;
}

function broadcastRoomListToLobby() {
    const data = JSON.stringify({
        type: 'room_list',
        version: SERVER_BUILD_VERSION,
        rooms: getRoomList()
    });
    for (const client of wss.clients) {
        if (client.readyState === 1 && !client.currentRoomId) {
            client.send(data);
        }
    }
}

// Loop contínuo das salas (bots, tempestade/gás)
setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, roomId) => {
        const dt = Math.min((now - room.lastBotTick) / 1000, 0.2);
        room.lastBotTick = now;

        room.updateStorm(dt, now);
        room.updateBots(dt, now);

        // Limpeza de salas personalizadas vazias após 10 minutos
        if (!room.isDefault && room.getHumanPlayerCount() === 0 && now - room.createdAt > 600000) {
            rooms.delete(roomId);
            broadcastRoomListToLobby();
        }
    });
}, 100);

// ==========================================
// CONEXÃO WEBSOCKET DO CLIENTE
// ==========================================
wss.on('connection', (ws) => {
    const playerId = 'P' + (nextPlayerCounter++);
    let currentRoom = null;
    let myPlayer = null;

    // Envia imediatamente a lista de salas disponíveis e versão
    ws.send(JSON.stringify({
        type: 'room_list',
        version: SERVER_BUILD_VERSION,
        rooms: getRoomList()
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // ==========================================
            // LISTA DE SALAS
            // ==========================================
            if (data.type === 'get_rooms') {
                ws.send(JSON.stringify({
                    type: 'room_list',
                    rooms: getRoomList()
                }));
            }

            // ==========================================
            // CRIAR NOVA SALA PERSONALIZADA
            // ==========================================
            if (data.type === 'create_room') {
                const cleanName = (data.name || 'Nova Sala').trim().substring(0, 24);
                const roomId = 'room_' + Date.now() + Math.random().toString(36).substr(2, 4);
                const botCount = Math.max(0, Math.min(16, parseInt(data.botCount, 10) || 6));
                const targetKills = Math.max(5, Math.min(100, parseInt(data.targetKills, 10) || 25));

                const validMaps = ['island', 'chernobyl', 'space_station'];
                let chosenMap = data.map || 'island';
                if (chosenMap === 'random') {
                    chosenMap = validMaps[Math.floor(Math.random() * validMaps.length)];
                } else if (!validMaps.includes(chosenMap)) {
                    chosenMap = 'island';
                }

                const newRoom = new GameRoom(roomId, cleanName, {
                    botCount: botCount,
                    targetKills: targetKills,
                    map: chosenMap,
                    isDefault: false
                });
                rooms.set(roomId, newRoom);

                console.log(`🏠 [SALA CRIADA] "${cleanName}" (${roomId}) | Mapa: ${chosenMap} | Bots: ${botCount} | Meta: ${targetKills}`);

                ws.send(JSON.stringify({
                    type: 'room_created',
                    roomId: roomId,
                    room: newRoom.getDetails()
                }));

                broadcastRoomListToLobby();
            }

            // ==========================================
            // SAIR DA PARTIDA / VOLTAR AO LOBBY
            // ==========================================
            if (data.type === 'leave_room') {
                if (currentRoom && myPlayer) {
                    currentRoom.players.delete(playerId);
                    currentRoom.broadcast({
                        type: 'player_left',
                        id: playerId,
                        name: myPlayer.name,
                        aliveCount: currentRoom.getAliveCount(),
                        teamScores: currentRoom.teamScores,
                        players: currentRoom.getPlayerList()
                    });
                    console.log(`[-] ${myPlayer.name} saiu da sala "${currentRoom.name}" e voltou ao Lobby.`);
                    currentRoom = null;
                    myPlayer = null;
                    ws.currentRoomId = null;
                    broadcastRoomListToLobby();
                    ws.send(JSON.stringify({
                        type: 'left_room_success'
                    }));
                }
            }

            // ==========================================
            // ENTRAR EM UMA SALA (JOIN / JOIN_ROOM)
            // ==========================================
            if (data.type === 'join' || data.type === 'join_room') {
                const targetRoomId = data.roomId || 'room_oficial';
                let room = rooms.get(targetRoomId);
                if (!room) {
                    room = rooms.get('room_oficial') || rooms.values().next().value;
                }

                // Se o player já estava em outra sala, remove da anterior
                if (currentRoom && currentRoom !== room) {
                    currentRoom.players.delete(playerId);
                    currentRoom.broadcast({
                        type: 'player_left',
                        id: playerId,
                        name: myPlayer ? myPlayer.name : 'Gamer',
                        aliveCount: currentRoom.getAliveCount(),
                        teamScores: currentRoom.teamScores,
                        players: currentRoom.getPlayerList()
                    });
                }

                currentRoom = room;
                ws.currentRoomId = room.id;

                const team = (data.team === 'red') ? 'red' : 'blue';
                const defaultColor = (team === 'red') ? '#dc2626' : '#2563eb';
                const spawn = room.getGroundSpawnForTeam(team);

                myPlayer = {
                    id: playerId,
                    ws: ws,
                    name: (data.name || 'Gamer').substring(0, 15),
                    team: team,
                    skinColor: data.skinColor || defaultColor,
                    x: spawn.x,
                    y: spawn.y,
                    z: spawn.z,
                    yaw: team === 'red' ? Math.PI : 0,
                    hp: 100,
                    shield: 100,
                    kills: 0,
                    deaths: 0,
                    isGliding: false,
                    isAlive: true
                };

                room.players.set(playerId, myPlayer);

                ws.send(JSON.stringify({
                    type: 'welcome',
                    version: SERVER_BUILD_VERSION,
                    id: playerId,
                    roomId: room.id,
                    roomName: room.name,
                    map: room.map || 'island',
                    player: {
                        id: myPlayer.id,
                        name: myPlayer.name,
                        team: myPlayer.team,
                        skinColor: myPlayer.skinColor,
                        x: myPlayer.x,
                        y: myPlayer.y,
                        z: myPlayer.z,
                        yaw: myPlayer.yaw,
                        hp: myPlayer.hp,
                        shield: myPlayer.shield,
                        kills: myPlayer.kills,
                        deaths: myPlayer.deaths,
                        isGliding: myPlayer.isGliding,
                        isAlive: myPlayer.isAlive
                    },
                    players: room.getPlayerList(),
                    builds: room.worldBuilds,
                    aliveCount: room.getAliveCount(),
                    teamScores: room.teamScores,
                    targetKills: room.targetKills,
                    stormRadius: room.stormState.radius,
                    stormX: room.stormState.x,
                    stormZ: room.stormState.z,
                    botCount: room.targetBotCount
                }));

                room.broadcast({
                    type: 'player_joined',
                    player: {
                        id: myPlayer.id,
                        name: myPlayer.name,
                        team: myPlayer.team,
                        skinColor: myPlayer.skinColor,
                        x: myPlayer.x,
                        y: myPlayer.y,
                        z: myPlayer.z,
                        yaw: myPlayer.yaw,
                        hp: myPlayer.hp,
                        shield: myPlayer.shield,
                        kills: myPlayer.kills,
                        deaths: myPlayer.deaths,
                        isGliding: myPlayer.isGliding,
                        isAlive: myPlayer.isAlive
                    },
                    aliveCount: room.getAliveCount(),
                    teamScores: room.teamScores
                }, ws);

                console.log(`[+] ${myPlayer.name} entrou na sala "${room.name}" [${myPlayer.team.toUpperCase()}] (${playerId})`);
                broadcastRoomListToLobby();
            }

            if (!currentRoom || !myPlayer) return;

            // ==========================================
            // AJUSTE DE BOTS NA SALA ATUAL
            // ==========================================
            if (data.type === 'set_bot_count') {
                currentRoom.setBotCount(data.count);
            }

            // ==========================================
            // MOVIMENTO
            // ==========================================
            if (data.type === 'move') {
                myPlayer.x = data.x;
                myPlayer.y = data.y;
                myPlayer.z = data.z;
                myPlayer.yaw = data.yaw;
                myPlayer.isGliding = data.isGliding;
                myPlayer.isMoving = data.isMoving;

                currentRoom.broadcast({
                    type: 'player_moved',
                    id: playerId,
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    yaw: data.yaw,
                    isGliding: data.isGliding,
                    isMoving: data.isMoving
                }, ws);
            }

            // ==========================================
            // DISPAROS DE ARMAS
            // ==========================================
            if (data.type === 'fire') {
                if (!myPlayer.isAlive) return;
                currentRoom.broadcast({
                    type: 'player_fired',
                    id: playerId,
                    weapon: data.weapon || 'scar',
                    origin: data.origin,
                    target: data.target,
                    pellets: data.pellets || null
                }, ws);
            }

            // ==========================================
            // GRANADAS (EXPLOSIVA, LUZ, FUMAÇA)
            // ==========================================
            if (data.type === 'grenade_thrown') {
                if (!myPlayer.isAlive) return;
                currentRoom.broadcast({
                    type: 'grenade_thrown',
                    id: data.id || ('G' + Date.now()),
                    throwerId: playerId,
                    throwerName: myPlayer.name,
                    grenadeType: data.grenadeType || 'he',
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    vx: data.vx,
                    vy: data.vy,
                    vz: data.vz
                }, ws);
            }

            if (data.type === 'grenade_exploded') {
                currentRoom.handleGrenadeExplosion(myPlayer, data);
            }

            // ==========================================
            // EXPLOSÃO RPG
            // ==========================================
            if (data.type === 'explosion') {
                if (!myPlayer.isAlive) return;
                currentRoom.broadcast({
                    type: 'explosion_occurred',
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    radius: data.radius || 6.5,
                    attackerId: playerId,
                    attackerName: myPlayer.name
                });
            }

            // ==========================================
            // DANO POR PERIGOS AMBIENTAIS (RADIAÇÃO / CHERNOBYL)
            // ==========================================
            if (data.type === 'hazard_damage') {
                if (!myPlayer.isAlive) return;
                const dmg = data.damage || 5;
                if (myPlayer.shield > 0) {
                    const sDmg = Math.min(myPlayer.shield, dmg);
                    myPlayer.shield -= sDmg;
                } else {
                    myPlayer.hp = Math.max(0, myPlayer.hp - dmg);
                }

                currentRoom.broadcast({
                    type: 'player_damaged',
                    targetId: myPlayer.id,
                    attackerId: 'RADIAÇÃO',
                    attackerName: 'Poça Radioativa',
                    attackerTeam: 'chernobyl',
                    targetName: myPlayer.name,
                    targetTeam: myPlayer.team,
                    shield: myPlayer.shield,
                    hp: myPlayer.hp,
                    damage: dmg,
                    isHeadshot: false,
                    weapon: 'radiation'
                });

                if (myPlayer.hp <= 0) {
                    myPlayer.hp = 0;
                    myPlayer.shield = 0;
                    myPlayer.isAlive = false;
                    myPlayer.deaths = (myPlayer.deaths || 0) + 1;

                    currentRoom.broadcast({
                        type: 'player_eliminated',
                        victimId: myPlayer.id,
                        victimName: myPlayer.name,
                        victimTeam: myPlayer.team,
                        killerId: 'RADIAÇÃO',
                        killerName: 'Poça Radioativa',
                        killerTeam: 'chernobyl',
                        weapon: 'radiation',
                        aliveCount: currentRoom.getAliveCount(),
                        teamScores: currentRoom.teamScores
                    });
                }
            }

            // ==========================================
            // DANO E COMBATE (PAREDES BLOQUEIAM TIROS)
            // ==========================================
            if (data.type === 'hit') {
                if (!myPlayer.isAlive) return;

                const target = currentRoom.players.get(data.targetId);
                if (!target || !target.isAlive || target.hp <= 0) return;
                if (target.team === myPlayer.team) return; // Sem fogo amigo

                // NADA ATRAVESSA PAREDE: validação de linha de visão
                if (isLineOfSightBlockedInRoom(myPlayer.x, myPlayer.z, target.x, target.z, currentRoom.worldBuilds)) {
                    return;
                }

                let dmg = data.damage || 35;
                let isHeadshot = !!data.isHeadshot;

                if (target.shield > 0) {
                    const sDmg = Math.min(target.shield, dmg);
                    target.shield -= sDmg;
                    dmg -= sDmg;
                }
                if (dmg > 0) {
                    target.hp = Math.max(0, target.hp - dmg);
                }

                currentRoom.broadcast({
                    type: 'player_damaged',
                    targetId: target.id,
                    attackerId: playerId,
                    attackerName: myPlayer.name,
                    attackerTeam: myPlayer.team,
                    targetName: target.name,
                    targetTeam: target.team,
                    shield: target.shield,
                    hp: target.hp,
                    damage: data.damage,
                    isHeadshot: isHeadshot,
                    weapon: data.weapon || 'scar'
                });

                if (target.hp <= 0) {
                    target.hp = 0;
                    target.shield = 0;
                    target.isAlive = false;
                    target.deaths = (target.deaths || 0) + 1;
                    myPlayer.kills++;

                    if (myPlayer.team === 'blue') currentRoom.teamScores.blue++;
                    else if (myPlayer.team === 'red') currentRoom.teamScores.red++;

                    let winningTeam = null;
                    if (currentRoom.teamScores.blue >= currentRoom.targetKills) winningTeam = 'blue';
                    if (currentRoom.teamScores.red >= currentRoom.targetKills) winningTeam = 'red';

                    currentRoom.broadcast({
                        type: 'player_eliminated',
                        victimId: target.id,
                        victimName: target.name,
                        victimTeam: target.team,
                        killerId: myPlayer.id,
                        killerName: myPlayer.name,
                        killerTeam: myPlayer.team,
                        killerKills: myPlayer.kills,
                        weapon: data.weapon || 'scar',
                        aliveCount: currentRoom.getAliveCount(),
                        teamScores: currentRoom.teamScores,
                        winningTeam: winningTeam
                    });

                    currentRoom.broadcast({
                        type: 'score_update',
                        teamScores: currentRoom.teamScores,
                        players: currentRoom.getPlayerList()
                    });

                    if (winningTeam && !currentRoom.isRoundResetting) {
                        currentRoom.resetRound('score', winningTeam);
                    }

                    if (target.isBot) {
                        const bState = currentRoom.botStates.get(target.id);
                        if (bState) bState.respawnTime = Date.now() + 4500;
                    }
                }
            }

            // ==========================================
            // RESPAWN SOLO
            // ==========================================
            if (data.type === 'respawn' || data.type === 'restart_user' || data.type === 'restart_round') {
                const spawn = currentRoom.getGroundSpawnForTeam(myPlayer.team);
                myPlayer.hp = 100;
                myPlayer.shield = 100;
                myPlayer.isAlive = true;
                myPlayer.x = spawn.x;
                myPlayer.y = spawn.y;
                myPlayer.z = spawn.z;
                myPlayer.isGliding = false;

                currentRoom.broadcast({
                    type: 'player_respawned',
                    id: playerId,
                    name: myPlayer.name,
                    team: myPlayer.team,
                    x: myPlayer.x,
                    y: myPlayer.y,
                    z: myPlayer.z,
                    hp: 100,
                    shield: 100,
                    isGliding: false,
                    aliveCount: currentRoom.getAliveCount(),
                    teamScores: currentRoom.teamScores
                });
            }

            // ==========================================
            // CONSTRUÇÃO
            // ==========================================
            if (data.type === 'build') {
                if (!myPlayer.isAlive) return;

                const newBuild = {
                    id: 'B' + Date.now() + Math.random().toString(36).substr(2, 4),
                    buildType: data.buildType,
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    rotY: data.rotY,
                    rotX: data.rotX,
                    ownerName: myPlayer.name,
                    ownerTeam: myPlayer.team
                };
                currentRoom.worldBuilds.push(newBuild);
                currentRoom.broadcast({
                    type: 'build_placed',
                    build: newBuild
                });
            }

        } catch (e) {
            console.error('Erro no processamento da mensagem:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && myPlayer) {
            currentRoom.players.delete(playerId);
            currentRoom.broadcast({
                type: 'player_left',
                id: playerId,
                name: myPlayer.name,
                aliveCount: currentRoom.getAliveCount(),
                teamScores: currentRoom.teamScores,
                players: currentRoom.getPlayerList()
            });
            console.log(`[-] ${myPlayer.name} saiu da sala "${currentRoom.name}". Vivos: ${currentRoom.getAliveCount()}/${currentRoom.players.size}`);
            broadcastRoomListToLobby();
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Servidor Bernardonite pronto na porta ${PORT} com Sistema de Salas e Granadas!`);
});
