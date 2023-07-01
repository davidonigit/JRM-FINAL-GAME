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
let skills = [];

const TICK_RATE = 30;
const SPEED = 10;
const RUNNING_SPEED = 11;
const SKILL_SPEED = 15;
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
	players.forEach(player => {
		const inputs = inputsMap[player.socketId]

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
			player.y -= SPEED
			let colision = isCollidingWithMap(player)
			if(colision.bool){
				player.y = colision.positionY + TILE_SIZE
			}
		} else if(inputs.down){
			player.y += SPEED
			let colision = isCollidingWithMap(player)
			if(colision.bool){
				player.y = colision.positionY - PLAYER_SIZE
			}
		}

		if(inputs.left){
			player.x -= SPEED
			colision = isCollidingWithMap(player)
			if(colision.bool){
				player.x = colision.positionX + TILE_SIZE
			}
		} else if(inputs.right){
			player.x += SPEED
			colision = isCollidingWithMap(player)
			if(colision.bool){
				player.x = colision.positionX - PLAYER_SIZE
			}
		}
	})

	skills.forEach(skill => {
		skill.x += Math.cos(skill.angle) * SKILL_SPEED
		skill.y += Math.sin(skill.angle) * SKILL_SPEED
		skill.timeLeft -= delta

		for (const player of players) {
			if(player.socketId === skill.playerId) continue;
			const distance = Math.sqrt(
				(player.x + PLAYER_SIZE/2 - skill.x)**2 + 
				(player.y + PLAYER_SIZE/2 - skill.y)**2
			)
			if(distance <= PLAYER_SIZE/2) {
				player.x = 0
				player.y = 0
				skill.timeLeft = 0
				break;
			}
		}
	})

	skills = skills.filter((skill) => skill.timeLeft >= 0)

	io.emit('players', players);
	io.emit('skills', skills)
}

function findBySocketId(socketId) {
	return players.find((e) => e.socketId === socketId)
}

function addPlayer(nome, socketId, sala) {
	const player = {
		nome: nome,
		socketId: socketId,
		sala: sala,
		x: 0,
		y: 0
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
			salas[data.sala].jogadores.push(data.nome)
			console.log('usuario '+data.nome+' entrou na sala '+data.sala)
		})

		function salaDisconnect(sala, nome){
			if(salas[sala]){
				let index = salas[sala].jogadores.map(e => e).indexOf(nome)
				if (index != -1) {
					salas[sala].jogadores.splice(index, 1)
				}
			}
		}

		clientSocket.on('inputs', (inputs) => {
			inputsMap[clientSocket.id] = inputs
		})

		clientSocket.on('skill', (angle) => {
			const player = players.find(player => player.socketId === clientSocket.id)
			skills.push({
				angle,
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

// ficar mandando a lista de player para todo mundo a cada 1 segundo
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