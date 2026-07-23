// URL BASE DA API
const API_URL = 'http://localhost:3000/api';

let usuarioLogado = null;
let usuariosApp = {};
let banco = {
  estoque: [],
  tarefasPendentes: [],
  servicosConcluidos: [],
  historico: []
};

// ==================== CARREGAMENTO DE DADOS DO BANCO ====================
async function carregarDadosDoBanco() {
  try {
    // 1. Carregar usuários da API
    const resUsuarios = await fetch(`${API_URL}/usuarios`);
    if (resUsuarios.ok) {
      const usuariosList = await resUsuarios.json();
      usuariosApp = {};
      usuariosList.forEach(u => {
        usuariosApp[u.usuario] = { id: u.id, nome: u.nome, papel: u.papel, usuario: u.usuario };
      });
    }

    // 2. Carregar produtos / estoque da API
    const resProdutos = await fetch(`${API_URL}/produtos`);
    if (resProdutos.ok) {
      banco.estoque = await resProdutos.json();
    }

    // 3. Carregar ordens de serviço / cautelas da API
    const resOS = await fetch(`${API_URL}/ordens-servico`);
    if (resOS.ok) {
      const osList = await resOS.json();
      banco.tarefasPendentes = osList.filter(os => os.status === 'Pendente');
      banco.servicosConcluidos = osList.filter(os => os.status === 'Concluido');
    }

    renderizarViews();
  } catch (err) {
    console.error('Erro ao conectar com a API:', err);
  }
}

// API DE BUSCA DE CEP GRATUITA
async function buscarEnderecoPorCep(prefixo) {
  const campoCep = document.getElementById(`${prefixo}-cep`);
  const statusEl = document.getElementById(`${prefixo}-cep-status`);
  const cep = campoCep.value.replace(/\D/g, '');

  if (cep.length !== 8) {
    if(cep.length > 0) alert('O CEP precisa conter 8 dígitos!');
    return;
  }

  statusEl.classList.remove('hidden');

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      alert('CEP não encontrado.');
      statusEl.classList.add('hidden');
      return;
    }

    document.getElementById(`${prefixo}-rua`).value = data.logradouro || '';
    document.getElementById(`${prefixo}-bairro`).value = data.bairro || '';
    document.getElementById(`${prefixo}-cidade`).value = `${data.localidade}/${data.uf}`;
    document.getElementById(`${prefixo}-numero`).focus();
  } catch (err) {
    alert('Erro ao consultar CEP.');
  } finally {
    statusEl.classList.add('hidden');
  }
}

function preencherLogin(u, s) {
  document.getElementById('login-usuario').value = u;
  document.getElementById('login-senha').value = s;
}

async function realizarLogin(e) {
  e.preventDefault();
  const u = document.getElementById('login-usuario').value.toLowerCase().trim();
  const s = document.getElementById('login-senha').value;

  try {
    // Busca todos os usuários cadastrados na API do banco de dados
    const resUsuarios = await fetch(`${API_URL}/usuarios`);
    if (!resUsuarios.ok) {
      alert('Erro ao conectar com o servidor.');
      return;
    }
    
    const usuariosList = await resUsuarios.json();
    
    // Procura no banco se existe o usuário digitado
    const usuarioEncontrado = usuariosList.find(user => user.usuario.toLowerCase() === u);

    // Valida se o usuário existe e se a senha confere (conforme coluna senha_hash do banco)
    if (usuarioEncontrado && usuarioEncontrado.senha_hash === s) {
      usuarioLogado = {
        id: usuarioEncontrado.id,
        nome: usuarioEncontrado.nome,
        papel: usuarioEncontrado.papel,
        usuario: usuarioEncontrado.usuario
      };
      
      document.getElementById('tela-login').classList.add('hidden');
      document.getElementById('app-principal').classList.remove('hidden');

      document.getElementById('nome-usuario-logado').innerText = usuarioLogado.nome;
      document.getElementById('papel-usuario-logado').innerText = usuarioLogado.papel === 'admin' ? 'Administrador' : 'Instalador de Campo';
      document.getElementById('badge-perfil-usuario').innerText = usuarioLogado.papel;

      if(usuarioLogado.papel === 'admin') {
        document.getElementById('menu-admin').classList.remove('hidden');
        document.getElementById('menu-instalador').classList.add('hidden');
        mudarAba('dashboard');
      } else {
        document.getElementById('menu-admin').classList.add('hidden');
        document.getElementById('menu-instalador').classList.remove('hidden');
        mudarAba('minhas-tarefas');
      }

      carregarDadosDoBanco();
    } else {
      alert('Usuário ou senha incorretos!');
    }
  } catch (err) {
    console.error('Erro no login:', err);
    alert('Erro ao tentar realizar login. Verifique se o servidor está rodando.');
  }
}

function fazerLogout() {
  usuarioLogado = null;
  document.getElementById('tela-login').classList.remove('hidden');
  document.getElementById('app-principal').classList.add('hidden');
}

function mudarAba(abaId) {
  const todasAbas = ['dashboard', 'retirada', 'custodia', 'estoque', 'cadastro', 'usuarios', 'historico', 'minhas-tarefas', 'retirar-instalador', 'meu-historico'];
  todasAbas.forEach(aba => {
    const el = document.getElementById(`aba-${aba}`);
    if(el) el.classList.add('hidden');
    const btn = document.getElementById(`btn-${aba}`);
    if(btn) {
      btn.classList.remove('bg-oriente', 'text-white', 'font-bold', 'shadow-md');
      btn.classList.add('text-slate-300', 'hover:bg-oriente-navy', 'hover:text-white');
    }
  });

  const abaAlvo = document.getElementById(`aba-${abaId}`);
  if(abaAlvo) abaAlvo.classList.remove('hidden');
  
  const btnAtivo = document.getElementById(`btn-${abaId}`);
  if(btnAtivo) {
    btnAtivo.classList.remove('text-slate-300', 'hover:bg-oriente-navy', 'hover:text-white');
    btnAtivo.classList.add('bg-oriente', 'text-white', 'font-bold', 'shadow-md');
  }

  carregarDadosDoBanco();
}

function renderizarViews() {
  if(!usuarioLogado) return;

  renderDashboardAdmin();
  renderOpcoesRetiradaAdmin();
  renderCustodiaAdmin();
  renderEstoqueCentralAdmin();
  renderUsuariosAdmin();
  renderHistoricoAdmin();

  renderTarefasInstalador();
  renderOpcoesRetiradaInstalador();
  renderMeuHistoricoInstalador();
}

// CADASTRAR NOVOS USUÁRIOS (ADMIN) - Rota Backend Recomendada
async function criarNovoUsuario(e) {
  e.preventDefault();
  const nome = document.getElementById('novo-user-nome').value.trim();
  const login = document.getElementById('novo-user-login').value.toLowerCase().trim();
  const senha = document.getElementById('novo-user-senha').value;
  const papel = document.getElementById('novo-user-papel').value;

  try {
    const response = await fetch(`${API_URL}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, usuario: login, senha, papel })
    });

    if (response.ok) {
      alert(`Usuário ${nome} criado com sucesso!`);
      document.getElementById('form-criar-usuario').reset();
      carregarDadosDoBanco();
    } else {
      const errData = await response.json();
      alert('Erro ao criar usuário: ' + (errData.error || 'Erro desconhecido'));
    }
  } catch (err) {
    alert('Erro de conexão com o servidor.');
  }
}

async function deletarUsuario(userId, loginUser) {
  if(loginUser === usuarioLogado.usuario) {
    alert("Você não pode excluir a sua própria conta logada.");
    return;
  }

  if(confirm(`Tem certeza que deseja apagar o acesso deste usuário?`)) {
    try {
      const response = await fetch(`${API_URL}/usuarios/${userId}`, { method: 'DELETE' });
      if (response.ok) {
        carregarDadosDoBanco();
      } else {
        alert('Erro ao excluir usuário no banco.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  }
}

function renderUsuariosAdmin() {
  const tbody = document.getElementById('tabela-usuarios-cadastrados');
  if(!tbody) return;
  tbody.innerHTML = '';

  Object.keys(usuariosApp).forEach(key => {
    const u = usuariosApp[key];
    let badge = u.papel === 'admin' 
      ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">👑 Admin</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">🔧 Instalador</span>`;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 px-4 font-bold text-slate-800">${u.nome}</td>
        <td class="p-3.5 font-mono text-slate-500">${u.usuario}</td>
        <td class="p-3.5">${badge}</td>
        <td class="p-3.5 text-center">
          ${u.usuario !== 'admin' ? `
            <button onclick="deletarUsuario('${u.id}', '${u.usuario}')" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="Excluir Usuário">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : '<span class="text-[10px] text-slate-400 italic">Sistema</span>'}
        </td>
      </tr>
    `;
  });
}

// FUNÇÕES DE INSTALADOR
function renderTarefasInstalador() {
  const container = document.getElementById('lista-tarefas-instalador');
  if (!container) return;
  container.innerHTML = '';

  if(!banco.tarefasPendentes) banco.tarefasPendentes = [];
  const minhasTarefas = banco.tarefasPendentes.filter(i => i.instalador_nome === usuarioLogado.nome);

  if(minhasTarefas.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-2xl border text-center space-y-2">
        <i class="fa-solid fa-circle-check text-4xl text-emerald-500"></i>
        <h3 class="font-bold text-slate-800">Sua lista está limpa! Nenhum item pendente.</h3>
      </div>
    `;
    return;
  }

  minhasTarefas.forEach(item => {
    container.innerHTML += `
      <article class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div class="flex items-center gap-4 border-b pb-3">
          <div class="flex-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-oriente-light text-oriente uppercase">${item.tipo_servico || 'Instalação'}</span>
            <h3 class="font-black text-lg text-oriente-dark mt-1">${item.produto_nome}</h3>
            <p class="text-xs text-slate-500 font-mono">Categoria: <b>${item.categoria || '-'}</b> | IMEI: <b>${item.imei || '-'}</b></p>
          </div>
          <span class="text-xs font-bold font-mono bg-slate-100 px-3 py-1 rounded-lg text-slate-700">${item.codigo_os}</span>
        </div>

        <div class="bg-oriente-light/60 border border-oriente/20 p-3.5 rounded-xl space-y-1">
          <p class="text-xs font-bold text-oriente-dark">
            <i class="fa-solid fa-car text-oriente"></i> VEÍCULO: <span class="text-slate-800 font-black">${item.modelo_carro} (${item.placa_veiculo})</span>
          </p>
          <p class="text-xs text-slate-700 mt-1"><i class="fa-solid fa-location-dot text-oriente mr-1"></i> Endereço: <b>${item.rua}, ${item.numero} - ${item.bairro}, ${item.cidade_uf}</b></p>
        </div>

        <div class="space-y-2 pt-1">
          <label class="block text-xs font-bold uppercase text-slate-600">Anexar Foto do Serviço Concluído:</label>
          <input type="file" id="foto-instalador-${item.id}" accept="image/*" class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer border rounded-xl">
        </div>

        <button type="button" onclick="concluirServicoInstalador('${item.id}')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2">
          <i class="fa-solid fa-camera"></i> Concluir Serviço & Enviar Foto
        </button>
      </article>
    `;
  });
}

function renderOpcoesRetiradaInstalador() {
  const select = document.getElementById('inst-item-id');
  if(!select) return;
  select.innerHTML = '<option value="">Escolha o item no estoque central...</option>';
  
  banco.estoque.forEach(item => {
    if(item.status === 'Em Estoque' || (item.tipo === 'lote' && item.quantidade > 0)) {
      select.innerHTML += `<option value="${item.id}">[${item.categoria}] ${item.nome} (IMEI/Ref: ${item.imei || item.id})</option>`;
    }
  });
}

async function executarRetiradaInstalador(e) {
  e.preventDefault();
  const idItem = document.getElementById('inst-item-id').value;
  const servico = document.getElementById('inst-servico').value;
  const carro = document.getElementById('inst-carro').value;
  const placa = document.getElementById('inst-placa').value.toUpperCase();
  
  const rua = document.getElementById('inst-rua').value;
  const num = document.getElementById('inst-numero').value;
  const bairro = document.getElementById('inst-bairro').value;
  const cidade = document.getElementById('inst-cidade').value;
  const os = document.getElementById('inst-os').value;

  try {
    const response = await fetch(`${API_URL}/ordens-servico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo_os: os,
        instalador_id: usuarioLogado.id,
        produto_id: idItem,
        tipo_servico: servico,
        modelo_carro: carro,
        placa_veiculo: placa,
        rua, numero: num, bairro, cidade_uf: cidade,
        quantidade_retirada: 1,
        liberado_por: usuarioLogado.nome
      })
    });

    if (response.ok) {
      alert('Ordem de serviço gerada e item retirado com sucesso!');
      document.getElementById('form-retirada-instalador').reset();
      carregarDadosDoBanco();
      mudarAba('minhas-tarefas');
    } else {
      const errJson = await response.json();
      alert('Erro ao registrar retirada: ' + errJson.error);
    }
  } catch (err) {
    alert('Erro de conexão com o servidor.');
  }
}

async function concluirServicoInstalador(osId) {
  const inputFoto = document.getElementById(`foto-instalador-${osId}`);

  const enviarConclusao = async (base64Foto = "") => {
    try {
      const response = await fetch(`${API_URL}/ordens-servico/${osId}/concluir`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_evidencia_url: base64Foto })
      });

      if (response.ok) {
        alert('Serviço concluído com sucesso!');
        carregarDadosDoBanco();
      } else {
        alert('Erro ao concluir serviço.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  };

  if (inputFoto && inputFoto.files && inputFoto.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => enviarConclusao(e.target.result);
    reader.readAsDataURL(inputFoto.files[0]);
  } else {
    enviarConclusao("");
  }
}

function renderMeuHistoricoInstalador() {
  const tbody = document.getElementById('tabela-meus-servicos');
  if(!tbody) return;
  tbody.innerHTML = '';

  const meusConcluidos = banco.servicosConcluidos.filter(s => s.instalador_nome === usuarioLogado.nome);

  meusConcluidos.forEach(s => {
    let btnFoto = s.foto_evidencia_url 
      ? `<button onclick="abrirModalFoto('${s.foto_evidencia_url}', '${s.tipo_servico}')" class="text-oriente font-bold bg-oriente-light px-2.5 py-1 rounded-lg text-xs"><i class="fa-solid fa-image"></i> Foto</button>`
      : `<span class="text-slate-300 italic text-[10px]">Sem foto</span>`;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 px-4">${btnFoto}</td>
        <td class="p-3.5 font-bold text-slate-800">${s.tipo_servico || 'Instalação'}<br><span class="text-[10px] text-slate-400 font-normal">Item: ${s.produto_nome} (${s.imei || '-'})</span></td>
        <td class="p-3.5 font-bold text-slate-700">${s.modelo_carro || '-'}<br><span class="text-xs font-mono font-normal text-slate-500">${s.placa_veiculo} / ${s.codigo_os}</span></td>
        <td class="p-3.5 text-slate-600">${s.rua}, ${s.numero} - ${s.bairro}, ${s.cidade_uf}</td>
        <td class="p-3.5 text-slate-400">${s.data_conclusao || '-'}</td>
      </tr>
    `;
  });
}

// FUNÇÕES DE ADMINISTRAÇÃO
function renderDashboardAdmin() {
  if(!banco.tarefasPendentes) banco.tarefasPendentes = [];

  const rastreadores = banco.estoque.filter(i => (i.categoria === 'Rastreador' || i.tipo === 'unitario') && i.status === 'Em Estoque').length;
  const custodia = banco.tarefasPendentes.length;
  const concluidos = banco.servicosConcluidos.length;

  if(document.getElementById('dash-total-rastreadores')) {
    document.getElementById('dash-total-rastreadores').innerText = rastreadores;
    document.getElementById('dash-total-custodia').innerText = custodia;
    document.getElementById('dash-total-hoje').innerText = concluidos;
    document.getElementById('dash-total-alertas').innerText = 0;
  }
}

function renderOpcoesRetiradaAdmin() {
  const selectInstaladores = document.getElementById('retirada-instalador');
  if(selectInstaladores) {
    selectInstaladores.innerHTML = '<option value="">Selecione o Instalador...</option>';
    Object.keys(usuariosApp).forEach(key => {
      const u = usuariosApp[key];
      if(u.papel === 'instalador') {
        selectInstaladores.innerHTML += `<option value="${u.id}">${u.nome} (${u.usuario})</option>`;
      }
    });
  }

  const select = document.getElementById('retirada-item-id');
  if(!select) return;
  select.innerHTML = '<option value="">Selecione o equipamento ou insumo...</option>';
  
  banco.estoque.forEach(item => {
    if(item.status === 'Em Estoque' || (item.quantidade && item.quantidade > 0)) {
      select.innerHTML += `<option value="${item.id}">[${item.categoria}] ${item.nome} (IMEI/Ref: ${item.imei || item.id})</option>`;
    }
  });
}

async function executarRetiradaAdmin(e) {
  e.preventDefault();
  const idItem = document.getElementById('retirada-item-id').value;
  const instaladorId = document.getElementById('retirada-instalador').value;
  const servico = document.getElementById('retirada-tipo-servico').value;
  const carro = document.getElementById('retirada-carro').value;
  const placa = document.getElementById('retirada-placa').value.toUpperCase();

  const rua = document.getElementById('adm-rua').value;
  const num = document.getElementById('adm-numero').value;
  const bairro = document.getElementById('adm-bairro').value;
  const cidade = document.getElementById('adm-cidade').value;
  const os = document.getElementById('retirada-os').value;

  try {
    const response = await fetch(`${API_URL}/ordens-servico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo_os: os,
        instalador_id: instaladorId,
        produto_id: idItem,
        tipo_servico: servico,
        modelo_carro: carro,
        placa_veiculo: placa,
        rua, numero: num, bairro, cidade_uf: cidade,
        quantidade_retirada: 1,
        liberado_por: usuarioLogado.nome
      })
    });

    if (response.ok) {
      alert('Ordem de serviço emitida com sucesso!');
      document.getElementById('form-retirada').reset();
      carregarDadosDoBanco();
    } else {
      const errJson = await response.json();
      alert('Erro ao emitir O.S.: ' + errJson.error);
    }
  } catch (err) {
    alert('Erro de conexão com o servidor.');
  }
}

function renderCustodiaAdmin() {
  const grid = document.getElementById('grid-custodia');
  if(!grid) return;
  grid.innerHTML = '';

  const listaInstaladores = Object.values(usuariosApp).filter(u => u.papel === 'instalador');

  listaInstaladores.forEach(inst => {
    const itensInst = banco.tarefasPendentes.filter(i => i.instalador_id === inst.id || i.instalador_nome === inst.nome);
    
    let htmlCard = `
      <article class="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <header class="flex justify-between items-center border-b pb-2">
          <h3 class="font-bold text-slate-800">${inst.nome}</h3>
          <span class="text-xs text-oriente bg-oriente-light font-bold px-2 py-0.5 rounded-full">${itensInst.length} pendente(s)</span>
        </header>
    `;

    if(itensInst.length === 0) {
      htmlCard += `<p class="text-xs text-slate-400 italic">Nenhum equipamento pendente.</p>`;
    } else {
      itensInst.forEach(item => {
        htmlCard += `
          <div class="bg-slate-50 p-3 rounded-xl border text-xs flex gap-3 items-center">
            <div class="space-y-0.5 flex-1">
              <p class="font-bold text-slate-800">${item.produto_nome}</p>
              <p class="text-slate-600">Veículo: <b>${item.modelo_carro} (${item.placa_veiculo})</b></p>
              <p class="text-slate-500">Local: ${item.rua}, ${item.numero} - ${item.bairro}</p>
            </div>
          </div>
        `;
      });
    }

    htmlCard += `</article>`;
    grid.innerHTML += htmlCard;
  });
}

function renderEstoqueCentralAdmin() {
  const tbody = document.getElementById('tabela-estoque');
  if(!tbody) return;
  tbody.innerHTML = '';

  banco.estoque.forEach(item => {
    let statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">${item.status || 'Disponível'}</span>`;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50">
        <td class="p-3 font-mono text-slate-500">${item.imei || item.id}</td>
        <td class="p-3 font-bold text-slate-800">${item.nome}</td>
        <td class="p-3 text-slate-500">${item.categoria}</td>
        <td class="p-3">${statusBadge}</td>
      </tr>
    `;
  });
}

// CADASTRAR EQUIPAMENTO / PRODUTO DIRETAMENTE NO MYSQL
async function cadastrarItem(e) {
  e.preventDefault();
  const nome = document.getElementById('cad-nome').value;
  const categoria = document.getElementById('cad-categoria').value;
  const marca = document.getElementById('cad-marca') ? document.getElementById('cad-marca').value : 'Genérico';
  const tipo = document.getElementById('cad-tipo') ? document.getElementById('cad-tipo').value : 'unitario';
  const imei = document.getElementById('cad-imei') ? document.getElementById('cad-imei').value : '';
  const quantidade = document.getElementById('cad-qtd') ? document.getElementById('cad-qtd').value : 1;

  try {
    const response = await fetch(`${API_URL}/produtos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, categoria, marca, tipo, imei, quantidade })
    });

    if (response.ok) {
      alert('Equipamento cadastrado com sucesso no banco de dados!');
      document.getElementById('form-cadastro').reset();
      carregarDadosDoBanco();
      mudarAba('estoque');
    } else {
      const resJson = await response.json();
      alert('Erro ao cadastrar: ' + (resJson.error || 'Erro desconhecido'));
    }
  } catch (err) {
    alert('Erro de conexão com o servidor.');
  }
}

function alternarCamposCadastro() {
  const cat = document.getElementById('cad-categoria').value;
  const ehRastreador = cat === 'Rastreador';
  const imeiBox = document.getElementById('campo-imei-box');
  const insumoBox = document.getElementById('campo-insumo-box');
  if(imeiBox) imeiBox.classList.toggle('hidden', !ehRastreador);
  if(insumoBox) insumoBox.classList.toggle('hidden', ehRastreador);
}

function filtrarTabelaEstoque() {
  const termo = document.getElementById('filtro-estoque').value.toLowerCase();
  const linhas = document.querySelectorAll('#tabela-estoque tr');
  linhas.forEach(linha => {
    linha.style.display = linha.innerText.toLowerCase().includes(termo) ? '' : 'none';
  });
}

function renderHistoricoAdmin() {
  const tbody = document.getElementById('tabela-historico-completo');
  if(!tbody) return;
  tbody.innerHTML = '';

  banco.servicosConcluidos.forEach(s => {
    let btnFoto = s.foto_evidencia_url 
      ? `<button onclick="abrirModalFoto('${s.foto_evidencia_url}', '${s.tipo_servico}')" class="text-oriente font-bold bg-oriente-light px-2.5 py-1 rounded-lg text-xs"><i class="fa-solid fa-image"></i> Foto</button>`
      : `<span class="text-slate-300 italic text-[10px]">Sem foto</span>`;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50">
        <td class="p-3.5 px-4">${btnFoto}</td>
        <td class="p-3.5 font-mono text-slate-500">${s.data_conclusao || '-'}</td>
        <td class="p-3.5 font-bold text-slate-800">${s.instalador_nome}</td>
        <td class="p-3.5">
          <span class="font-bold text-oriente-dark">${s.tipo_servico || 'Instalação'}</span><br>
          <span class="text-[11px] text-slate-500">Item: <b>${s.produto_nome}</b> (IMEI: <span class="font-mono">${s.imei || '-'}</span>)</span>
        </td>
        <td class="p-3.5">
          <span class="font-bold text-slate-800">${s.modelo_carro || '-'}</span><br>
          <span class="text-xs font-mono text-slate-500">Placa: ${s.placa_veiculo} | ${s.codigo_os}</span>
        </td>
        <td class="p-3.5 text-slate-600">${s.rua}, ${s.numero} - ${s.bairro}</td>
      </tr>
    `;
  });
}

function abrirModalFoto(url, titulo) {
  if(!url) return;
  document.getElementById('modal-img').src = url;
  document.getElementById('modal-titulo').innerText = titulo;
  document.getElementById('modal-foto').classList.remove('hidden');
}

function fecharModalFoto() {
  document.getElementById('modal-foto').classList.add('hidden');
}

// Inicializar carregamento dos dados via API ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  carregarDadosDoBanco();
});