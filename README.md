# 🏆 Bernardonite (Fortnite Battle Royale Web 3D)

<div align="center">

![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)
![WebSockets](https://img.shields.io/badge/WebSockets-Realtime-blue?style=for-the-badge)
![Gamepad API](https://img.shields.io/badge/Gamepad_API-Plug_%26_Play-purple?style=for-the-badge&logo=gamepad)
![Status](https://img.shields.io/badge/Status-Online%20%26%20Jogável-brightgreen?style=for-the-badge)

**Um Battle Royale completo estilo Fortnite, direto no navegador, com suporte multiplayer em tempo real, bots inteligentes de combate, gráficos 3D realistas PBR, suporte nativo a Joysticks/Controles (Xbox, PlayStation, USB/Bluetooth), múltiplos cenários de batalha e arsenal completo com granadas táticas.**

🌐 **Jogar Agora Online:** [https://bernardo.sejawebmaster.com.br](https://bernardo.sejawebmaster.com.br)

</div>

---

## ✨ Principais Funcionalidades

### 1. 🎮 Suporte Nativo a Joysticks & Gamepads (USB / Bluetooth) & Mobile Touch
- **HTML5 Gamepad API**: Detecção automática de qualquer controle plugado ao computador ou pareado via Bluetooth.
- **Controles 100% Suportados**:
  - **Xbox**: Xbox 360, Xbox One, Xbox Series S/X.
  - **PlayStation**: DualShock 4 (PS4), DualSense (PS5), adaptadores Dual PSX.
  - **Controles de PC / Genéricos**: DragonRise / Microntek (PC Twin Shock), 8BitDo, GameSir, iPega, Redragon, Nintendo Switch Pro Controller.
- **Mapeamento Ergonômico de Dois Analógicos**: Analógico esquerdo para movimentação 360° e strafe; analógico direito para mira e rotação suave da câmera com zona morta calibrada.
- **Controles Touchscreen Mobile**: Joystick analógico virtual na tela com acionamento automático de corrida ao empurrar ao limite e mira por arrasto no lado direito.

### 2. 🗺️ Múltiplos Cenários de Batalha (Multimapas)
- 🌴 **Ilha dos Campeões**: Cenário tropical clássico com labirinto tático de pedra e baú central com tesouro dourado.
- ☢️ **Chernobyl Radioativo**: Ambiente pós-apocalíptico com torre de reator, neblina amarelada, poças de lama tóxica que causam dano contínuo e som sintetizado de contador Geiger.
- 🚀 **Estação Espacial Orbital**: Base de operações no espaço com módulos futuristas, gravidade reduzida e visão panorâmica para a Terra.

### 3. 💣 Arsenal Tático Expandido: 9 Slots & 3 Tipos de Granadas
| Slot | Arma / Item | Dano | Efeito / Alcance |
| :---: | :--- | :---: | :--- |
| **1** | ⛏️ **Picareta Tática** | 25 | Curto alcance / Coleta madeira das árvores |
| **2** | 🔫 **SCAR Dourada** | 35 (70 HS) | Fuzil de assalto de alta precisão (85m) |
| **3** | 💥 **Shotgun Calibre 12** | 90 (140 HS) | Dispersão devastating em combate próximo (26m) |
| **4** | 🎯 **Heavy Sniper** | 110 (220 HS) | Tiro perfurante de longo alcance com mira (160m) |
| **5** | 🚀 **RPG Lança-Foguetes** | 95 em área | Míssil físico 3D com rastro de fumaça e explosão |
| **6** | 🧪 **Mini Shield / Cura** | +50 Escudo | Kit instantâneo de recuperação (+25 Vida se sem escudo) |
| **7** | 💣 **Granada Explosiva HE** | 85 em área | Temporizador de 2.1s com estilhaços e onda de choque |
| **8** | ☀️ **Granada de Luz (Flashbang)** | 0 (Cegueira) | Cega adversários no campo de visão e som de tinnitus |
| **9** | ☁️ **Granada de Fumaça (Smoke)** | 0 (Ocultação) | Cortina volumétrica densa de 15 segundos para cobertura |

### 4. ⚔️ Sistema de Times, Salas Multiplayer & Bots Inteligentes
- **Browser de Salas**: Crie salas personalizadas com nome próprio, mapa à sua escolha, metas de kills (15, 25 ou 50) e quantidade de bots (0 a 16 bots).
- **Times E-Sports**: Disputa entre **Time Azul 🔵** e **Time Vermelho 🔴** com bases fortificadas e proteção contra fogo amigo.
- **Bots Autônomos**: IA com patrulha, detecção a 50m, movimentação evasiva, disparos e renascimento automático.
- **Spawn no Chão**: Ao iniciar a partida, os jogadores nascem diretamente no solo da base da sua equipe sem telas de espera.

### 5. 🎨 Customização Visual do Guerreiro (Skins)
- **Cores Táticas**: Escolha no Lobby a cor primária do seu traje (Azul, Ciano, Verde Tático, Índigo, Dourado).
- **Aplicação nos Modelos PBR**: A cor personalizada é refletida no colete militar, mochila de assalto, cúpula do capacete, ombreiras, joelheiras e asa-delta, mantendo LEDs de identificação para amigos/inimigos.

### 6. ⚡ Otimizações Extremas de Desempenho (60 FPS Fixo)
- **Zero Recompilação de Shaders GLSL**: Substituição de luzes dinâmicas instanciadas por uma fonte de luz estática pré-compilada (`explosionLight`), eliminando qualquer travamento ao arremessar ou detonar bombas e RPGs.
- **Geometrias e Materiais Compartilhados**: Partículas de explosão, fumaça e modelos de granadas reutilizam instâncias na GPU sem provocar picos de *Garbage Collection*.
- **Anti-Freeze por Alternância de Abas**: Sincronização inteligente com `visibilitychange` e `window.blur` para limpar teclas presas, pausar osciladores de áudio e recalcular `deltaTime` sem saltos bruscos.
- **Safe Storage Wrapper**: Armazenamento local seguro que impede erros de *Tracking Prevention* em navegadores modernos (Safari/Edge/Brave).

### 7. 🎧 Áudio Espacial 3D Binaural (HRTF) & Síntese Sonora Multi-Camada
- **Panning 3D Realista (HRTF)**: O som de tiros de outros jogadores, bots, explosões e construções agora é posicionado no espaço 3D relativo à câmera (percepção exata de esquerda, direita, frente ou longe em fones de ouvido).
  - **Picareta Tática**: Whoosh cortante de ar tático ao balançar (*sweep bandpass* 620Hz ➔ 190Hz) e impacto metálico sólido com ressonância de aço ao golpear árvores ou inimigos.
  - **Entrada de Player Humano**: Chime tecnológico ascendente de 4 notas [D5, F#5, A5, D6] acompanhado de *roger beep* de rádio militar quando um humano entra na partida.
  - **Eliminação de Player Humano**: Tom fúnebre ressonante descendente com sub-grave de parada cardíaca (26Hz) e estática de perda de sinal militar quando um jogador humano é eliminado.
  - **SCAR**: Estampido seco de queima de pólvora com punch mecânico de câmara.
  - **Shotgun Calibre 12**: Estouro encorpado de chumbo com sub-grave de curto alcance.
  - **Heavy Sniper**: Chicote supersônico cortante de alta frequência com trovão rolante que ecoa pela ilha.
  - **Explosões**: Onda de choque estridente combinada com subwoofer sísmico e rugido prolongado de detritos.
  - **Hitmarkers**: Som táctil e crocante de confirmação de acerto no corpo ou escudo.
  - **Passos**: Feedback tátil de passos de botas sincronizado com caminhada e corrida turbo.

### 8. 📐 Interface Adaptativa: Auto-Escala & Modo HUD Limpo (Tecla H)
- **Auto-Escala Inteligente**: Em notebooks e telas menores (resolução 1366x768 ou 1080p escalonado), a interface inteira encolhe proporcionalmente de 20% a 32%, liberando mais de 60% do campo de visão central.
- **Modo HUD Limpo / Compacto (<kbd>H</kbd>)**: Oculta botões auxiliares que poluem a visão de combate (como botões de câmera, corrida rápida e menu de construção) e condensa as barras de vida/escudo e os slots de armas em ícones elegantes.
- **Seletor de Tamanho no Lobby**: Permite escolher entre `Compacto (-25%)`, `Auto (Ideal)` ou `Normal / Grande`, com persistência automática no armazenamento seguro do navegador.

---

## 🎮 Tabela de Controles Completa

### Controle / Joystick Físico (Gamepad)
| Comando | Controle Xbox | Controle PlayStation | Ação |
| :--- | :---: | :---: | :--- |
| **Movimentação** | **Analógico Esquerdo (L)** | **Analógico Esquerdo (L)** | Andar em 360° e strafe lateral |
| **Câmera / Mira** | **Analógico Direito (R)** | **Analógico Direito (R)** | Olhar ao redor e mirar suavemente |
| **Atirar / Ação** | **RT (Gatilho Direito)** | **R2 ou R1** | Disparo de arma ou golpe |
| **Pular** | **Botão A** | **Botão ✖ (Cruz)** | Pulo e acionamento de asa-delta |
| **Correr (Sprint)** | **L3** *(clique do analógico)* | **L3** *(clique do analógico)* | Corrida turbo (+63% velocidade) |
| **Próxima Arma** | **RB (Bumper Dir.)** | **R1 (Bumper Dir.)** | Avança para o próximo slot |
| **Arma Anterior** | **LB (Bumper Esq.)** | **L1 (Bumper Esq.)** | Retorna ao slot anterior |
| **Picareta / Arma** | **Botão Y** | **Botão ▲ (Triângulo)** | Alterna entre Picareta e arma ativa |
| **Renascer / Ação** | **Botão X** | **Botão ◼ (Quadrado)** | Renascer imediatamente ao morrer |
| **Trocar Câmera** | **R3** *(clique do analógico)* | **R3** *(clique do analógico)* | Alterna entre 1ª e 3ª Pessoa |
| **Granada HE** | **D-Pad ⬆ (Cima)** | **D-Pad ⬆ (Cima)** | Equipa Granada Explosiva (Slot 7) |
| **Granada Flash** | **D-Pad ⬇ (Baixo)** | **D-Pad ⬇ (Baixo)** | Equipa Granada de Luz (Slot 8) |
| **Construir Parede** | **D-Pad ⬅ (Esquerda)** | **D-Pad ⬅ (Esquerda)** | Constrói Parede de madeira (10 mats) |
| **Construir Rampa** | **D-Pad ➡ (Direita)** | **D-Pad ➡ (Direita)** | Constrói Rampa de elevação (10 mats) |
| **Placar Geral** | **Back / View** | **Select / Share** | Exibe e fecha o placar da partida |

> 💡 **Dica para controles USB tipo DualShock (DragonRise / Microntek):**  
> Lembre-se de manter o botão central **"ANALOG" / "MODE"** com o LED vermelho **ACESO** para ativar os eixos analógicos nos dois direcionais!

---

### Teclado & Mouse
| Tecla / Ação | Função |
| :--- | :--- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Movimentar o personagem |
| <kbd>Mouse</kbd> | Mirar e rotacionar câmera (Pointer Lock) |
| <kbd>Scroll do Mouse (Wheel)</kbd> | Aproximar (6-) ou distanciar (6+) a câmera do boneco |
| <kbd>Clique Esquerdo</kbd> | Disparar arma / Usar picareta / Consumir escudo |
| <kbd>Shift</kbd> | Correr rápido (**Sprint Turbo +63%**) |
| <kbd>Espaço</kbd> | Pular / Subir (Modo Espectador) |
| <kbd>V</kbd> | Alternar entre 1ª Pessoa (FPS) e 3ª Pessoa (TPS) |
| <kbd>H</kbd> | Alternar Modo HUD Limpo / Completo (ideal para telas menores) |
| <kbd>1</kbd> a <kbd>9</kbd> | Selecionar arma / granada nos 9 slots |
| <kbd>G</kbd> | Arremessar granada ativa rapidamente |
| <kbd>Z</kbd> / <kbd>X</kbd> / <kbd>C</kbd> | Construir Parede / Rampa / Chão |
| <kbd>Tab</kbd> | Abrir Placar Geral de Pontuação |
| <kbd>R</kbd> | Renascer na base (quando eliminado ou espectador) |
| <kbd>Esc</kbd> | Sair da partida e retornar ao Lobby |

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

## 🏗️ Estrutura do Projeto

```
bernardo/
├── fortnite_multiplayer.html  # Cliente web (Three.js r128, Gamepad API, HUD, PBR, Web Audio)
├── server.js                  # Servidor HTTP & WebSocket (Room Manager, IA de Bots, Netcode)
├── js/
│   └── scenarios.js           # Gerenciador de mapas procedurais (Ilha, Chernobyl e Estação Espacial)
├── favicon.ico                # Favicon oficial do jogo
├── package.json               # Configurações do projeto e dependências Node.js
├── .gitignore                 # Arquivos ignorados pelo controle de versão
└── README.md                  # Documentação completa e atualizada do projeto
```

---

## 👨‍💻 Desenvolvido para o Bernardo & Família

Divirta-se jogando online em tempo real no PC, celular ou controle! 🚀🎮
