/**
 * Destrava Digital — Núcleo.
 *
 * Tudo que as funcionalidades usam: leitura e gravação por esquema, configurações,
 * contadores de código, trava de concorrência, mensagens de erro DD, registro de
 * atividades e a ponte com as janelas (HtmlService).
 */

// ---------- mensagens de erro (texto final das janelas e do manual) ----------

const MENSAGENS = {
  'DD-01': { titulo: 'Esta planilha ainda não foi ativada.', acao: 'Abra Destrava › Licença e cole a chave recebida por e-mail.' },
  'DD-02': { titulo: 'Esta chave não existe.', acao: 'Confira se copiou a chave inteira, sem espaços, do e-mail de compra.' },
  'DD-03': { titulo: 'Esta chave já usou todas as ativações do plano.', acao: 'Clique em "Aumentar meu plano" para comprar mais vagas na hora, ou peça ao suporte para liberar a vaga de um cliente que não usa mais.' },
  'DD-04': { titulo: 'Esta licença foi cancelada. Você ainda pode ver todos os dados, mas não pode alterar.', acao: 'Fale com quem instalou o sistema (contato no rodapé).' },
  'DD-05': { titulo: 'Não conseguimos confirmar a licença agora. A planilha está só para leitura até a confirmação.', acao: 'Verifique a internet e tente de novo em alguns minutos. Se continuar, fale com quem instalou.' },
  'DD-10': { titulo: 'Falta preencher: {campos}.', acao: 'Preencha os campos destacados em vermelho.' },
  'DD-11': { titulo: 'A data de entrega está no passado.', acao: 'Corrija a data ou confirme que é um pedido já entregue.' },
  'DD-12': { titulo: 'Este pedido não pode ir de {atual} para {novo}.', acao: 'Avance um passo por vez: {proximo}.' },
  'DD-13': { titulo: 'O produto {nome} não tem ficha técnica. O estoque de insumos não será baixado.', acao: 'Cadastre a ficha em Destrava › Ficha técnica, ou confirme para seguir sem baixa.' },
  'DD-14': { titulo: 'Estes itens vão ficar com estoque negativo: {lista}.', acao: 'Confirme para seguir e registre a compra ou a produção depois, na entrada de estoque.' },
  'DD-15': { titulo: 'O pagamento é maior que o saldo do pedido ({saldo}).', acao: 'Corrija o valor. Se for gorjeta ou acréscimo, lance a diferença no caixa como entrada avulsa.' },
  'DD-16': { titulo: 'A soma de custos fixos, taxas e margem passa de 100%. Nenhum preço consegue cobrir isso.', acao: 'Reduza algum dos percentuais em Configurações.' },
  'DD-17': { titulo: 'Não foi possível carregar o logo.', acao: 'Confira se o link da imagem no Drive está compartilhado como "Qualquer pessoa com o link".' },
  'DD-18': { titulo: 'Já existe {tipo} com o nome "{nome}".', acao: 'Use um nome diferente, ou altere o cadastro que já existe direto na aba {aba}.' },
  'DD-19': { titulo: 'O campo {campo} não parece válido.', acao: '{dica}' },
  'DD-22': { titulo: 'Os itens só podem ser alterados enquanto o pedido é orçamento. Este pedido está como {status}.', acao: 'Para mudar o que foi pedido, cancele este pedido e crie um novo.' },
  'DD-23': { titulo: 'A devolução ({valor}) é maior que o valor pago no pedido ({pago}).', acao: 'Informe no máximo o que o cliente pagou, ou deixe em branco se não houve devolução.' },
  'DD-20': { titulo: 'Outra pessoa está salvando algo agora.', acao: 'Aguarde alguns segundos e tente de novo.' },
  'DD-21': { titulo: 'Uma aba do sistema foi apagada ou renomeada: {aba}.', acao: 'Desfaça a alteração (Ctrl+Z) ou restaure a versão anterior em Arquivo › Histórico de versões.' },
  'DD-99': { titulo: 'Algo deu errado e nada foi salvo.', acao: 'Tente de novo. Se repetir, envie o código DD-99 e o horário para quem instalou o sistema.' }
};

/** Erro conhecido, com código DD e valores para completar o texto. */
class ErroDD extends Error {
  constructor(codigo, valores) {
    super(codigo);
    this.codigo = codigo;
    this.valores = valores || {};
  }
}

function montarMensagem_(codigo, valores) {
  const base = MENSAGENS[codigo] || MENSAGENS['DD-99'];
  const preencher = t => t.replace(/\{(\w+)\}/g, (_, k) => (valores && valores[k] !== undefined) ? valores[k] : '');
  return { codigo: MENSAGENS[codigo] ? codigo : 'DD-99', titulo: preencher(base.titulo), acao: preencher(base.acao) };
}

// ---------- ponte com as janelas ----------

/**
 * Toda função chamada pelas janelas passa por aqui.
 * Devolve sempre { ok: true, dados } ou { ok: false, erro: { codigo, titulo, acao } }.
 * Erro inesperado vira DD-99 para o usuário; o detalhe técnico vai só para o registro
 * de execuções do Apps Script (console), nunca para a tela.
 * O JSON.parse(JSON.stringify()) evita o bug do Apps Script que devolve null quando
 * o objeto tem Date.
 */
function executar_(nomeAcao, fn) {
  try {
    verificarAbas_();
    const dados = fn();
    return JSON.parse(JSON.stringify({ ok: true, dados: dados === undefined ? null : dados }));
  } catch (e) {
    if (e instanceof ErroDD) return { ok: false, erro: montarMensagem_(e.codigo, e.valores) };
    console.error('[' + nomeAcao + '] ' + (e && e.stack ? e.stack : e));
    return { ok: false, erro: montarMensagem_('DD-99') };
  }
}

/** Executa uma gravação com trava do documento. Sem trava em 10 s → DD-20. */
function comTrava_(fn) {
  const trava = LockService.getDocumentLock();
  if (!trava.tryLock(10000)) throw new ErroDD('DD-20');
  try { return fn(); } finally { trava.releaseLock(); }
}

function verificarAbas_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(ESQUEMA).forEach(nome => {
    if (!ss.getSheetByName(nome)) throw new ErroDD('DD-21', { aba: nome });
  });
}

// ---------- leitura e gravação por esquema ----------

function aba_(nome) {
  const a = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!a) throw new ErroDD('DD-21', { aba: nome });
  return a;
}

/** Lê a aba inteira como lista de objetos { chave: valor }, ignorando linhas sem a 1ª coluna. */
function lerTabela_(aba) {
  const nome = aba.getName();
  const cols = ESQUEMA[nome].colunas;
  const ultima = ultimaLinhaComDados_(aba);
  if (ultima < 2) return [];
  const valores = aba.getRange(2, 1, ultima - 1, cols.length).getValues();
  return valores.map((linha, i) => {
    const obj = { _linha: i + 2 };
    cols.forEach((c, j) => { obj[c.chave] = linha[j]; });
    return obj;
  });
}

function lerTabela(nome) { return lerTabela_(aba_(nome)); }

/**
 * Última linha com valor na 1ª coluna. getLastRow() não serve: as ARRAYFORMULA
 * e as caixas de seleção "ocupam" a coluna inteira.
 */
function ultimaLinhaComDados_(aba) {
  const max = aba.getMaxRows();
  if (max < 2) return 1;
  const col = aba.getRange(2, 1, max - 1, 1).getValues();
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i][0] !== '' && col[i][0] !== null) return i + 2;
  }
  return 1;
}

/**
 * Grava uma linha nova preenchendo SÓ as colunas de entrada (nunca as de fórmula,
 * senão a ARRAYFORMULA quebra). Devolve o número da linha gravada.
 */
function inserirLinha(nome, obj) {
  const aba = aba_(nome);
  const cols = ESQUEMA[nome].colunas;
  let linha = ultimaLinhaComDados_(aba) + 1;
  if (linha > aba.getMaxRows()) {
    aba.insertRowsAfter(aba.getMaxRows(), 200);
  }
  cols.forEach((c, i) => {
    if (c.formula) return;
    if (!(c.chave in obj)) return;
    aba.getRange(linha, i + 1).setValue(obj[c.chave]);
  });
  return linha;
}

/** Atualiza colunas de entrada de uma linha existente. */
function atualizarLinha(nome, linha, obj) {
  const aba = aba_(nome);
  const idx = indices(nome);
  const cols = ESQUEMA[nome].colunas;
  Object.keys(obj).forEach(chave => {
    const col = cols[idx[chave] - 1];
    if (!col) throw new Error('Coluna inexistente: ' + nome + '.' + chave);
    if (col.formula) throw new Error('Tentativa de gravar em coluna calculada: ' + nome + '.' + chave);
    aba.getRange(linha, idx[chave]).setValue(obj[chave]);
  });
}

// ---------- configurações ----------

function lerConfig() {
  return lerTabela(ABA.CONFIG).reduce((m, r) => { m[r.chave] = r.valor; return m; }, {});
}

/** Salva pares chave → valor na aba Config. Chaves desconhecidas são recusadas. */
function salvarConfig(pares, opcoes) {
  const linhas = lerTabela(ABA.CONFIG);
  const alteradas = [];
  Object.keys(pares).forEach(chave => {
    const r = linhas.find(l => l.chave === chave);
    if (!r) throw new Error('Configuração desconhecida: ' + chave);
    if (String(r.valor) !== String(pares[chave])) {
      atualizarLinha(ABA.CONFIG, r._linha, { valor: pares[chave] });
      alteradas.push(chave);
    }
  });
  if (alteradas.length && !(opcoes && opcoes.semAtividade)) {
    registrarAtividade('Configurações alteradas: ' + alteradas.map(nomeLegivelConfig_).join(', ') + '.');
  }
  return alteradas;
}

function nomeLegivelConfig_(chave) {
  const item = CONFIG_PADRAO.find(i => i.chave === chave);
  return item && item.rotulo ? item.rotulo : chave;
}

const ABA_DO_CONTADOR = { PEDIDO: ABA.PEDIDOS, CLIENTE: ABA.CLIENTES, PRODUTO: ABA.PRODUTOS, INSUMO: ABA.INSUMOS };

/**
 * Próximo código legível, ex.: proximoCodigo('PEDIDO', 'PED') → 'PED-0042'. Chamar dentro de comTrava_.
 * Usa o maior entre o contador e o maior código que já existe na aba. Assim, uma linha
 * digitada à mão com um código (ex.: INS-0001) nunca faz o sistema repetir esse código.
 */
function proximoCodigo(tipo, prefixo) {
  const chave = 'CONTADOR_' + tipo;
  const contador = Number(lerConfig()[chave]) || 0;
  const padrao = new RegExp('^' + prefixo + '-(\\d+)$');
  const maiorNaAba = lerTabela(ABA_DO_CONTADOR[tipo]).reduce((max, r) => {
    const m = String(r.codigo).trim().match(padrao);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const novo = Math.max(contador, maiorNaAba) + 1;
  salvarConfig({ [chave]: novo }, { semAtividade: true });
  return prefixo + '-' + String(novo).padStart(4, '0');
}

// ---------- atividades ----------

/**
 * E-mail de quem está usando, para o registro de atividades.
 * Contas pessoais do Google só informam o e-mail para o dono do script; nos
 * outros casos vem vazio. O registro nunca pode travar uma gravação por isso.
 */
function quemEsta_() {
  try {
    return Session.getActiveUser().getEmail() || 'Usuário da planilha';
  } catch (e) {
    return 'Usuário da planilha';
  }
}

/** Registra uma frase legível. Nunca JSON, nunca ID técnico. */
function registrarAtividade(frase) {
  inserirLinha(ABA.ATIVIDADES, { data: new Date(), quem: quemEsta_(), oque: frase });
}

// ---------- janelas ----------

/** Abre uma janela (modal) a partir de um arquivo HTML, já com a marca do cliente. */
function abrirJanela_(arquivo, titulo, largura, altura, parametros) {
  const t = HtmlService.createTemplateFromFile(arquivo);
  // Vão para o HTML como JSON; "<" escapado para um texto do usuário nunca fechar a tag <script>.
  t.marcaJson = jsonSeguro_(marcaAtual_());
  t.parametrosJson = jsonSeguro_(parametros || {});
  const html = t.evaluate().setWidth(largura || 560).setHeight(altura || 560);
  SpreadsheetApp.getUi().showModalDialog(html, titulo);
}

function jsonSeguro_(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/** Inclui um arquivo HTML dentro de outro (estilo e script compartilhados). */
function incluir(arquivo) {
  return HtmlService.createHtmlOutputFromFile(arquivo).getContent();
}

function marcaAtual_() {
  const c = lerConfig();
  const licenca = lerLicencaLocal_();
  return {
    nome: String(c.NOME_NEGOCIO || 'Meu Negócio'),
    logo: urlLogo_(String(c.LOGO_URL || '')),
    cor: /^#[0-9a-f]{6}$/i.test(String(c.COR_PRINCIPAL)) ? String(c.COR_PRINCIPAL) : '#8b7bff',
    implantador: String(c.IMPLANTADOR_NOME || ''),
    whatsapp: String(c.IMPLANTADOR_WHATSAPP || ''),
    mostrarMarcaDestrava: licenca.mostrarMarca !== false
  };
}

/**
 * Converte um link do Drive no formato de miniatura, o único confiável em <img>.
 * Aceita links /file/d/ID/..., ?id=ID ou o próprio ID.
 */
function urlLogo_(link) {
  if (!link) return '';
  const m = link.match(/\/d\/([\w-]{20,})/) || link.match(/[?&]id=([\w-]{20,})/) || link.match(/^([\w-]{20,})$/);
  if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w200';
  return /^https:\/\//.test(link) ? link : '';
}

// ---------- utilitários de texto ----------

/** Texto limpo e limitado. Impede que um texto comece com =, +, - ou @ e vire fórmula. */
function texto_(v, max) {
  let s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function formatarWhats_(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return d;
}

/** Reais com 2 casas; custos unitários abaixo de R$ 1 (ex.: preço por grama) ganham 4 casas. */
function moedaBR_(n, unitario) {
  const v = Number(n) || 0;
  const casas = unitario && Math.abs(v) < 1 ? 4 : 2;
  const partes = v.toFixed(casas).split('.');
  return 'R$ ' + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
}
