const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Permite imagens em base64 para evidências de serviços
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração do Pool de Conexões do MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'sistema_oriente',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Testar a conexão com o banco de dados na inicialização
pool.getConnection()
  .then(connection => {
    console.log('Conectado com sucesso ao banco de dados MySQL: sistema_oriente');
    connection.release();
  })
  .catch(err => {
    console.error('Falha na conexão com o banco de dados:', err.message);
  });

// ==================== ROTAS DA API ====================

app.get('/api/usuarios', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nome, usuario, senha_hash, papel FROM usuarios');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// CADASTRAR NOVO USUÁRIO
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nome, usuario, senha, papel } = req.body;
    
    // Insere o usuário no banco de dados (salvando a senha na coluna senha_hash)
    const [result] = await pool.query(
      'INSERT INTO usuarios (nome, usuario, senha_hash, papel) VALUES (?, ?, ?, ?)',
      [nome, usuario, senha, papel]
    );
    
    res.status(201).json({ id: result.insertId, message: 'Usuário criado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// CADASTRAR NOVO PRODUTO / EQUIPAMENTO
app.post('/api/produtos', async (req, res) => {
  try {
    const { nome, categoria, marca, tipo, imei, quantidade } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO produtos (nome, categoria, marca, tipo, imei, quantidade, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nome, categoria, marca, tipo || 'unitario', imei || null, quantidade || 1, 'Em Estoque']
    );
    
    res.status(201).json({ id: result.insertId, message: 'Produto cadastrado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 2. LISTAR TODOS OS PRODUTOS / ESTOQUE
app.get('/api/produtos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM produtos');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. LISTAR ORDENS DE SERVIÇO / CAUTELAS
app.get('/api/ordens-servico', async (req, res) => {
  try {
    const query = `
      SELECT os.*, u.nome AS instalador_nome, p.nome AS produto_nome, p.categoria, p.imei 
      FROM ordens_servico os
      JOIN usuarios u ON os.instalador_id = u.id
      JOIN produtos p ON os.produto_id = p.id
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CRIAR NOVA ORDEM DE SERVIÇO / ATRIBUIR ITEM
app.post('/api/ordens-servico', async (req, res) => {
  const {
    codigo_os, instalador_id, produto_id, tipo_servico,
    modelo_carro, placa_veiculo, cep, rua, numero,
    bairro, cidade_uf, quantidade_retirada, liberado_por
  } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Inserir Ordem de Serviço
    const insertQuery = `
      INSERT INTO ordens_servico 
      (codigo_os, instalador_id, produto_id, tipo_servico, modelo_carro, placa_veiculo, cep, rua, numero, bairro, cidade_uf, quantidade_retirada, liberado_por, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')
    `;
    await connection.query(insertQuery, [
      codigo_os, instalador_id, produto_id, tipo_servico,
      modelo_carro, placa_veiculo, cep, rua, numero,
      bairro, cidade_uf, quantidade_retirada || 1, liberado_por
    ]);

    // Atualizar status ou quantidade do produto
    const [prodRows] = await connection.query('SELECT tipo, quantidade FROM produtos WHERE id = ?', [produto_id]);
    if (prodRows.length > 0) {
      if (prodRows[0].tipo === 'unitario') {
        await connection.query('UPDATE produtos SET status = ? WHERE id = ?', ['Com Instalador', produto_id]);
      } else {
        const novaQtd = prodRows[0].quantidade - (quantidade_retirada || 1);
        await connection.query('UPDATE produtos SET quantidade = ? WHERE id = ?', [novaQtd, produto_id]);
      }
    }

    await connection.commit();
    res.status(201).json({ message: 'Ordem de serviço criada com sucesso!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 5. CONCLUIR ORDEM DE SERVIÇO (ENVIAR FOTO DE EVIDÊNCIA)
app.patch('/api/ordens-servico/:id/concluir', async (req, res) => {
  const { id } = req.params;
  const { foto_evidencia_url } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Obter o produto_id da ordem de serviço
    const [osRows] = await connection.query('SELECT produto_id FROM ordens_servico WHERE id = ?', [id]);
    if (osRows.length === 0) {
      return res.status(404).json({ error: 'Ordem de serviço não encontrada.' });
    }
    const produtoId = osRows[0].produto_id;

    // Atualizar status da ordem de serviço
    const updateOS = `
      UPDATE ordens_servico 
      SET status = 'Concluido', data_conclusao = CURRENT_TIMESTAMP, foto_evidencia_url = ?
      WHERE id = ?
    `;
    await connection.query(updateOS, [foto_evidencia_url || null, id]);

    // Atualizar status do produto para instalado
    await connection.query('UPDATE produtos SET status = ? WHERE id = ?', ['Instalado/Concluído', produtoId]);

    await connection.commit();
    res.json({ message: 'Serviço concluído com sucesso!' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});