# JRM-FINAL-GAME

## Pre-requisitos no Windows, Mac ou Linux
* Node.js
* Git

Será criada a pasta **JRM-FINAL-GAME** com as pastas **server** e **client** dentro dela.

## Inicializar o servidor
```bash
cd server
npm install
npm start
```

Isso fará o servidor Socket.IO iniciar na porta 3000

## Inicializar o cliente
```bash
cd client
npm install
npm start
```

Isso fará iniciar o serviço do nosso cliente Socket.IO na porta 3010. Esse serviço pode ser acessado pelo navegador na URL:

http://localhost:3010/signup.html

A partir dai, faça o seu cadastro com username, email e senha.

Os cadastros ficam salvos em memória, portanto, ao reiniciar o servidor os cadastros são perdidos.

Com o cadastro realizado, faça login com a conta criada.

Com o login concluído, você terá acesso ao Game Lobby. Nele é possível visualizar os players online, interagir com eles num chat global, criar uma sala e entrar em salas criadas pelos jogadores.

Crie sua sala e aguarde outro player se conectar nela. Ao atingir 2 players na sala, o criador pode iniciar a partida.

## JOGABILIDADE

## Ambos os times:

- Controlar o personagem: movimentação padrão com W A S D (cima, esquerda, baixo, direita, respectivamente)

## SURVIVOR:

- Correr: SHIFT (manter pressionado)
- Pular barricadas: E (possui 2 segundos de coldown)
- Ao ser atingido, recebe 150% de boost na velocidade, durante 3 segundos

## KILLER:

- Arremessar machado: left click do mouse (possui 2 segundos de coldown)

## REGRAS DO JOGO:

- A pontuação se dá pela quantidade de tempo vivo do jogador no time Survivor

- Cada jogador possui 2 vidas, ao ser atingido 2 vezes, os jogadores dão respawn e os times serão trocados.

- Quem sobreviver mais tempo / eliminar o inimigo mais rápido, vence.
