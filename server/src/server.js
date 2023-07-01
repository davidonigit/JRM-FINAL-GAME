var express = require('express')
var http = require('http')
var Server = require('socket.io').Server
var cors = require('cors');
var app = express();
app.use(cors())
app.get('/', (request, response) => {
	response.send('RAIZ do servidor web')
});
var httpServer = http.createServer(app);
var io = new Server(httpServer, {
	cors: {
		origin: "*"
	}
});

const loadMap = require('./mapLoader')

let cadastros = [];
let players = [];
let salas = {};
let inputsMap = {};

const TICK_RATE = 30;
const SURVIVOR_SPEED = 5;
const KILLER_SPEED = 11;
const RUNNING_SPEED = 10;
const SKILL_SPEED = 15;
const SKILL_HITBOX = {width: 16, height: 30}
const TILE_SIZE = 32;
const PLAYER_SIZE = 64;

let ground2D, decal2D;

function isColliding(rect1, rect2) {
	return (
	  rect1.x < rect2.x + rect2.w &&
	  rect1.x + rect1.w > rect2.x &&
	  rect1.y < rect2.y + rect2.h &&
	  rect1.h + rect1.y > rect2.y
	);
  }

  function isCollidingWithMap(player) {
	for (let row = 0; row < decal2D.length; row++) {
	  for (let col = 0; col < decal2D[0].length; col++) {
		const tile = decal2D[row][col];
  
		if (
		  tile &&
		  isColliding(
			{ //rect1
			  x: player.x,
			  y: player.y,
			  w: PLAYER_SIZE,
			  h: PLAYER_SIZE,
			},
			{ //rect2
			  x: col * TILE_SIZE,
			  y: row * TILE_SIZE,
			  w: TILE_SIZE,
			  h: TILE_SIZE,
			}
		  )
		) {
		  return {bool : true, positionX : col * TILE_SIZE, positionY: row * TILE_SIZE};
		}
	  }
	}
	return {bool : false};
  }

function tick(delta){
	for (const sala in salas){
		const jogo = salas[sala]
		if(jogo.gameStatus === 1){
			for (const jogador in jogo.jogadores) {
				const player = jogo.jogadores[jogador]
				const inputs = inputsMap[player.socketId]

				let TEAM_SPEED
				if(player.time === 'killer'){
					TEAM_SPEED = KILLER_SPEED
				} else if(inputs.run){
					TEAM_SPEED = RUNNING_SPEED
				} else {
					TEAM_SPEED = SURVIVOR_SPEED
				}

	
				if(inputs.up && inputs.down){
					inputs.up = false
					inputs.down = false
				}
				if(inputs.left && inputs.right){
					inputs.left = false
					inputs.right = false
				}
	
				/* Ao se mover para LEFT ou UP:
				*	estaremos colidindo com os px x:0 ou x:0, por isso basta voltar para a ultima
				*   posição antes do tile (tilePosition + TILE_SIZE);
				* 
				*  Ao se mover para RIGHT ou DOWN:
				* 	estaremos colidindo 64px a frente (PLAYER_SIZE), por isso deve-se voltar para
				*   a 64px antes do tile (tilePosition - PLAYER_SIZE);
				*/
				
				if(inputs.up){
					player.y -= TEAM_SPEED
					let colision = isCollidingWithMap(player)
					if(colision.bool){
						player.y = colision.positionY + TILE_SIZE
					}
				} else if(inputs.down){
					player.y += TEAM_SPEED
					let colision = isCollidingWithMap(player)
					if(colision.bool){
						player.y = colision.positionY - PLAYER_SIZE
					}
				}
	
				if(inputs.left){
					player.x -= TEAM_SPEED
					colision = isCollidingWithMap(player)
					if(colision.bool){
						player.x = colision.positionX + TILE_SIZE
					}
				} else if(inputs.right){
					player.x += TEAM_SPEED
					colision = isCollidingWithMap(player)
					if(colision.bool){
						player.x = colision.positionX - PLAYER_SIZE
					}
				}
			}
	
			for (const habilidade in jogo.skills) {
				const skill = jogo.skills[habilidade]
				// console.log('SKILL', skill)
				skill.x += Math.cos(skill.angle) * SKILL_SPEED
				skill.y += Math.sin(skill.angle) * SKILL_SPEED
				// console.log('SKILL ANGLE', skill.angle)
				skill.timeLeft -= delta
	
				for (const jogador in jogo.jogadores) {
					const player = jogo.jogadores[jogador]
					if(player.socketId === skill.playerId) continue;
	
					if(isColliding(
						{ //rect1
						x: skill.x,
						y: skill.y,
						w: SKILL_HITBOX.width,
						h: SKILL_HITBOX.height,
						},
						{ //rect2
						x: player.x,
						y: player.y,
						w: PLAYER_SIZE,
						h: PLAYER_SIZE,
						}
					)) {
						player.x = 0
						player.y = 0
						skill.timeLeft = 0
						break;
					}
				}
			}
	
			salas[sala].skills = salas[sala].skills.filter((skill) => skill.timeLeft >= 0)
			
			io.to(salas[sala].sala).emit('playersTick', salas[sala].jogadores);
			io.to(salas[sala].sala).emit('skillsTick', salas[sala].skills)
		}
	}
}

function findBySocketId(socketId) {
	return players.find((e) => e.socketId === socketId)
}

function addPlayer(nome, socketId, sala) {
	const player = {
		nome: nome,
		socketId: socketId,
		sala: sala,
	}
	players.push(player);
	io.emit('players', players);
}

async function main(){
	({ground2D, decal2D } = await loadMap());
	io.on('connection', (clientSocket) => {
		console.log('usuario conectado')

		clientSocket.on('disconnect', () => {
			let index = players.map(e => e.socketId).indexOf(clientSocket.id)
			if (index != -1) {
				salaDisconnect(players[index].sala, players[index].nome)
				players.splice(index, 1)
			}
			console.log('usuario desconectado')
		})

		inputsMap[clientSocket.id] = {
			up: false,
			down: false,
			left: false,
			right: false
		}

		clientSocket.emit('map', {ground: ground2D, decal: decal2D})
		clientSocket.emit('salas', salas)
		clientSocket.emit('players', players);

		clientSocket.on('criarConta', (data) => {
			const existingAccount = cadastros.filter((e) => e.username === data.username || e.email === data.email)

			if (existingAccount.length > 0) {
				// já existe
				clientSocket.emit('cadastroFalhou')
			} else {
				const newAccount = {
					username: data.username,
					email: data.email,
					senha: data.senha
				}
				cadastros.push(newAccount)
				console.log(cadastros)
				clientSocket.emit('cadastroSucesso')
			}
		})

		clientSocket.on('tentarLogin', (data) => {
			const loginValido = cadastros.filter((e) => e.username === data.login && e.senha === data.senha)

			if (loginValido.length > 0) {
				clientSocket.emit('loginSucesso')
			} else {
				clientSocket.emit('loginFalhou')
			}
		})

		clientSocket.on('entrar', (data) => {
			addPlayer(data.nome, clientSocket.id, data.sala);
			console.log(data.nome + ' se conectou');
			// mandar players para todos
			io.emit('players', players);
		});

		clientSocket.on('enviarMensagem', (data) => {
			const remetente = findBySocketId(clientSocket.id);
			const msg = `<strong>${remetente.nome}</strong>: ${data.texto}`;
			io.emit('postarMensagem', msg)
		})

		function criarSala(sala){
			if(salas[sala] === undefined && sala != null){
				salas[sala] = {
					sala: sala,
					jogadores: [],
					skills: [],
					gameStatus: 0,
				}
			}
		}

		clientSocket.on('criarSala', sala => {
			criarSala(sala)
			io.emit('salas', salas)
			console.log(salas)
		})

		clientSocket.on('entrarSala', (data) => {
			criarSala(data.sala)
			clientSocket.join(data.sala)
			// Indica no player qual sua sala
			players.forEach(player => {
				if(player.nome === data.nome){
					player.sala = data.sala
				}
			})
			// Adiciona jogador na sala
			const player = {
				nome: data.nome,
				socketId: clientSocket.id,
				sala: data.sala,
				time: 'killer',
				skillColdown: 0,
				x: 0,
				y: 0
			}
			if(salas[data.sala].jogadores.length > 0) {
				if(salas[data.sala].jogadores[0].time === 'killer'){
					player.time = 'survivor'
				}
				if(salas[data.sala].jogadores[0].time === 'survivor'){
					player.time = 'killer'
				}
			}
			salas[data.sala].jogadores.push(player)
			console.log('PLAYER OBJECT', player)
			console.log('usuario '+data.nome+' entrou na sala '+data.sala)
		})

		function salaDisconnect(sala, nome){
			if(salas[sala]){
				salas[sala].jogadores = salas[sala].jogadores.filter((jogador) => 
				jogador.nome != nome)
			}
		}

		clientSocket.on('gameReady', (data) => {
			salas[data.sala].gameStatus = 1
		})

		clientSocket.on('inputs', (inputs) => {
			inputsMap[clientSocket.id] = inputs
		})

		clientSocket.on('skill', (data) => {
			const player = salas[data.sala].jogadores.find(player => player.socketId === clientSocket.id)
			salas[data.sala].skills.push({
				angle: data.angle,
				x: player.x,
				y: player.y,
				timeLeft: 2000,
				playerId: clientSocket.id
			})
		})
	})

	let lastUpdate = Date.now()
	setInterval(() => {
		let now = Date.now()
		let delta = now - lastUpdate
		tick(delta);
		lastUpdate = now
	}, 1000 / TICK_RATE)
}

// controle de players e salas no lobby
setInterval(() => {
	io.emit('players', players)
	io.emit('salas', salas)
	console.log('players', players)
	console.log('salas', salas)
}, 10000)

httpServer.listen(3000, () => {
	console.log('servidor iniciou na porta 3000')
}
)

main();