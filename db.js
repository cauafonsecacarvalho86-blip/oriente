const mysql = require('mysql2');

const conexao = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '12345',
    database: 'sistema_oriente'
});

conexao.connect((erro) => {
    if (erro) {
        console.error('❌ Erro ao conectar:', erro.message);
        return;
    }
    console.log('✅ Deu certo! Conectado com sucesso!');
});

module.exports = conexao;