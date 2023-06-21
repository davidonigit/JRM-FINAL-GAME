var express = require ('express')
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
let cadastros = [];
let players = [];

function findBySocketId(socketId) {
  return players.find((e) =>  e.socketId === socketId)
}

function addPlayer(nome, socketId) {
    const player = {
      nome: nome,
      socketId: socketId
    }
    players.push(player);
    io.emit('players', players);
}

io.on('connection', (clientSocket) => {
  console.log('usuario conectado')
  console.log(clientSocket.id)

  /*
  clientSocket.on('disconnect', () => {
    let index = players.indexOf(clientSocket.id)
    players.splice(index,1)
    console.log('usuario desconectado')
  })
  */

  clientSocket.emit('players', players);
  
  clientSocket.on('criarConta', (data) => {
    const existingAccount = cadastros.filter((e) => e.username === data.username || e.email === data.email)

    if (existingAccount.length > 0) {
      // já existe
      clientSocket.emit('cadastroFalhou')
    } else{
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
    } else{
      clientSocket.emit('loginFalhou')
    }
  })

  clientSocket.on('entrar', (data) => {
    const contaOnline = players.filter((e) => e.nome === data.nome)

    if (contaOnline > 0) {
      contaOnline.socketId = clientSocket.id
    } else{
      addPlayer(data.nome, clientSocket.id);
      console.log(data.nome + ' entrou no jogo');
    }
    
    // mandar players para todos
    //io.emit('players', players);
  });

  clientSocket.on('enviarMensagem', (data) => {
    const remetente = findBySocketId(clientSocket.id);
    const msg = `${remetente.nome}: ${data.texto}`;
    io.emit('postarMensagem', msg)
  })
}
)

// ficar mandando a lista de player para todo mundo a cada 1 segundo
setInterval(() => {
  //io.emit('players', (players))
  console.log(players)
}, 10000)



httpServer.listen(3000, () => {
  console.log('servidor iniciou na porta 3000')
}
)
