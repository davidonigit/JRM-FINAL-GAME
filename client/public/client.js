const serverSocket = io('ws://localhost:3000')
let nome

// SIGN UP
function criarConta(){
    let username = document.getElementById('username').value;
    let email = document.getElementById('email').value;
    let senha = document.getElementById('senha').value;
    serverSocket.emit('criarConta', {username: username, email:email, senha:senha})
}

serverSocket.on('cadastroSucesso', () => {
    alert('Cadastrado com sucesso')
    location.href = 'login.html'
})
serverSocket.on('cadastroFalhou', () => {
    alert('Usuario ou email já utilizados')
})

//LOGIN
function logar(){
    let login = document.getElementById('login').value;
    let senha = document.getElementById('senha').value;

    serverSocket.emit('tentarLogin', {login: login, senha: senha})
    serverSocket.on('loginSucesso', () => {
        location.href = 'lobby.html'
    })
    serverSocket.on('loginFalhou', () => {
        alert('Usuario e/ou senha incorretos')
    })

}

//lobby
    function enviarMensagem(){
        const mensagem = document.getElementById('mensagem')

        serverSocket.emit('enviarMensagem', mensagem)
    }

    serverSocket.on('postarMensagem', (msg) => {
        const mensagens = document.getElementById('mensagens')
        mensagens.innerHTML += `<p>${msg}`
    })