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
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
        };

        if (req.method === 'HEAD') {
            res.writeHead(200, headers);
            return res.end();
        }

        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    });
});

const wss = new WebSocketServer({ server });

let nextPlayerId = 1;
const players = new Map(); // id => player object
const worldBuilds = [];
const teamScores = { blue: 0, red: 0 };
const TARGET_TEAM_KILLS = 25; // Meta de kills para vitória da rodada de times

function broadcast(msg, excludeWs = null) {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
        if (client !== excludeWs && client.readyState === 1) {
            client.send(data);
        }
    }
}

function getAliveCount() {
    let count = 0;
    players.forEach(p => {
        if (p.isAlive) count++;
    });
    return count;
}

function getPlayerList() {
    const list = [];
    players.forEach(p => {
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
            isAlive: p.isAlive
        });
    });
    return list;
}

// Cálculo exato de elevação do terreno (idêntico ao cliente para evitar clipping)
function getGroundHeight(x, z) {
    const dist = Math.hypot(x, z);
    let y = Math.sin(x * 0.045) * Math.cos(z * 0.045) * 5.0 + Math.cos(x * 0.02) * 2.5;
    if (dist > 95) y -= (dist - 95) * 0.6;
    return Math.max(y, -2.8);
}

// Spawns táticos espalhados por cada lado da ilha
const BLUE_SPAWNS = [
    { x: -50, z: -50 }, // Base Principal Azul
    { x: -42, z: -18 }, // Colina Oeste
    { x: -55, z: 12 },  // Bosque Noroeste
    { x: -18, z: -48 }, // Encosta Sul
    { x: -32, z: 32 },  // Platô Superior
    { x: -26, z: -24 }  // Posto Avançado
];

const RED_SPAWNS = [
    { x: 50, z: 50 },   // Base Principal Vermelha
    { x: 42, z: 18 },   // Colina Leste
    { x: 55, z: -12 },  // Bosque Sudeste
    { x: 18, z: 48 },   // Encosta Norte
    { x: 32, z: -32 },  // Platô Superior
    { x: 26, z: 24 }    // Posto Avançado
];

let blueSpawnIdx = 0;
let redSpawnIdx = 0;

function getGroundSpawnForTeam(team) {
    let pt;
    if (team === 'red') {
        pt = RED_SPAWNS[redSpawnIdx % RED_SPAWNS.length];
        redSpawnIdx++;
    } else {
        pt = BLUE_SPAWNS[blueSpawnIdx % BLUE_SPAWNS.length];
        blueSpawnIdx++;
    }
    const x = pt.x + (Math.random() - 0.5) * 6;
    const z = pt.z + (Math.random() - 0.5) * 6;
    const y = getGroundHeight(x, z);
    return { x, y, z };
}

// ==========================================
// LABIRINTO & COLISÕES FÍSICAS NO SERVIDOR (PAREDES IMPENETRÁVEIS)
// ==========================================
const MAZE_GRID = [
    [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0], // Portões Leste e Oeste
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1]  // Portões Norte e Sul
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

function checkWallCollision(x, z, radius = 0.55) {
    // 1. Paredes do Labirinto
    for (let i = 0; i < mazeColliders.length; i++) {
        const b = mazeColliders[i];
        if (x + radius > b.minX && x - radius < b.maxX &&
            z + radius > b.minZ && z - radius < b.maxZ) {
            return true;
        }
    }
    // 2. Paredes e estruturas construídas por jogadores
    for (let i = 0; i < worldBuilds.length; i++) {
        const b = worldBuilds[i];
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

// Linha de visão para impedir tiros através de paredes
function isLineOfSightBlocked(x1, z1, x2, z2) {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    if (dist < 0.5) return false;
    const steps = Math.ceil(dist / 0.75);
    const dx = (x2 - x1) / steps;
    const dz = (z2 - z1) / steps;
    for (let s = 1; s < steps; s++) {
        const testX = x1 + dx * s;
        const testZ = z1 + dz * s;
        if (checkWallCollision(testX, testZ, 0.32)) {
            return true;
        }
    }
    return false;
}

// ==========================================
// SISTEMA DE TEMPESTADE / GÁS TÓXICO (ESFUMAÇADO & MÓVEL)
// ==========================================
function createNewStormState() {
    return {
        x: 0,
        z: 0,
        targetX: (Math.random() - 0.5) * 55, // Centro aleatório da zona segura na ilha
        targetZ: (Math.random() - 0.5) * 55,
        radius: 135, // Começa fora do mapa (fora dos limites da ilha)
        minRadius: 8,
        shrinkSpeed: 0.35, // encolhe ~0.35m por segundo
        lastUpdate: Date.now(),
        lastDmgTick: Date.now()
    };
}

let stormState = createNewStormState();

let isRoundResetting = false;

function resetRound(winningTeam) {
    if (isRoundResetting) return;
    isRoundResetting = true;
    console.log(`🏆 [FIM DE RODADA] Time ${winningTeam.toUpperCase()} alcançou 25 eliminações! Reiniciando ilha em 5 segundos...`);

    broadcast({
        type: 'round_ended',
        winningTeam: winningTeam,
        blueScore: teamScores.blue,
        redScore: teamScores.red,
        countdown: 5
    });

    setTimeout(() => {
        teamScores.blue = 0;
        teamScores.red = 0;
        worldBuilds.length = 0;
        stormState = createNewStormState();

        players.forEach(p => {
            const spawn = getGroundSpawnForTeam(p.team);
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

        isRoundResetting = false;
        console.log(`🔥 [NOVA RODADA] Ilha, construções, tempestade e placares totalmente reiniciados!`);

        broadcast({
            type: 'round_restarted',
            teamScores: teamScores,
            stormRadius: stormState.radius,
            stormX: stormState.x,
            stormZ: stormState.z,
            builds: [],
            players: getPlayerList()
        });
    }, 5000);
}

function updateStorm() {
    if (isRoundResetting) return;
    const now = Date.now();
    const dt = Math.min((now - stormState.lastUpdate) / 1000, 1.0);
    stormState.lastUpdate = now;

    // Encolhe a tempestade e desloca centro para posição alvo aleatória
    if (players.size > 0 && stormState.radius > stormState.minRadius) {
        stormState.radius = Math.max(stormState.minRadius, stormState.radius - stormState.shrinkSpeed * dt);
        const progress = Math.min(1.0, (135 - stormState.radius) / (135 - stormState.minRadius));
        stormState.x = stormState.targetX * progress;
        stormState.z = stormState.targetZ * progress;
    }

    // Broadcast periódico do raio e centro da tempestade
    broadcast({
        type: 'storm_update',
        radius: stormState.radius,
        x: stormState.x,
        z: stormState.z
    });

    // Dano de gás tóxico a cada 1 segundo em quem estiver fora do raio seguro
    if (now - stormState.lastDmgTick >= 1000) {
        stormState.lastDmgTick = now;
        const stormDamage = Math.max(5, Math.floor(14 - (stormState.radius / 10)));

        players.forEach(p => {
            if (!p.isAlive) return;
            const dist = Math.hypot(p.x - stormState.x, p.z - stormState.z);
            if (dist > stormState.radius) {
                // Dano direto na vida pelo gás tóxico
                p.hp = Math.max(0, p.hp - stormDamage);

                broadcast({
                    type: 'player_damaged',
                    targetId: p.id,
                    attackerId: 'STORM',
                    attackerName: 'Gás Tóxico',
                    attackerTeam: 'storm',
                    targetName: p.name,
                    targetTeam: p.team,
                    shield: p.shield,
                    hp: p.hp,
                    damage: stormDamage,
                    isHeadshot: false,
                    weapon: 'gas'
                });

                if (p.hp <= 0) {
                    p.hp = 0;
                    p.shield = 0;
                    p.isAlive = false;
                    p.deaths = (p.deaths || 0) + 1;

                    console.log(`☠️ [GÁS TÓXICO] ${p.name} [${p.team}] sucumbiu ao gás tóxico!`);

                    broadcast({
                        type: 'player_eliminated',
                        victimId: p.id,
                        victimName: p.name,
                        victimTeam: p.team,
                        killerId: 'STORM',
                        killerName: 'Gás Tóxico / Tempestade',
                        killerTeam: 'storm',
                        killerKills: 0,
                        weapon: 'gas',
                        aliveCount: getAliveCount(),
                        teamScores: teamScores,
                        winningTeam: null
                    });

                    broadcast({
                        type: 'score_update',
                        teamScores: teamScores,
                        players: getPlayerList()
                    });

                    if (p.isBot) {
                        const bState = botStates.get(p.id);
                        if (bState) bState.respawnTime = now + 4500;
                    }
                }
            }
        });
    }
}
setInterval(updateStorm, 500);

wss.on('connection', (ws) => {
    const playerId = 'P' + (nextPlayerId++);
    let myPlayer = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // ==========================================
            // ENTRADA DO JOGADOR NO SERVIDOR
            // ==========================================
            if (data.type === 'join') {
                const team = (data.team === 'red') ? 'red' : 'blue';
                const defaultColor = (team === 'red') ? '#dc2626' : '#2563eb';
                const spawn = getGroundSpawnForTeam(team);

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
                    isGliding: false, // COMEÇA DIRETO DO CHÃO!
                    isAlive: true
                };
                players.set(playerId, myPlayer);

                // Envia lista completa de jogadores e estado de jogo
                ws.send(JSON.stringify({
                    type: 'welcome',
                    id: playerId,
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
                    players: getPlayerList(),
                    builds: worldBuilds,
                    aliveCount: getAliveCount(),
                    teamScores: teamScores,
                    targetKills: TARGET_TEAM_KILLS,
                    stormRadius: stormState.radius,
                    stormX: stormState.x,
                    stormZ: stormState.z,
                    botCount: targetBotCount
                }));

                // Avisa todos os outros
                broadcast({
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
                    aliveCount: getAliveCount(),
                    teamScores: teamScores
                }, ws);

                console.log(`[+] ${myPlayer.name} entrou no Time [${myPlayer.team.toUpperCase()}] (${playerId}) | Vivos: ${getAliveCount()}/${players.size}`);
            }

            if (!myPlayer) return;

            // ==========================================
            // AJUSTE DINÂMICO DA QUANTIDADE DE BOTS
            // ==========================================
            if (data.type === 'set_bot_count') {
                setBotCount(data.count);
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

                broadcast({
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
            // DISPARO DE ARMAS
            // ==========================================
            if (data.type === 'fire') {
                if (!myPlayer.isAlive) return;

                broadcast({
                    type: 'player_fired',
                    id: playerId,
                    weapon: data.weapon || 'scar',
                    origin: data.origin,
                    target: data.target,
                    pellets: data.pellets || null
                }, ws);
            }

            // ==========================================
            // EXPLOSÃO (RPG / FOGUETE)
            // ==========================================
            if (data.type === 'explosion') {
                if (!myPlayer.isAlive) return;

                broadcast({
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
            // DANO E COMBATE COM FOGO AMIGO DESATIVADO
            // ==========================================
            if (data.type === 'hit') {
                if (!myPlayer.isAlive) return;

                const target = players.get(data.targetId);

                // Não toma dano se não existe, já está morto ou FOGO AMIGO (mesmo time)
                if (!target || !target.isAlive || target.hp <= 0) return;
                if (target.team === myPlayer.team) {
                    // Mesmo time: sem fogo amigo!
                    return;
                }

                // TIRO NÃO ATRAVESSA PAREDES (NADA ATRAVESSA PAREDE!)
                if (isLineOfSightBlocked(myPlayer.x, myPlayer.z, target.x, target.z)) {
                    return;
                }

                let dmg = data.damage || 35;
                let isHeadshot = !!data.isHeadshot;

                if (target.shield > 0) {
                    const shieldDmg = Math.min(target.shield, dmg);
                    target.shield -= shieldDmg;
                    dmg -= shieldDmg;
                }
                if (dmg > 0) {
                    target.hp = Math.max(0, target.hp - dmg);
                }

                console.log(`[HIT] ${myPlayer.name} [${myPlayer.team}] -> ${target.name} [${target.team}] (-${data.damage}) | HP: ${target.hp}, Shield: ${target.shield}`);

                broadcast({
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

                // VERIFICA SE HOUVE ELIMINAÇÃO
                if (target.hp <= 0) {
                    target.hp = 0;
                    target.shield = 0;
                    target.isAlive = false;
                    target.deaths = (target.deaths || 0) + 1;
                    myPlayer.kills++;

                    // PONTUAÇÃO DO TIME
                    if (myPlayer.team === 'blue') {
                        teamScores.blue++;
                    } else if (myPlayer.team === 'red') {
                        teamScores.red++;
                    }

                    const remainingAlive = getAliveCount();
                    console.log(`[ELIMINAÇÃO] ${myPlayer.name} [${myPlayer.team}] ELIMINOU ${target.name} [${target.team}]! Placar: Azul ${teamScores.blue} x ${teamScores.red} Vermelho`);

                    let winningTeam = null;
                    if (teamScores.blue >= TARGET_TEAM_KILLS) winningTeam = 'blue';
                    if (teamScores.red >= TARGET_TEAM_KILLS) winningTeam = 'red';

                    broadcast({
                        type: 'player_eliminated',
                        victimId: target.id,
                        victimName: target.name,
                        victimTeam: target.team,
                        killerId: myPlayer.id,
                        killerName: myPlayer.name,
                        killerTeam: myPlayer.team,
                        killerKills: myPlayer.kills,
                        weapon: data.weapon || 'scar',
                        aliveCount: remainingAlive,
                        teamScores: teamScores,
                        winningTeam: winningTeam
                    });

                    broadcast({
                        type: 'score_update',
                        teamScores: teamScores,
                        players: getPlayerList()
                    });

                    // Se atingiu 25 vitórias, reinicia a rodada e a ilha
                    if (winningTeam && !isRoundResetting) {
                        resetRound(winningTeam);
                    }

                    // Se a vítima eliminada for um Bot, agenda seu respawn
                    if (target.isBot) {
                        const bState = botStates.get(target.id);
                        if (bState) {
                            bState.respawnTime = Date.now() + 4500;
                        }
                    }
                }
            }

            // ==========================================
            // REINICIAR / RESPAWN SOLO PARA O USUÁRIO (DO CHÃO)
            // ==========================================
            if (data.type === 'respawn' || data.type === 'restart_user' || data.type === 'restart_round') {
                const spawn = getGroundSpawnForTeam(myPlayer.team);
                myPlayer.hp = 100;
                myPlayer.shield = 100;
                myPlayer.isAlive = true;
                myPlayer.x = spawn.x;
                myPlayer.y = spawn.y;
                myPlayer.z = spawn.z;
                myPlayer.isGliding = false; // Começa do chão!

                console.log(`[RESPAWN SOLO CHÃO] ${myPlayer.name} [${myPlayer.team}] renasceu no chão. Vivos: ${getAliveCount()}/${players.size}`);

                broadcast({
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
                    aliveCount: getAliveCount(),
                    teamScores: teamScores
                });
            }

            // ==========================================
            // CONSTRUÇÃO SINCRONIZADA
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
                worldBuilds.push(newBuild);
                broadcast({
                    type: 'build_placed',
                    build: newBuild
                });
            }

        } catch (e) {
            console.error('Erro no processamento da mensagem:', e);
        }
    });

    ws.on('close', () => {
        if (myPlayer) {
            players.delete(playerId);
            broadcast({
                type: 'player_left',
                id: playerId,
                name: myPlayer.name,
                aliveCount: getAliveCount(),
                teamScores: teamScores,
                players: getPlayerList()
            });
            console.log(`[-] ${myPlayer.name} saiu. Vivos: ${getAliveCount()}/${players.size}`);
        }
    });
});

// ==========================================
// SISTEMA INTELIGENTE DE BOTS (POOL DINÂMICO & IA)
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

let targetBotCount = 6;
const activeBotsList = [];
const botStates = new Map();

function setBotCount(count) {
    targetBotCount = Math.max(0, Math.min(16, parseInt(count, 10) || 0));

    const blueCount = Math.ceil(targetBotCount / 2);
    const redCount = Math.floor(targetBotCount / 2);

    const needed = [];
    for (let i = 0; i < blueCount; i++) {
        needed.push(ALL_BOTS_POOL[i]);
    }
    for (let i = 0; i < redCount; i++) {
        needed.push(ALL_BOTS_POOL[8 + i]);
    }

    const neededIds = new Set(needed.map(b => b.id));

    // Remove bots excedentes
    for (let i = activeBotsList.length - 1; i >= 0; i--) {
        const b = activeBotsList[i];
        if (!neededIds.has(b.id)) {
            players.delete(b.id);
            botStates.delete(b.id);
            activeBotsList.splice(i, 1);
            broadcast({
                type: 'player_left',
                id: b.id,
                name: b.name,
                aliveCount: getAliveCount(),
                teamScores: teamScores,
                players: getPlayerList()
            });
        }
    }

    // Adiciona novos bots necessários
    const currentActiveIds = new Set(activeBotsList.map(b => b.id));
    needed.forEach(cfg => {
        if (!currentActiveIds.has(cfg.id)) {
            const spawn = getGroundSpawnForTeam(cfg.team);
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
            players.set(cfg.id, botPlayer);

            botStates.set(cfg.id, {
                respawnTime: 0,
                nextShootTime: Date.now() + 2000 + Math.random() * 2000,
                patrolAngle: Math.random() * Math.PI * 2,
                patrolRadius: 15 + Math.random() * 30
            });
            activeBotsList.push(cfg);

            broadcast({
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
                aliveCount: getAliveCount(),
                teamScores: teamScores
            });
        }
    });

    broadcast({
        type: 'bot_count_updated',
        count: targetBotCount,
        players: getPlayerList(),
        aliveCount: getAliveCount()
    });
    console.log(`🤖 Contagem de Bots atualizada para: ${targetBotCount} (Azul: ${blueCount}, Vermelho: ${redCount})`);
}

function initBots() {
    setBotCount(targetBotCount);
    console.log(`🤖 ${activeBotsList.length} Bots Inteligentes inicializados no mapa!`);
}

let lastBotTick = Date.now();

function updateBots() {
    const now = Date.now();
    const dt = Math.min((now - lastBotTick) / 1000, 0.2);
    lastBotTick = now;

    // Apenas processa lógica de combate de bots se houver pelo menos 1 jogador humano conectado
    let humanConnected = false;
    for (const p of players.values()) {
        if (!p.isBot) {
            humanConnected = true;
            break;
        }
    }
    if (!humanConnected) return;

    activeBotsList.forEach(cfg => {
        const bot = players.get(cfg.id);
        const state = botStates.get(cfg.id);
        if (!bot || !state) return;

        // Respawn automático do Bot após 4.5 segundos
        if (!bot.isAlive) {
            if (now > state.respawnTime && state.respawnTime > 0) {
                const spawn = getGroundSpawnForTeam(bot.team);
                bot.hp = 100;
                bot.shield = 100;
                bot.isAlive = true;
                bot.x = spawn.x;
                bot.y = spawn.y;
                bot.z = spawn.z;
                state.respawnTime = 0;

                broadcast({
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
                    aliveCount: getAliveCount(),
                    teamScores: teamScores
                });
            }
            return;
        }

        // Procura o inimigo mais próximo (humano ou bot adversário)
        let closestDist = 52.0;
        let target = null;

        for (const other of players.values()) {
            if (!other.isAlive || other.team === bot.team) continue;
            const dist = Math.hypot(other.x - bot.x, other.z - bot.z);
            if (dist < closestDist) {
                closestDist = dist;
                target = other;
            }
        }

        let isMoving = false;

        if (target) {
            // Verifica se a linha de visão está bloqueada por paredes
            const losBlocked = isLineOfSightBlocked(bot.x, bot.z, target.x, target.z);

            const dx = target.x - bot.x;
            const dz = target.z - bot.z;
            bot.yaw = Math.atan2(dx, dz) + Math.PI;

            // Movimento com COLISÃO COM PAREDES (NEM BOT ATRAVESSA PAREDE!)
            if (closestDist > 8.5) {
                const speed = 7.5;
                const dirX = Math.sin(bot.yaw - Math.PI);
                const dirZ = Math.cos(bot.yaw - Math.PI);
                const nextX = bot.x + dirX * speed * dt;
                const nextZ = bot.z + dirZ * speed * dt;
                if (!checkWallCollision(nextX, bot.z)) bot.x = nextX;
                if (!checkWallCollision(bot.x, nextZ)) bot.z = nextZ;
                isMoving = true;
            } else if (closestDist < 5.0) {
                const speed = 4.0;
                const dirX = Math.sin(bot.yaw);
                const dirZ = Math.cos(bot.yaw);
                const nextX = bot.x + dirX * speed * dt;
                const nextZ = bot.z + dirZ * speed * dt;
                if (!checkWallCollision(nextX, bot.z)) bot.x = nextX;
                if (!checkWallCollision(bot.x, nextZ)) bot.z = nextZ;
                isMoving = true;
            }

            // Disparos táticos APENAS se a linha de visão NÃO estiver bloqueada por parede!
            if (!losBlocked && now > state.nextShootTime) {
                state.nextShootTime = now + 1400 + Math.random() * 1200;

                const origin = { x: bot.x, y: bot.y + 1.4, z: bot.z };
                const targetPos = { x: target.x, y: target.y + 1.2, z: target.z };

                broadcast({
                    type: 'player_fired',
                    id: bot.id,
                    weapon: 'scar',
                    origin: origin,
                    target: targetPos
                });

                // Probabilidade justa de acerto (~45%)
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

                    broadcast({
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

                    // Eliminação
                    if (target.hp <= 0) {
                        target.hp = 0;
                        target.shield = 0;
                        target.isAlive = false;
                        target.deaths = (target.deaths || 0) + 1;
                        bot.kills++;

                        if (bot.team === 'blue') teamScores.blue++;
                        else if (bot.team === 'red') teamScores.red++;

                        let winningTeam = null;
                        if (teamScores.blue >= TARGET_TEAM_KILLS) winningTeam = 'blue';
                        if (teamScores.red >= TARGET_TEAM_KILLS) winningTeam = 'red';

                        broadcast({
                            type: 'player_eliminated',
                            victimId: target.id,
                            victimName: target.name,
                            victimTeam: target.team,
                            killerId: bot.id,
                            killerName: bot.name,
                            killerTeam: bot.team,
                            killerKills: bot.kills,
                            weapon: 'scar',
                            aliveCount: getAliveCount(),
                            teamScores: teamScores,
                            winningTeam: winningTeam
                        });

                        broadcast({
                            type: 'score_update',
                            teamScores: teamScores,
                            players: getPlayerList()
                        });

                        // Se atingiu 25 vitórias, reinicia a rodada e a ilha
                        if (winningTeam && !isRoundResetting) {
                            resetRound(winningTeam);
                        }

                        // Se o alvo for outro bot, programa o respawn dele
                        if (target.isBot) {
                            const tState = botStates.get(target.id);
                            if (tState) tState.respawnTime = now + 4500;
                        }
                    }
                }
            }
        } else {
            // Patrulha pela ilha com detecção de paredes
            state.patrolAngle += 0.5 * dt;
            const targetX = Math.cos(state.patrolAngle) * state.patrolRadius;
            const targetZ = Math.sin(state.patrolAngle) * state.patrolRadius;

            const dx = targetX - bot.x;
            const dz = targetZ - bot.z;
            const dist = Math.hypot(dx, dz);

            if (dist > 2.0) {
                bot.yaw = Math.atan2(dx, dz) + Math.PI;
                const speed = 5.2;
                const dirX = dx / dist;
                const dirZ = dz / dist;
                const nextX = bot.x + dirX * speed * dt;
                const nextZ = bot.z + dirZ * speed * dt;
                if (!checkWallCollision(nextX, bot.z)) bot.x = nextX;
                if (!checkWallCollision(bot.x, nextZ)) bot.z = nextZ;
                isMoving = true;
            }
        }

        // Fuga do gás tóxico: corre em direção ao centro seguro (stormState.x, stormState.z)
        const distToStormCenter = Math.hypot(bot.x - stormState.x, bot.z - stormState.z);
        if (distToStormCenter > Math.max(8.0, stormState.radius - 6.0)) {
            const angleToCenter = Math.atan2(stormState.x - bot.x, stormState.z - bot.z);
            bot.yaw = angleToCenter + Math.PI;
            const speed = 7.5;
            const dirX = Math.sin(angleToCenter);
            const dirZ = Math.cos(angleToCenter);
            const nextX = bot.x + dirX * speed * dt;
            const nextZ = bot.z + dirZ * speed * dt;
            if (!checkWallCollision(nextX, bot.z)) bot.x = nextX;
            if (!checkWallCollision(bot.x, nextZ)) bot.z = nextZ;
            isMoving = true;
        }

        // Confinamento nos limites da ilha
        const curDist = Math.hypot(bot.x, bot.z);
        if (curDist > 85.0) {
            bot.x = (bot.x / curDist) * 85.0;
            bot.z = (bot.z / curDist) * 85.0;
        }

        // ALTURA EXATA DO TERRENO: Garante que os bots NUNCA atravessem ou fiquem soterrados no chão!
        bot.y = getGroundHeight(bot.x, bot.z);

        // Notifica movimento do bot aos clientes
        broadcast({
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

setInterval(updateBots, 100);

initBots();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 Servidor Bernardonite pronto na porta ${PORT}`);
});
