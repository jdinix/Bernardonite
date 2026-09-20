# 🏆 Bernardonite (Fortnite Battle Royale Web 3D)

<div align="center">

![Fortnite Web 3D](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)
![WebSockets](https://img.shields.io/badge/WebSockets-Realtime-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Online%20%26%20Jogável-brightgreen?style=for-the-badge)

**Um Battle Royale completo estilo Fortnite, direto no navegador, com suporte multiplayer em tempo real, bots inteligentes de combate, gráficos 3D realistas PBR, modo de câmera 1ª e 3ª Pessoa e sistema de construção.**

🌐 **Jogar Agora Online:** [https://bernardo.sejawebmaster.com.br](https://bernardo.sejawebmaster.com.br)

</div>

---

## ✨ Principais Funcionalidades

### 1. ⚔️ Sistema de Times & Pontuação E-Sports
- **Disputa de Equipes**: **Time Azul 🔵** contra **Time Vermelho 🔴**.
- **Bases Customizadas**: Cada time tem sua base fortificada com cristais rotativos e área de regeneração.
- **Spawn no Chão**: Ao entrar na partida ou renascer, o jogador surge diretamente no chão da base do seu time.
- **Placar Central no Topo**: Barra de pontuação dinâmica em tempo real com meta da rodada de **25 eliminações**.
- **Fogo Amigo Desativado**: Proteção automática para companheiros de equipe não tomarem dano mútuo.

### 2. 🤖 Bots Inteligentes com IA Autônoma
- **6 Bots ativos no mapa** (3 no Time Azul e 3 no Time Vermelho):
  - 🔵 **Time Azul**: *Bot João*, *Bot Carol*, *Bot Sophia*
  - 🔴 **Time Vermelho**: *Bot Diniz*, *Bot Conrado*, *Bot Joãoz*
- **Comportamento Autônomo**:
  - Patrulha livre pela ilha e pelos corredores do labirinto.
  - Detecção de inimigos até 50 metros.
  - Movimentação tática (aproximação e recuo tático).
  - Mira com rotação de corpo e disparos periódicos com fuzil SCAR.
  - Respawn automático na base de sua equipe 4.5 segundos após serem eliminados.

### 3. 📷 Câmera Dupla (1ª Pessoa FPS & 3ª Pessoa TPS)
- **Alternância Instantânea**: Pressione a tecla <kbd>V</kbd> ou clique no botão **`📷 3ª PESSOA (V)` / `📷 1ª PESSOA (V)`** na barra de ações.
- **1ª Pessoa (FPS)**:
  - Braços e luvas táticas militares empunhando a arma de forma ergonômica.
  - Cano da arma apontado diretamente para a mira central (*crosshair*).
  - Ângulos esféricos 1:1 sem distorção vertical (*pitch*) ou horizontal (*yaw*).
  - Animações de balanço ao andar (*weapon bobbing*) e recuo físico nos disparos (*recoil*).
- **3ª Pessoa (TPS)**:
  - Câmera clássica sobre os ombros com visão ampla do soldado, animação de pernas e asa-delta.

### 4. 🏃 Sistema de Corrida Rápida (Sprint)
- **Atalho no Teclado**: Pressione e segure <kbd>Shift</kbd> para disparar.
- **Botão no HUD**: Clique em **`🏃 CORRER (SHIFT)`** para alternar a velocidade.
- **Velocidade Turbo**: Aumento de 9.5 para **15.5 (+63% de velocidade de corrida)**.
- **FOV Dinâmico**: Campo de visão expande de 65° para 73° dinamicamente com animação rápida dos membros.

### 5. 🔫 6 Armas Táticas Balanceadas
| Slot | Arma | Dano Corpo | Headshot | Alcance / Tipo |
| :---: | :--- | :---: | :---: | :--- |
| **1** | ⛏️ **Picareta Tática** | 25 | 25 | Curto alcance / Coleta madeira |
| **2** | 🔫 **SCAR Dourada** | 35 | 70 | Fuzil de Assalto Hitscan (85m) |
| **3** | 💥 **Shotgun Calibre 12** | 90 (5x18) | 140 | Dispersão de cartuchos (26m) |
| **4** | 🎯 **Heavy Sniper** | 110 | 220 | Tiro perfurante de longa distância (160m) |
| **5** | 🚀 **RPG Lança-Foguetes** | 95 (Área) | 95 | Míssil físico 3D com explosão em área (90m) |
| **6** | 🧪 **Mini Shield / Cura** | +50 Escudo | +25 Vida | Kit de sobrevivência instantâneo |

### 6. 🧱 Sistema de Construção Rápida
- 🧱 **Parede** (<kbd>Z</kbd>) - Custo: 10 de Madeira.
- 📐 **Rampa** (<kbd>X</kbd>) - Custo: 10 de Madeira.
- 🟫 **Chão** (<kbd>C</kbd>) - Custo: 10 de Madeira.
- Coleta de madeira aproximando-se de árvores da ilha com a picareta.

---

## 🎮 Tabela de Controles

| Tecla / Ação | Função |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Movimentar o personagem |
| <kbd>Mouse</kbd> | Mirar e rotacionar câmera (Pointer Lock) |
| <kbd>Clique Esquerdo</kbd> | Disparar arma / Golpear com picareta / Usar escudo |
| <kbd>Shift</kbd> (Esquerdo/Direito) | **Correr rápido (+63% velocidade)** |
| <kbd>V</kbd> | **Alternar entre 1ª Pessoa (FPS) e 3ª Pessoa (TPS)** |
| <kbd>Espaço</kbd> | Pular / Subir (Modo Espectador) |
| <kbd>1</kbd> a <kbd>6</kbd> | Selecionar arma no inventário |
| <kbd>Z</kbd> / <kbd>X</kbd> / <kbd>C</kbd> | Construir Parede / Rampa / Chão |
| <kbd>Tab</kbd> | Visualizar Placar Geral de Pontuação |
| <kbd>R</kbd> | Renascer na base (quando eliminado ou espectador) |

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior.
- Git instalado.

### Passo a Passo
```bash
# 1. Clone o repositório
git clone https://github.com/jdinix/Bernardonite.git
cd Bernardonite

# 2. Instale as dependências
npm install

# 3. Inicie o servidor
npm start
# ou: node server.js
```

Abra seu navegador em:
👉 **`http://localhost:3033`**

---

## 🏗️ Arquitetura do Projeto

```
bernardo/
├── fortnite_multiplayer.html  # Jogo cliente (Three.js WebGL, HUD, PBR, sons sintéticos Web Audio)
├── server.js                  # Servidor HTTP & WebSocket Server (IA dos Bots, Netcode, Scores)
├── favicon.ico                # Ícone do jogo
├── package.json               # Configurações do projeto e dependências Node.js
├── .gitignore                 # Arquivos ignorados pelo Git
└── README.md                  # Documentação completa do projeto
```

---

## 👨‍💻 Desenvolvido com carinho para o Bernardo & Família

Divirta-se jogando online em tempo real! 🚀🎮
