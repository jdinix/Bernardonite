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

function getGroundSpawnForTeam(team) {
    if (team === 'red') {
        return {
            x: 48 + (Math.random() - 0.5) * 8,
            y: 0.8,
            z: 48 + (Math.random() - 0.5) * 8
        };
    } else {
        return {
            x: -48 + (Math.random() - 0.5) * 8,
            y: 0.8,
            z: -48 + (Math.random() - 0.5) * 8
        };
    }
}

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
                    targetKills: TARGET_TEAM_KILLS
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
// SISTEMA INTELIGENTE DE BOTS (IA COMBATE & TIMES)
// ==========================================
const BOTS_CONFIG = [
    { id: 'BOT_1', name: 'Bot João', team: 'blue', color: '#2563eb' },
    { id: 'BOT_2', name: 'Bot Carol', team: 'blue', color: '#3b82f6' },
    { id: 'BOT_3', name: 'Bot Sophia', team: 'blue', color: '#0284c7' },
    { id: 'BOT_4', name: 'Bot Diniz', team: 'red', color: '#dc2626' },
    { id: 'BOT_5', name: 'Bot Conrado', team: 'red', color: '#ef4444' },
    { id: 'BOT_6', name: 'Bot Joãoz', team: 'red', color: '#b91c1c' }
];

const botStates = new Map();

function initBots() {
    BOTS_CONFIG.forEach(cfg => {
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
    });
    console.log(`🤖 ${BOTS_CONFIG.length} Bots Inteligentes inicializados no mapa (3 Azul / 3 Vermelho)!`);
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

    BOTS_CONFIG.forEach(cfg => {
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
            // Rotaciona para mirar de frente para o adversário
            const dx = target.x - bot.x;
            const dz = target.z - bot.z;
            bot.yaw = Math.atan2(dx, dz) + Math.PI;

            // Se estiver a mais de 8 metros, avança em combate
            if (closestDist > 8.5) {
                const speed = 7.5;
                const dirX = Math.sin(bot.yaw - Math.PI);
                const dirZ = Math.cos(bot.yaw - Math.PI);
                bot.x += dirX * speed * dt;
                bot.z += dirZ * speed * dt;
                isMoving = true;
            } else if (closestDist < 5.0) {
                // Se estiver colado, recua estrategicamente
                const speed = 4.0;
                const dirX = Math.sin(bot.yaw);
                const dirZ = Math.cos(bot.yaw);
                bot.x += dirX * speed * dt;
                bot.z += dirZ * speed * dt;
                isMoving = true;
            }

            // Disparos táticos
            if (now > state.nextShootTime) {
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

                        // Se o alvo for outro bot, programa o respawn dele
                        if (target.isBot) {
                            const tState = botStates.get(target.id);
                            if (tState) tState.respawnTime = now + 4500;
                        }
                    }
                }
            }
        } else {
            // Patrulha pela ilha
            state.patrolAngle += 0.5 * dt;
            const targetX = Math.cos(state.patrolAngle) * state.patrolRadius;
            const targetZ = Math.sin(state.patrolAngle) * state.patrolRadius;

            const dx = targetX - bot.x;
            const dz = targetZ - bot.z;
            const dist = Math.hypot(dx, dz);

            if (dist > 2.0) {
                bot.yaw = Math.atan2(dx, dz) + Math.PI;
                const speed = 5.2;
                bot.x += (dx / dist) * speed * dt;
                bot.z += (dz / dist) * speed * dt;
                isMoving = true;
            }
        }

        // Confinamento na ilha
        const curDist = Math.hypot(bot.x, bot.z);
        if (curDist > 58.0) {
            bot.x = (bot.x / curDist) * 58.0;
            bot.z = (bot.z / curDist) * 58.0;
        }

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
    console.log(`🎮 Servidor Fortnite Battle Royale pronto na porta ${PORT}`);
});
