const serverSocket = io('ws://localhost:3000')

//lobby
    serverSocket.emit('entrar')

    function enviarMensagem(){
        const mensagem = document.getElementById('mensagem')

        serverSocket.emit('enviarMensagem', mensagem)
    }

    serverSocket.on('postarMensagem', (msg) => {
        const mensagens = document.getElementById('mensagens')
        mensagens.innerHTML += `<p>${msg}`
    })