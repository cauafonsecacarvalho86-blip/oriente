-- Cria o banco de dados se não existir
CREATE DATABASE IF NOT EXISTS sistema_oriente;
USE sistema_oriente;

-- Remove tabelas antigas se existirem para evitar conflito
DROP TABLE IF EXISTS historico_movimentacoes;
DROP TABLE IF EXISTS ordens_servico;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS usuarios;

-- 1. TABELA DE USUÁRIOS E ACESSOS
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    papel VARCHAR(20) NOT NULL CHECK (papel IN ('admin', 'instalador')),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE PRODUTOS E INSUMOS DO ESTOQUE
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_ref VARCHAR(50) UNIQUE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('unitario', 'insumo')),
    nome VARCHAR(150) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    imei VARCHAR(50) UNIQUE,
    quantidade INT DEFAULT 1,
    estoque_minimo INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Em Estoque' CHECK (status IN ('Em Estoque', 'Com Instalador', 'Instalado/Concluído')),
    foto_url TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE ORDENS DE SERVIÇO / CUSTÓDIA
CREATE TABLE ordens_servico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_os VARCHAR(30) NOT NULL,
    instalador_id INT NOT NULL,
    produto_id INT NOT NULL,
    tipo_servico VARCHAR(100) NOT NULL,
    modelo_carro VARCHAR(100) NOT NULL,
    placa_veiculo VARCHAR(10) NOT NULL,
    cep VARCHAR(9),
    rua VARCHAR(150) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade_uf VARCHAR(100) NOT NULL,
    quantidade_retirada INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Concluido')),
    liberado_por VARCHAR(100) NOT NULL,
    data_retirada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_conclusao TIMESTAMP NULL,
    foto_evidencia_url TEXT,
    FOREIGN KEY (instalador_id) REFERENCES usuarios(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- 4. TABELA DE HISTÓRICO E AUDITORIA (LOGS)
CREATE TABLE historico_movimentacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    produto_id INT,
    usuario_id INT,
    ordem_servico_id INT,
    acao VARCHAR(100) NOT NULL,
    detalhes TEXT,
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id)
);