/**
 * Bernardonite - Sistema Modular de Cenários e Gerador Procedural
 * Cenários suportados:
 * 1. 'island' (Ilha dos Campeões: Clássico, grama, árvores, labirinto de pedras e baú dourado)
 * 2. 'chernobyl' (Chernobyl: Pós-apocalíptico, reator nuclear, árvores mortas, névoa radioativa e poças ácidas de radiação com dano)
 * 3. 'space_station' (Estação Espacial Orbital: Complexo fechado tech, cúpula espacial com estrelas/planeta, reator quântico de plasma)
 * 4. 'random' (Gerador procedural que seleciona ou combina variações aleatórias)
 */

(function(window) {
    'use strict';

    const SCENARIOS = {
        island: {
            id: 'island',
            name: 'Ilha dos Campeões',
            badge: '🌴 Ilha dos Campeões',
            icon: 'palmtree',
            description: 'Ilha tropical com labirinto ancestral, baú dourado e névoa tóxica violeta.',
            skyColor: 0x7eb6e8,
            fogColor: 0x2e1065,
            fogDensity: 0.0035,
            lightAmbient: 0xddeeff,
            lightGround: 0x38271d,
            sunColor: 0xfff7e6,
            sunIntensity: 1.15,
            terrainTheme: 'grass',
            oceanTheme: 'water',
            gasColor: '#a855f7',
            gasSmokeHex: 0x8b5cf6,
            ambientSound: 'nature',
            gravityMultiplier: 1.0
        },
        chernobyl: {
            id: 'chernobyl',
            name: 'Chernobyl Radioativo',
            badge: '☢️ Chernobyl',
            icon: 'biohazard',
            description: 'Zona de exclusão pós-nuclear com reator destruído, torres e poças de radiação com dano.',
            skyColor: 0x263328,
            fogColor: 0x14532d,
            fogDensity: 0.0055,
            lightAmbient: 0xa7f3d0,
            lightGround: 0x1c1917,
            sunColor: 0xd97706,
            sunIntensity: 0.85,
            terrainTheme: 'fallout',
            oceanTheme: 'toxic_sludge',
            gasColor: '#22c55e',
            gasSmokeHex: 0x15803d,
            ambientSound: 'geiger',
            gravityMultiplier: 1.0
        },
        space_station: {
            id: 'space_station',
            name: 'Estação Espacial Orbital',
            badge: '🚀 Estação Espacial',
            icon: 'rocket',
            description: 'Base tecnológica fechada em órbita com cúpula estrelada, planeta gigante e reator quântico.',
            skyColor: 0x030712,
            fogColor: 0x0f172a,
            fogDensity: 0.0025,
            lightAmbient: 0x38bdf8,
            lightGround: 0x0284c7,
            sunColor: 0x93c5fd,
            sunIntensity: 1.3,
            terrainTheme: 'scifi_deck',
            oceanTheme: 'space_void',
            gasColor: '#ef4444',
            gasSmokeHex: 0xdc2626,
            ambientSound: 'hum',
            gravityMultiplier: 0.85 // Pulos levemente mais altos/leves
        }
    };

    class ScenarioManager {
        constructor() {
            this.currentScenarioId = 'island';
            this.currentConfig = SCENARIOS.island;
            this.scene = null;
            this.renderer = null;
            this.camera = null;

            // Grupo que armazena os elementos dinâmicos do cenário
            this.scenarioGroup = new THREE.Group();
            this.hazardObjects = []; // Poças de radiação, reatores quânticos, etc.
            this.animatedProps = []; // Objetos que giram ou pulsam
            this.spaceSkyboxGroup = null;

            this.lastRadiationTick = 0;
            this.audioCtx = null;
        }

        init(scene, renderer, camera) {
            this.scene = scene;
            this.renderer = renderer;
            this.camera = camera;
            this.scene.add(this.scenarioGroup);
        }

        getScenarioList() {
            return Object.values(SCENARIOS);
        }

        getConfig(scenarioId) {
            if (scenarioId === 'random') {
                const keys = ['island', 'chernobyl', 'space_station'];
                const picked = keys[Math.floor(Math.random() * keys.length)];
                return SCENARIOS[picked];
            }
            return SCENARIOS[scenarioId] || SCENARIOS.island;
        }

        clearCurrentScenario() {
            // Remove todos os objetos do grupo de cenários
            while (this.scenarioGroup.children.length > 0) {
                const child = this.scenarioGroup.children[0];
                this.scenarioGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
            this.hazardObjects = [];
            this.animatedProps = [];

            if (this.spaceSkyboxGroup && this.scene) {
                this.scene.remove(this.spaceSkyboxGroup);
                this.spaceSkyboxGroup = null;
            }
        }

        /**
         * Carrega e aplica um novo cenário na cena Three.js
         */
        loadScenario(scenarioId, worldTerrainMesh, oceanMesh, sunLight, hemiLight) {
            this.clearCurrentScenario();

            const config = this.getConfig(scenarioId);
            this.currentScenarioId = config.id;
            this.currentConfig = config;

            console.log(`🗺️ [CENÁRIO] Carregando mapa: ${config.name} (${config.id})`);

            // 1. Atualizar Atmosfera, Céu e Névoa (Fog)
            if (this.scene) {
                this.scene.background = new THREE.Color(config.skyColor);
                if (this.scene.fog) {
                    this.scene.fog.color.setHex(config.fogColor);
                    this.scene.fog.density = config.fogDensity;
                }
            }

            // 2. Atualizar Iluminação Global
            if (hemiLight) {
                hemiLight.color.setHex(config.lightAmbient);
                hemiLight.groundColor.setHex(config.lightGround);
            }
            if (sunLight) {
                sunLight.color.setHex(config.sunColor);
                sunLight.intensity = config.sunIntensity;
            }

            // 3. Atualizar Terreno e Água/Oceano
            this.applyTerrainThemes(worldTerrainMesh, oceanMesh, config);

            // 4. Gerar Props específicos do Cenário
            if (config.id === 'chernobyl') {
                this.buildChernobylDecorations();
            } else if (config.id === 'space_station') {
                this.buildSpaceStationDecorations();
            } else {
                this.buildIslandDecorations();
            }

            // Notifica toast do cenário
            if (typeof window.showToast === 'function') {
                window.showToast(`<i data-lucide="${config.icon}"></i> Cenário: <b>${config.name}</b>`);
            }
            if (typeof window.refreshIcons === 'function') {
                setTimeout(window.refreshIcons, 50);
            }

            return config;
        }

        applyTerrainThemes(terrainMesh, oceanMesh, config) {
            if (!terrainMesh) return;

            if (config.id === 'chernobyl') {
                // Terreno de terra calcinada, asfalto e lama radioativa
                const toxicMat = new THREE.MeshStandardMaterial({
                    color: 0x27272a,
                    roughness: 0.95,
                    metalness: 0.1
                });
                terrainMesh.material = toxicMat;

                if (oceanMesh) {
                    oceanMesh.material.color.setHex(0x14532d); // Lodo tóxico verde-musgo escuro
                    oceanMesh.material.roughness = 0.35;
                    oceanMesh.material.opacity = 0.95;
                }
            } else if (config.id === 'space_station') {
                // Deck de Titânio e placas metálicas
                const scifiMat = new THREE.MeshStandardMaterial({
                    color: 0x1e293b,
                    roughness: 0.4,
                    metalness: 0.85
                });
                terrainMesh.material = scifiMat;

                if (oceanMesh) {
                    oceanMesh.visible = false; // Sem oceano no espaço profundo
                }
            } else {
                // Clássico: Ilha verde com oceano azul
                if (window.grassTexture) {
                    terrainMesh.material = new THREE.MeshStandardMaterial({
                        map: window.grassTexture,
                        roughness: 0.85,
                        metalness: 0.05
                    });
                } else {
                    terrainMesh.material = new THREE.MeshStandardMaterial({
                        color: 0x15803d,
                        roughness: 0.85
                    });
                }
                if (oceanMesh) {
                    oceanMesh.visible = true;
                    oceanMesh.material.color.setHex(0x005b96);
                    oceanMesh.material.roughness = 0.15;
                    oceanMesh.material.opacity = 0.88;
                }
            }
        }

        // ==============================================================
        // CENÁRIO 1: ILHA DOS CAMPEÕES (DECORAÇÕES CLÁSSICAS)
        // ==============================================================
        buildIslandDecorations() {
            // Adiciona tochas e bandeiras extras na ilha
            const flagGeo = new THREE.BoxGeometry(0.1, 1.2, 0.8);
            const blueFlagMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 });
            const redFlagMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 });

            const flagB = new THREE.Mesh(flagGeo, blueFlagMat);
            flagB.position.set(-42, window.getGroundHeight(-42, -42) + 4.5, -42);
            const flagR = new THREE.Mesh(flagGeo, redFlagMat);
            flagR.position.set(42, window.getGroundHeight(42, 42) + 4.5, 42);

            this.scenarioGroup.add(flagB, flagR);
        }

        // ==============================================================
        // CENÁRIO 2: CHERNOBYL RADIOATIVO (POÇAS COM DANO + TORRES)
        // ==============================================================
        buildChernobylDecorations() {
            // 1. Torres de Resfriamento Hiperbólicas de Concreto Rachado
            const towerMat = new THREE.MeshStandardMaterial({
                color: 0x3f3f46,
                roughness: 0.9,
                metalness: 0.15
            });

            [-35, 35].forEach((tx, idx) => {
                const tz = idx === 0 ? 30 : -30;
                const ty = window.getGroundHeight(tx, tz);
                const coolingTower = new THREE.Group();
                coolingTower.position.set(tx, ty, tz);

                // Base cilíndrica larga
                const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(8, 11, 18, 16, 1, true), towerMat);
                baseMesh.position.y = 9;
                baseMesh.castShadow = true;
                baseMesh.receiveShadow = true;
                coolingTower.add(baseMesh);

                // Topo da chaminé
                const topRim = new THREE.Mesh(new THREE.TorusGeometry(8, 0.6, 8, 20), towerMat);
                topRim.rotation.x = Math.PI / 2;
                topRim.position.y = 18;
                coolingTower.add(topRim);

                // Luz interna de radiação esverdeada no fundo da torre
                const towerLight = new THREE.PointLight(0x22c55e, 4, 30);
                towerLight.position.y = 3;
                coolingTower.add(towerLight);

                this.scenarioGroup.add(coolingTower);
            });

            // 2. Reator Nuclear Danificado no Centro
            const reactorGroup = new THREE.Group();
            reactorGroup.position.set(0, window.getGroundHeight(0, 0), 0);

            const reactorDome = new THREE.Mesh(
                new THREE.CylinderGeometry(5.5, 6.2, 5.0, 14),
                new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.4 })
            );
            reactorDome.position.y = 2.5;
            reactorDome.castShadow = true;
            reactorGroup.add(reactorDome);

            // Tampa destruída com núcleo de grafite radioativo exposto
            const coreGlow = new THREE.Mesh(
                new THREE.CylinderGeometry(3.2, 3.2, 1.2, 12),
                new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1.8 })
            );
            coreGlow.position.y = 5.2;
            reactorGroup.add(coreGlow);

            const coreLight = new THREE.PointLight(0x4ade80, 5, 25);
            coreLight.position.y = 6.0;
            reactorGroup.add(coreLight);
            this.animatedProps.push({ obj: coreLight, type: 'pulse', speed: 2.2, base: 4, amp: 2 });

            this.scenarioGroup.add(reactorGroup);

            // 3. Poças de Radioatividade com Dano Contínuo (Hazard Pools)
            const radiationPoolsCoords = [
                { x: -16, z: -12, radius: 4.2 },
                { x: 18, z: 14, radius: 4.8 },
                { x: -24, z: 18, radius: 3.8 },
                { x: 22, z: -20, radius: 4.5 },
                { x: 0, z: -25, radius: 5.0 },
                { x: 0, z: 25, radius: 4.6 },
                { x: -32, z: -4, radius: 3.6 },
                { x: 28, z: 6, radius: 3.9 }
            ];

            const poolGeo = new THREE.CylinderGeometry(1, 1, 0.2, 20);
            const slimeMat = new THREE.MeshStandardMaterial({
                color: 0x16a34a,
                emissive: 0x22c55e,
                emissiveIntensity: 0.9,
                roughness: 0.1,
                metalness: 0.3,
                transparent: true,
                opacity: 0.92
            });

            radiationPoolsCoords.forEach((p, idx) => {
                const py = window.getGroundHeight(p.x, p.z) + 0.08;
                const poolMesh = new THREE.Mesh(poolGeo, slimeMat.clone());
                poolMesh.scale.set(p.radius, 1, p.radius);
                poolMesh.position.set(p.x, py, p.z);
                this.scenarioGroup.add(poolMesh);

                // Luz pontual verde que pulsa
                const poolLight = new THREE.PointLight(0x4ade80, 1.8, 12);
                poolLight.position.set(p.x, py + 0.8, p.z);
                this.scenarioGroup.add(poolLight);
                this.animatedProps.push({ obj: poolLight, type: 'pulse', speed: 1.8 + (idx * 0.3), base: 1.5, amp: 0.8 });

                // Registra como perigo de radiação
                this.hazardObjects.push({
                    type: 'radiation_pool',
                    x: p.x,
                    z: p.z,
                    radius: p.radius,
                    dps: 12 // 12 de dano por segundo ao pisar
                });

                // Barris de lixo tóxico nas margens da poça
                for (let b = 0; b < 3; b++) {
                    const bAngle = Math.random() * Math.PI * 2;
                    const bx = p.x + Math.cos(bAngle) * (p.radius + 1.2);
                    const bz = p.z + Math.sin(bAngle) * (p.radius + 1.2);
                    const by = window.getGroundHeight(bx, bz);

                    const barrel = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.42, 0.42, 1.1, 8),
                        new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.5, metalness: 0.6 })
                    );
                    barrel.position.set(bx, by + 0.55, bz);
                    if (Math.random() > 0.4) {
                        barrel.rotation.z = Math.PI / 2;
                        barrel.position.y -= 0.2;
                    }
                    barrel.castShadow = true;
                    this.scenarioGroup.add(barrel);
                }
            });

            // 4. Árvores Queimadas da Floresta Vermelha (Troncos Secos)
            const deadTrunkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.98 });
            for (let i = 0; i < 24; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 32 + Math.random() * 50;
                const tx = Math.cos(angle) * dist;
                const tz = Math.sin(angle) * dist;
                const ty = window.getGroundHeight(tx, tz);

                const deadTree = new THREE.Group();
                deadTree.position.set(tx, ty, tz);

                const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 5.0, 7), deadTrunkMat);
                trunk.position.y = 2.5;
                trunk.rotation.z = (Math.random() - 0.5) * 0.25;
                trunk.rotation.x = (Math.random() - 0.5) * 0.25;
                trunk.castShadow = true;
                deadTree.add(trunk);

                // Galhos secos retorcidos
                for (let g = 0; g < 4; g++) {
                    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 5), deadTrunkMat);
                    branch.position.set(0, 3.2 + g * 0.6, 0);
                    branch.rotation.set((Math.random() - 0.5) * 1.5, Math.random() * Math.PI, (Math.random() - 0.5) * 1.5);
                    deadTree.add(branch);
                }

                this.scenarioGroup.add(deadTree);
            }
        }

        // ==============================================================
        // CENÁRIO 3: ESTAÇÃO ESPACIAL ORBITAL (TECH & CÚPULA CÓSMICA)
        // ==============================================================
        buildSpaceStationDecorations() {
            // 1. Skybox / Domo de Espaço Profundo com Estrelas e Planeta Gigante
            this.spaceSkyboxGroup = new THREE.Group();

            // Campo de 3.500 estrelas cintilantes
            const starGeo = new THREE.BufferGeometry();
            const starCount = 3500;
            const starPositions = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount * 3; i += 3) {
                const u = Math.random();
                const v = Math.random();
                const theta = u * 2.0 * Math.PI;
                const phi = Math.acos(2.0 * v - 1.0);
                const r = 240 + Math.random() * 40;
                starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
                starPositions[i + 1] = Math.abs(r * Math.cos(phi)) + 10; // Acima da estação
                starPositions[i + 2] = r * Math.sin(phi) * Math.sin(theta);
            }
            starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
            const starMat = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 1.2,
                transparent: true,
                opacity: 0.95
            });
            const starField = new THREE.Points(starGeo, starMat);
            this.spaceSkyboxGroup.add(starField);

            // Planeta Gigante (Estilo Saturno/Exoplaneta Azul com Anéis)
            const planetGroup = new THREE.Group();
            planetGroup.position.set(130, 95, -160);

            const planetSphere = new THREE.Mesh(
                new THREE.SphereGeometry(32, 32, 32),
                new THREE.MeshStandardMaterial({
                    color: 0x0284c7,
                    emissive: 0x0369a1,
                    emissiveIntensity: 0.25,
                    roughness: 0.6
                })
            );
            planetGroup.add(planetSphere);

            // Anéis do Planeta
            const planetRing = new THREE.Mesh(
                new THREE.RingGeometry(40, 68, 48),
                new THREE.MeshBasicMaterial({
                    color: 0x38bdf8,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.65
                })
            );
            planetRing.rotation.x = Math.PI / 2.3;
            planetRing.rotation.y = Math.PI / 6;
            planetGroup.add(planetRing);
            this.animatedProps.push({ obj: planetGroup, type: 'rotateY', speed: 0.02 });

            this.spaceSkyboxGroup.add(planetGroup);
            this.scene.add(this.spaceSkyboxGroup);

            // 2. Reator Quântico de Fusão de Plasma no Centro da Estação
            const quantumReator = new THREE.Group();
            quantumReator.position.set(0, window.getGroundHeight(0, 0) + 1.2, 0);

            // Esfera de Energia Quântica Central
            const plasmaCore = new THREE.Mesh(
                new THREE.SphereGeometry(2.2, 24, 24),
                new THREE.MeshStandardMaterial({
                    color: 0x38bdf8,
                    emissive: 0x0284c7,
                    emissiveIntensity: 2.2,
                    wireframe: true
                })
            );
            plasmaCore.position.y = 4.5;
            quantumReator.add(plasmaCore);

            const coreLight = new THREE.PointLight(0x38bdf8, 5, 28);
            coreLight.position.y = 4.5;
            quantumReator.add(coreLight);

            // 3 Anéis Magnéticos que giram em eixos diferentes
            const ringMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.95 });
            const r1 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.16, 12, 32), ringMat);
            const r2 = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.16, 12, 32), ringMat);
            const r3 = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.16, 12, 32), ringMat);
            r1.position.y = 4.5;
            r2.position.y = 4.5;
            r3.position.y = 4.5;
            quantumReator.add(r1, r2, r3);

            this.animatedProps.push(
                { obj: r1, type: 'rotateX', speed: 1.4 },
                { obj: r2, type: 'rotateY', speed: -1.8 },
                { obj: r3, type: 'rotateZ', speed: 2.2 },
                { obj: coreLight, type: 'pulse', speed: 3.0, base: 4.5, amp: 2.0 }
            );

            this.scenarioGroup.add(quantumReator);

            // 3. Arcos da Cúpula de Vidro Blindado / Gaiola Estrutural da Estação
            const beamMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.9 });
            const archCount = 6;
            for (let i = 0; i < archCount; i++) {
                const angle = (i / archCount) * Math.PI;
                const arch = new THREE.Mesh(new THREE.TorusGeometry(75, 1.2, 8, 36, Math.PI), beamMat);
                arch.position.y = 0;
                arch.rotation.y = angle;
                arch.castShadow = true;
                this.scenarioGroup.add(arch);
            }

            // 4. Consoles Holográficos e Painéis Sci-Fi nas bases
            [-44, 44].forEach(cx => {
                const cz = cx;
                const cy = window.getGroundHeight(cx, cz);
                const consoleGroup = new THREE.Group();
                consoleGroup.position.set(cx, cy, cz);

                // Mesa de controle
                const desk = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 1.4), beamMat);
                desk.position.y = 0.5;
                consoleGroup.add(desk);

                // Tela holográfica flutuante
                const holoScreen = new THREE.Mesh(
                    new THREE.PlaneGeometry(2.8, 1.4),
                    new THREE.MeshBasicMaterial({
                        color: cx > 0 ? 0xef4444 : 0x38bdf8,
                        transparent: true,
                        opacity: 0.75,
                        side: THREE.DoubleSide
                    })
                );
                holoScreen.position.set(0, 1.8, 0);
                consoleGroup.add(holoScreen);

                const holoLight = new THREE.PointLight(cx > 0 ? 0xef4444 : 0x38bdf8, 2.5, 10);
                holoLight.position.set(0, 2.0, 0);
                consoleGroup.add(holoLight);

                this.scenarioGroup.add(consoleGroup);
            });
        }

        // ==============================================================
        // LOOP DE ANIMAÇÃO E DETECÇÃO DE DANO DE PERIGOS (HAZARDS)
        // ==============================================================
        update(dt, localPlayerPos, onTakeDamageCallback) {
            if (document.hidden) return;
            const now = Date.now();

            // 1. Atualizar animações de props (rotação de anéis, pulsação de luzes)
            for (let i = 0; i < this.animatedProps.length; i++) {
                const anim = this.animatedProps[i];
                if (!anim.obj) continue;

                if (anim.type === 'rotateX') anim.obj.rotation.x += anim.speed * dt;
                else if (anim.type === 'rotateY') anim.obj.rotation.y += anim.speed * dt;
                else if (anim.type === 'rotateZ') anim.obj.rotation.z += anim.speed * dt;
                else if (anim.type === 'pulse') {
                    anim.obj.intensity = anim.base + Math.sin(now * 0.003 * anim.speed) * anim.amp;
                }
            }

            // 2. Verificar perigos para o jogador local (ex: Poças de Radiação em Chernobyl)
            if (this.currentScenarioId === 'chernobyl' && localPlayerPos && this.hazardObjects.length > 0) {
                if (now - this.lastRadiationTick > 350) { // Tick de dano a cada 350ms
                    for (let i = 0; i < this.hazardObjects.length; i++) {
                        const h = this.hazardObjects[i];
                        if (h.type === 'radiation_pool') {
                            const dist = Math.hypot(localPlayerPos.x - h.x, localPlayerPos.z - h.z);
                            if (dist < h.radius) {
                                this.lastRadiationTick = now;
                                this.playGeigerClick();

                                if (typeof onTakeDamageCallback === 'function') {
                                    onTakeDamageCallback({
                                        damage: 5,
                                        source: 'radiation',
                                        message: '☢️ CUIDADO: VOCÊ PISOU NA POÇA RADIOATIVA!'
                                    });
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        /**
         * Gera estalo tático de contador Geiger via Web Audio API
         */
        playGeigerClick() {
            if (document.hidden) return;
            try {
                if (!this.audioCtx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) this.audioCtx = new AudioContext();
                }
                if (!this.audioCtx || this.audioCtx.state === 'suspended') return;

                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800 + Math.random() * 600, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.06);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.06);
            } catch (e) {}
        }
    }

    // Instância global única
    window.ScenarioManager = new ScenarioManager();
    window.BERNARDONITE_SCENARIOS = SCENARIOS;

})(window);
