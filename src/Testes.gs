/**
 * Destrava Digital — Teste automático (só para desenvolvimento).
 *
 * Como usar: no editor do Apps Script, escolha testarSistema e clique em Executar.
 * O relatório aparece no "Registro de execução" e numa janela na planilha.
 *
 * O teste usa a própria planilha: cria cadastros marcados com [TESTE], confere os
 * resultados e, no fim (mesmo se algo falhar), apaga tudo que criou e devolve as
 * configurações, os contadores e o nome do arquivo como estavam.
 * Não use a planilha enquanto o teste roda (leva cerca de 1 minuto).
 *
 * Este arquivo sai do modelo de venda (ver LEIA-ME).
 */

const MARCA_TESTE = '[TESTE]';
const ABAS_COM_LINHAS_DE_TESTE = [ABA.CLIENTES, ABA.PRODUTOS, ABA.INSUMOS, ABA.FICHA, ABA.MOVIMENTOS, ABA.ATIVIDADES];

function testarSistema() {
  const ss = SpreadsheetApp.getActive();
  const r = novoRelatorio_();
  const antes = fotografar_(ss);

  try {
    testarEstrutura_(ss, r);
    testarConfiguracoes_(r, antes);
    testarClientes_(r);
    const insumo = testarInsumos_(r);
    const produto = testarProdutos_(r);
    if (insumo && produto) testarFicha_(r, insumo, produto, antes.config);
    testarAtividades_(r);
  } catch (e) {
    r.falha('O teste parou no meio por um erro inesperado', String(e && e.stack ? e.stack : e));
  } finally {
    try {
      restaurar_(ss, antes);
      r.ok('Limpeza: dados de teste apagados e configurações restauradas');
    } catch (e) {
      r.falha('Limpeza', 'Não consegui limpar tudo: ' + e + '. Confira as abas e apague as linhas com ' + MARCA_TESTE + '.');
    }
  }

  const texto = r.texto();
  console.log(texto);
  try {
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput('<pre style="font:13px/1.5 monospace;white-space:pre-wrap">' + escaparHtml_(texto) + '</pre>')
        .setWidth(640).setHeight(560),
      r.falhas ? 'Teste: ' + r.falhas + ' falha(s)' : 'Teste: tudo certo');
  } catch (e) {
    // Rodando sem a planilha aberta: o relatório fica só no registro de execução.
  }
  return r.falhas === 0;
}

// ---------- casos de teste ----------

function testarEstrutura_(ss, r) {
  Object.keys(ESQUEMA).forEach(nome => {
    if (ss.getSheetByName(nome)) r.ok('Aba ' + nome + ' existe');
    else r.falha('Aba ' + nome + ' existe', 'não encontrada — rode configurarPlanilha');
  });
  const falhas = verificarFormulas_(ss);
  if (falhas.length) falhas.forEach(f => r.falha('Fórmula', f));
  else r.ok('Todas as colunas calculadas mostram o título (nenhum #ERROR!)');
  r.igual('Localidade da planilha', ss.getSpreadsheetLocale(), 'pt_BR');

  // Código repetido faz fórmulas e buscas pegarem o cadastro errado.
  [ABA.PEDIDOS, ABA.CLIENTES, ABA.PRODUTOS, ABA.INSUMOS].forEach(nome => {
    const vistos = {}, repetidos = [];
    lerTabela(nome).forEach(x => {
      const c = String(x.codigo).trim();
      if (!c) return;
      if (vistos[c] && repetidos.indexOf(c) < 0) repetidos.push(c);
      vistos[c] = true;
    });
    r.verdadeiro('Códigos únicos em ' + nome, !repetidos.length,
      'repetidos: ' + repetidos.join(', ') + '. Apague ou corrija as linhas digitadas à mão.');
  });
}

function testarConfiguracoes_(r, antes) {
  const base = {
    nomeNegocio: MARCA_TESTE + ' Doces', logoUrl: '', cor: '#ff00aa',
    implantadorNome: 'Teste', implantadorWhatsapp: '11912345678',
    valorHora: '25', custosFixosPct: '10', taxasPct: '5', margemPct: '20'
  };
  const ok = salvarConfiguracoes(base);
  r.verdadeiro('Configurações: salvar', ok.ok, ok.erro && ok.erro.codigo);
  r.igual('Configurações: nome do arquivo acompanha o negócio',
    SpreadsheetApp.getActive().getName(), MARCA_TESTE + ' Doces — Gestão');

  r.erro('Configurações: percentuais somando 100% recusados', salvarConfiguracoes(Object.assign({}, base, { margemPct: '85' })), 'DD-16');
  r.erro('Configurações: nome vazio recusado', salvarConfiguracoes(Object.assign({}, base, { nomeNegocio: '' })), 'DD-10');

  // Volta aos valores originais antes dos próximos testes (o preço sugerido usa estes números).
  restaurarConfig_(antes.config);
}

function testarClientes_(r) {
  const nome = MARCA_TESTE + ' Carla Souza';
  const c = salvarCliente({ nome: nome, whatsapp: '11912345678', email: 'carla@gmail.com' });
  r.verdadeiro('Cliente: cadastrar', c.ok, c.erro && c.erro.titulo);
  if (c.ok) r.verdadeiro('Cliente: código no formato CLI-0000', /^CLI-\d{4}$/.test(c.dados.codigo), c.dados.codigo);

  const linha = lerTabela(ABA.CLIENTES).find(x => x.nome === nome);
  r.igual('Cliente: WhatsApp gravado formatado', linha && linha.whatsapp, '(11) 91234-5678');

  r.erro('Cliente: nome repetido (maiúsculas e sem acento) recusado',
    salvarCliente({ nome: (MARCA_TESTE + ' CARLA SOUZA') }), 'DD-18');
  r.erro('Cliente: WhatsApp sem DDD recusado', salvarCliente({ nome: MARCA_TESTE + ' Outro', whatsapp: '12345' }), 'DD-19');
  r.erro('Cliente: e-mail incompleto recusado', salvarCliente({ nome: MARCA_TESTE + ' Outro', email: 'x@' }), 'DD-19');
  r.erro('Cliente: nome vazio recusado', salvarCliente({ nome: '' }), 'DD-10');
}

function testarInsumos_(r) {
  // Uma linha digitada à mão com um código à frente do contador não pode ser repetida.
  const manual = 'INS-9' + String(Math.floor(Math.random() * 900) + 100);
  inserirLinha(ABA.INSUMOS, { codigo: manual, nome: MARCA_TESTE + ' Manual', unidade: 'g', custoMedio: 1, ativo: true });
  const depois = salvarInsumo({ nome: MARCA_TESTE + ' Depois do manual', unidade: 'g' });
  const numManual = Number(manual.slice(4));
  r.verdadeiro('Código: continua depois de um código digitado à mão', depois.ok && Number(depois.dados.codigo.slice(4)) === numManual + 1,
    depois.ok ? 'gerou ' + depois.dados.codigo + ' depois de ' + manual : depois.erro.titulo);

  const nome = MARCA_TESTE + ' Farinha';
  const i = salvarInsumo({ nome: nome, unidade: 'g', custoMedio: '0,0065', minimo: '1000', saldoInicial: '5000' });
  r.verdadeiro('Insumo: cadastrar com estoque inicial', i.ok, i.erro && i.erro.titulo);
  if (!i.ok) return null;

  SpreadsheetApp.flush();
  const linha = lerTabela(ABA.INSUMOS).find(x => x.codigo === i.dados.codigo);
  r.perto('Insumo: custo por grama gravado', linha.custoMedio, 0.0065);
  r.perto('Insumo: saldo calculado pelos movimentos', linha.saldo, 5000);
  r.igual('Insumo: situação com saldo acima do mínimo', linha.situacao, 'OK');

  r.erro('Insumo: unidade inválida recusada', salvarInsumo({ nome: MARCA_TESTE + ' X', unidade: 'kg2' }), 'DD-10');
  r.erro('Insumo: custo com letras recusado', salvarInsumo({ nome: MARCA_TESTE + ' X', unidade: 'g', custoMedio: 'abc' }), 'DD-19');
  return i.dados.codigo;
}

function testarProdutos_(r) {
  const p = salvarProduto({ nome: MARCA_TESTE + ' Bolo', tipo: 'Encomenda', unidade: 'un', horas: '1,5', preco: '80' });
  r.verdadeiro('Produto: cadastrar', p.ok, p.erro && p.erro.titulo);
  r.erro('Produto: preço com letras recusado',
    salvarProduto({ nome: MARCA_TESTE + ' Y', tipo: 'Encomenda', unidade: 'un', preco: 'abc' }), 'DD-19');
  r.erro('Produto: nome repetido recusado',
    salvarProduto({ nome: MARCA_TESTE + ' bolo', tipo: 'Encomenda', unidade: 'un' }), 'DD-18');
  return p.ok ? p.dados.codigo : null;
}

function testarFicha_(r, insumo, produto, config) {
  const f = salvarFicha(produto, [{ insumo: insumo, quantidade: '300' }]);
  r.verdadeiro('Ficha técnica: salvar', f.ok, f.erro && f.erro.titulo);
  r.perto('Ficha técnica: custo informado pela janela', f.ok && f.dados.custo, 1.95);

  SpreadsheetApp.flush();
  const linha = lerTabela(ABA.PRODUTOS).find(x => x.codigo === produto);
  r.perto('Produto: custo dos insumos vindo da ficha', linha.custoInsumos, 1.95);
  r.perto('Produto: custo por unidade', linha.custoUnit, 1.95);

  // Mesma conta da especificação, feita aqui à mão para comparar com a fórmula da planilha.
  const hora = Number(config.VALOR_HORA) || 0;
  const fixos = Number(config.CUSTOS_FIXOS_PCT) || 0;
  const taxas = Number(config.TAXAS_PCT) || 0;
  const margem = Number(config.MARGEM_PCT) || 0;
  const sugerido = (1.95 + 1.5 * hora) / (1 - (fixos + taxas + margem));
  const margemReal = (80 * (1 - fixos - taxas) - 1.95 - 1.5 * hora) / 80;
  r.perto('Produto: preço sugerido confere com a conta manual', linha.precoSugerido, sugerido);
  r.perto('Produto: margem líquida confere com a conta manual', linha.margem, margemReal);

  r.erro('Ficha técnica: insumo repetido recusado',
    salvarFicha(produto, [{ insumo: insumo, quantidade: '1' }, { insumo: insumo, quantidade: '2' }]), 'DD-19');
  r.erro('Ficha técnica: quantidade zero recusada', salvarFicha(produto, [{ insumo: insumo, quantidade: '0' }]), 'DD-19');

  const vazia = salvarFicha(produto, []);
  SpreadsheetApp.flush();
  const semFicha = lerTabela(ABA.PRODUTOS).find(x => x.codigo === produto);
  r.verdadeiro('Ficha técnica: remover ficha zera o custo dos insumos', vazia.ok && Number(semFicha.custoInsumos) === 0,
    'custo ficou ' + semFicha.custoInsumos);
}

function testarAtividades_(r) {
  const frases = lerTabela(ABA.ATIVIDADES).map(a => String(a.oque));
  r.verdadeiro('Atividades: cadastro de cliente registrado', frases.some(f => f.indexOf('Cliente cadastrado') === 0));
  r.verdadeiro('Atividades: custo por grama com 4 casas', frases.some(f => f.indexOf('R$ 0,0065 por g') >= 0));
  r.verdadeiro('Atividades: nenhuma frase com JSON ou código técnico',
    !frases.some(f => /[{}\[\]]|undefined|null|Error/.test(f.replace(MARCA_TESTE, ''))));
  const quem = lerTabela(ABA.ATIVIDADES).slice(-1)[0];
  r.verdadeiro('Atividades: registra quem fez', quem && String(quem.quem).length > 0);
}

// ---------- fotografia e limpeza ----------

function fotografar_(ss) {
  const linhas = {};
  ABAS_COM_LINHAS_DE_TESTE.forEach(n => { linhas[n] = ultimaLinhaComDados_(ss.getSheetByName(n)); });
  return { nomeArquivo: ss.getName(), config: lerConfig(), linhas: linhas };
}

function restaurar_(ss, antes) {
  // Apaga, de baixo para cima, tudo que foi criado depois da fotografia.
  ABAS_COM_LINHAS_DE_TESTE.forEach(n => {
    const aba = ss.getSheetByName(n);
    const agora = ultimaLinhaComDados_(aba);
    if (agora > antes.linhas[n]) aba.deleteRows(antes.linhas[n] + 1, agora - antes.linhas[n]);
  });
  restaurarConfig_(antes.config);
  if (ss.getName() !== antes.nomeArquivo) ss.rename(antes.nomeArquivo);
  SpreadsheetApp.flush();
}

/** Grava os valores originais direto na aba Config, sem registrar atividade. */
function restaurarConfig_(original) {
  lerTabela(ABA.CONFIG).forEach(l => {
    if (l.chave in original && String(l.valor) !== String(original[l.chave])) {
      atualizarLinha(ABA.CONFIG, l._linha, { valor: original[l.chave] });
    }
  });
}

// ---------- relatório ----------

function novoRelatorio_() {
  const linhas = [];
  const r = {
    falhas: 0,
    ok: nome => linhas.push('✅ ' + nome),
    falha: (nome, detalhe) => { r.falhas++; linhas.push('❌ ' + nome + (detalhe ? ' — ' + detalhe : '')); },
    verdadeiro: (nome, cond, detalhe) => cond ? r.ok(nome) : r.falha(nome, detalhe ? String(detalhe) : ''),
    igual: (nome, obtido, esperado) => obtido === esperado ? r.ok(nome)
      : r.falha(nome, 'esperado "' + esperado + '", veio "' + obtido + '"'),
    perto: (nome, obtido, esperado) => Math.abs(Number(obtido) - esperado) < 0.0001 ? r.ok(nome)
      : r.falha(nome, 'esperado ' + esperado + ', veio ' + obtido),
    erro: (nome, resposta, codigo) => (resposta && !resposta.ok && resposta.erro.codigo === codigo) ? r.ok(nome)
      : r.falha(nome, 'esperado ' + codigo + ', veio ' + (resposta.ok ? 'sucesso' : resposta.erro.codigo)),
    texto: () => linhas.join('\n') + '\n\n' + (r.falhas ? r.falhas + ' falha(s) em ' : 'Tudo certo: ') + linhas.length + ' verificações.'
  };
  return r;
}

function escaparHtml_(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
