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

const loadMap = require('./mapLoader');
const { posix } = require('path');

let cadastros = [];
let players = [];
let salas = {};
let inputsMap = {};

const ROOM_SIZE = 2;
const TICK_RATE = 30;
const SURVIVOR_SPEED = 5;
const KILLER_SPEED = 11;
const RUNNING_SPEED = 10;
const SKILL_SPEED = 16;
const BOOST_SPEED = 15;
const SKILL_HITBOX = {width: 16, height: 30}
const TILE_SIZE = 32;
const PLAYER_SIZE = {width: 40, height: 64};
const SPAWN_POINT = {x1: 2825, y1: 2822, x2: 337, y2: 362};

let ground2D, decal2D, prop2D, interact2D;

function isColliding(rect1, rect2) {
	return (
		rect1.x < rect2.x + rect2.w &&
		rect1.x + rect1.w > rect2.x &&
		rect1.y < rect2.y + rect2.h &&
		rect1.h + rect1.y > rect2.y
	)
}

function isCollidingWithMap(player) {
	for (let row = 0; row < decal2D.length; row++) {
		for (let col = 0; col < decal2D[0].length; col++) {
			const tile = decal2D[row][col];
			const prop = prop2D[row][col];
			if (
				(tile || prop) &&
				isColliding(
					{ //rect1
					x: player.x,
					y: player.y + (3*PLAYER_SIZE.height/4),
					w: PLAYER_SIZE.width,
					h: PLAYER_SIZE.height/4,
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

function isCollidingWithMapSkill(skill) {
	for (let row = 0; row < decal2D.length; row++) {
	  	for (let col = 0; col < decal2D[0].length; col++) {
			const tile = decal2D[row][col];
			if (
				tile &&
				isColliding(
					{ //rect1
					x: skill.x,
					y: skill.y,
					w: SKILL_HITBOX.width,
					h: SKILL_HITBOX.height,
					},
					{ //rect2
					x: col * TILE_SIZE,
					y: row * TILE_SIZE,
					w: TILE_SIZE,
					h: TILE_SIZE/4,
					}
				)
			) {
				return true
			}
		}
	}
	return false;
}

function mapInteraction(player){
	for (let row = 0; row < interact2D.length; row++) {
		for (let col = 0; col < interact2D[0].length; col++) {
			const tile = interact2D[row][col];
			let axi;
			if(tile){
				axi = axisVerify(tile)
			}
			if (
				tile &&
				axi === 'horizontal' &&
				isColliding(
					{ //rect1
					x: player.x,
					y: player.y,
					w: PLAYER_SIZE.width,
					h: PLAYER_SIZE.height,
					},
					{ //rect2
					x: (col) * TILE_SIZE,
					y: (row-1) * TILE_SIZE,
					w: TILE_SIZE,
					h: TILE_SIZE*3,
					}
				)
			) {
				let axi = axisVerify(tile)
				return {bool : true, axi: axi, positionX : col * TILE_SIZE, positionY: row * TILE_SIZE};
			} else if (
				tile &&
				axi === 'vertical' &&
				isColliding(
					{ //rect1
					x: player.x,
					y: player.y,
					w: PLAYER_SIZE.width,
					h: PLAYER_SIZE.height,
					},
					{ //rect2
					x: (col-1) * TILE_SIZE,
					y: (row) * TILE_SIZE,
					w: TILE_SIZE*3,
					h: TILE_SIZE,
					}
				)
			) {
				let axi = axisVerify(tile)
				return {bool : true, axi: axi, positionX : col * TILE_SIZE, positionY: row * TILE_SIZE};
			}
	  	}
	}
	return {bool : false};
}

function axisVerify(tile){
	let axi;
	if(tile.id === 708 || tile.id === 709){
		axi = 'horizontal';
	} else if(tile.id === 657 || tile.id === 682){
		axi = 'vertical';
	}
	return axi;
}

function tick(delta){
	for (const sala in salas){
		const jogo = salas[sala]
		if(jogo.gameStatus === 1){
			for (const jogador in jogo.jogadores) {
				const player = jogo.jogadores[jogador]
				const inputs = inputsMap[player.socketId]

				if(player.skillColdown > 0){
					player.skillColdown -= delta
				} else {
					player.skillColdown = 0
				}

				if(player.boost > 0){
					player.boost -= delta
				} else {
					player.boost = 0
				}

				// controle da pontuação
				if(player.time === 'survivor'){
					if(player.vida>0){
						player.pontos += 1
					} else {
						if(jogo.jogadores[0].vida === 0 && jogo.jogadores[1].vida === 0){
							jogo.gameStatus = 2
							let player0 = jogo.jogadores[0]
							let player1 = jogo.jogadores[1]
							if(player0.pontos > player1.pontos){
								io.to(jogo.sala).emit('gameOver', 
								{vencedor : player0.nome, pontosVencedor: player0.pontos, perdedor: player1.nome, pontosPerdedor: player1.pontos})
							} else if(player1.pontos > player0.pontos){
								io.to(jogo.sala).emit('gameOver', 
								{vencedor : player1.nome, pontosVencedor: player1.pontos, perdedor: player0.nome, pontosPerdedor: player0.pontos})
							} else{
								io.to(jogo.sala).emit('gameOverEmpate', 
								{player0 : player0.nome, pontos0: player0.pontos,
								player1: player1.nome, pontos1: player1.pontos})
							}
						} else {
							trocarTimes(jogo)
						}
					}
				}

				let TEAM_SPEED
				if(player.time === 'killer'){
					TEAM_SPEED = KILLER_SPEED
				} else if(inputs.run){
					TEAM_SPEED = RUNNING_SPEED
				} else {
					TEAM_SPEED = SURVIVOR_SPEED
				}
				if(player.time === 'survivor' && player.boost > 0){
					TEAM_SPEED = BOOST_SPEED
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
						player.y = colision.positionY - (TILE_SIZE/2)
					}
				} else if(inputs.down){
					player.y += TEAM_SPEED
					if(player.y > 3200 - PLAYER_SIZE.height){
						player.y = 3200 - PLAYER_SIZE.height
					}
					let colision = isCollidingWithMap(player)
					if(colision.bool){
						player.y = colision.positionY - PLAYER_SIZE.height
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
						player.x = colision.positionX - PLAYER_SIZE.width
					}
				}

				let animation = mapInteraction(player)
				if(animation.bool && inputs.jump && player.skillColdown === 0 && player.time === 'survivor'){
					
					if(animation.axi === 'horizontal'){
						if(player.y === animation.positionY - PLAYER_SIZE.height){
								player.y += PLAYER_SIZE.height
								player.skillColdown = 2000;
						} else if(player.y === animation.positionY - 16){
							player.y -= PLAYER_SIZE.height
							player.skillColdown = 2000;
						}
					} else {
						if(player.x === animation.positionX + TILE_SIZE){
							player.x -= PLAYER_SIZE.width + TILE_SIZE
							player.skillColdown = 2000;
						} else if(player.x === animation.positionX - PLAYER_SIZE.width){
							player.x += PLAYER_SIZE.width + TILE_SIZE
							player.skillColdown = 2000;
						}
					}
				}

			}
	
			for (const habilidade in jogo.skills) {
				const skill = jogo.skills[habilidade]
				skill.x += Math.cos(skill.angle) * SKILL_SPEED
				skill.y += Math.sin(skill.angle) * SKILL_SPEED
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
						w: PLAYER_SIZE.width,
						h: PLAYER_SIZE.height,
						}
					)) {
						player.vida -= 1
						player.boost = 3000;
						skill.timeLeft = 0
						break;
					}
				}

				if(isCollidingWithMapSkill(skill)){
					skill.timeLeft = 0
				}
			}
	
			salas[sala].skills = salas[sala].skills.filter((skill) => skill.timeLeft > 0)
			
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

function salaDisconnect(sala, nome){
	if(salas[sala]){
		salas[sala].jogadores = salas[sala].jogadores.filter((jogador) => 
		jogador.nome != nome)
		if(salas[sala].gameStatus != 0){
			io.to(salas[sala].sala).emit('oponentDisconnect')
			salas[sala].gameStatus = 0
		} else {
			io.to(salas[sala].sala).emit('preGameDisconnect')
		}
	}
}

function trocarTimes(jogo){
	for(index=0; index<ROOM_SIZE; index++){
		if(jogo.jogadores[index].time === 'killer'){
			jogo.jogadores[index].time = 'survivor'
			jogo.jogadores[index].x = SPAWN_POINT.x2
			jogo.jogadores[index].y = SPAWN_POINT.y2
		} else {
			jogo.jogadores[index].time = 'killer'
			jogo.jogadores[index].x = SPAWN_POINT.x1
			jogo.jogadores[index].y = SPAWN_POINT.y1
		}
	}
}

async function main(){
	({ground2D, decal2D, prop2D, interact2D } = await loadMap());
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
			right: false,
			run: false,
			jump: false,
		}

		clientSocket.emit('map', {ground: ground2D, decal: decal2D, prop: prop2D ,interact: interact2D})
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

		clientSocket.on('criarSala', sala => {
			criarSala(sala)
			io.emit('salas', salas)
			console.log(salas)
		})

		clientSocket.on('entrarSala', (data) => {
			criarSala(data.sala)
			if(salas[data.sala].jogadores.length < ROOM_SIZE){
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
					x: SPAWN_POINT.x1,
					y: SPAWN_POINT.y1,
					vida: 2,
					pontos: 0,
					boost: 0,
				}
				if(salas[data.sala].jogadores.length > 0) {
					if(salas[data.sala].jogadores[0].time === 'killer'){
						player.time = 'survivor'
						player.x = SPAWN_POINT.x2
						player.y = SPAWN_POINT.y2
					}
					if(salas[data.sala].jogadores[0].time === 'survivor'){
						player.time = 'killer'
						player.x = SPAWN_POINT.x1
						player.y = SPAWN_POINT.y1
					}
				}
				salas[data.sala].jogadores.push(player)
	
				if(salas[data.sala].jogadores.length === ROOM_SIZE){
					io.to(salas[data.sala].sala).emit('oponentReady')
					console.log('SALA', salas[data.sala].sala, 'PRONTA PARA INICIAR')
				}
				console.log('usuario '+data.nome+' entrou na sala '+data.sala)
			} else {
				clientSocket.emit('salaCheia')
			}
		})

		clientSocket.on('startGame', (data) => {
			salas[data.sala].gameStatus = 1
			io.to(salas[data.sala].sala).emit('gameStarted')
			console.log('GAME INICIADO NA SALA', salas[data.sala].sala)
		})

		clientSocket.on('inputs', (inputs) => {
			inputsMap[clientSocket.id] = inputs
		})

		clientSocket.on('skill', (data) => {
			const player = salas[data.sala].jogadores.find(player => player.socketId === clientSocket.id)
			const playerIndex = salas[data.sala].jogadores.findIndex(player => player.socketId === clientSocket.id)
			if(salas[data.sala].jogadores[playerIndex].skillColdown === 0){
				salas[data.sala].skills.push({
					angle: data.angle,
					x: player.x,
					y: player.y,
					timeLeft: 2000,
					playerId: clientSocket.id
				})
				salas[data.sala].jogadores[playerIndex].skillColdown = 2000
			}
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
	//console.log('players', players)
	console.log('salas', salas)
}, 10000)

httpServer.listen(3000, () => {
	console.log('servidor iniciou na porta 3000')
}
)

main();