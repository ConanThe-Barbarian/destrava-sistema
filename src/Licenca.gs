/**
 * Destrava Digital — Licença (lado da planilha).
 *
 * Regras (especificação da API de licenças):
 * - Sem carência: a planilha só GRAVA com a aprovação do dia vinda do servidor. LER nunca depende disso.
 * - A aprovação vale até 23:59 de São Paulo (o servidor calcula o "válido até"; a planilha compara com
 *   o relógio dos servidores do Google, que o usuário não controla).
 * - A ativação fica presa ao ID desta planilha. Uma cópia tem outro ID: precisa de ativação própria,
 *   e a aprovação copiada junto com o arquivo não vale nela.
 * - Tudo fica nas propriedades do documento, nunca numa aba (o usuário não altera sem querer).
 *
 * MODO_DESENVOLVIMENTO libera tudo enquanto desenvolvemos. Passa a false ANTES de gerar o modelo de venda.
 */

const MODO_DESENVOLVIMENTO = true;
const URL_API_LICENCAS = 'https://licencas.stellarsyntec.com.br';
const PROP_LICENCA = 'DESTRAVA_LICENCA';
const FORMATO_CHAVE = /^DD-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

// Os testes trocam estes dois para simular o servidor sem chamar a internet.
let apiLicenca_ = chamarApiLicencas_;
let testandoLicenca_ = false;

// ---------- a porta de toda gravação ----------

/** Chamada no início de toda ação que grava. Lança ErroDD se não puder gravar. */
function exigirLicenca_() {
  if (MODO_DESENVOLVIMENTO && !testandoLicenca_) return;
  const l = lerLicencaLocal_();
  if (!l.chave || l.planilhaId !== idPlanilha_()) throw new ErroDD('DD-01');
  if (l.situacao === 'APROVADA' && l.validoAte && new Date(l.validoAte) > new Date()) return;
  aprovarHoje_(l); // lança ErroDD se não aprovar
}

/** Pede a aprovação do dia ao servidor e guarda a resposta. */
function aprovarHoje_(l) {
  const r = apiLicenca_('/v1/aprovacoes', { chave: l.chave, planilhaId: idPlanilha_() });
  const agora = new Date().toISOString();
  if (r.status === 200 && r.corpo.codigo === 'APROVADO') {
    salvarLicencaLocal_(Object.assign({}, l, dadosDoToken_(r.corpo.token), { situacao: 'APROVADA', conferidaEm: agora }));
    return;
  }
  if (r.corpo && r.corpo.codigo === 'REVOGADA') {
    salvarLicencaLocal_(Object.assign({}, l, { situacao: 'REVOGADA', validoAte: '', conferidaEm: agora }));
    throw new ErroDD('DD-04');
  }
  if (r.corpo && r.corpo.codigo === 'NAO_ATIVADA') {
    // Vaga liberada no suporte: precisa ativar de novo.
    salvarLicencaLocal_(Object.assign({}, l, { situacao: 'NAO_ATIVADA', validoAte: '', conferidaEm: agora }));
    throw new ErroDD('DD-01');
  }
  throw new ErroDD('DD-05'); // sem resposta, servidor fora, limite de chamadas ou resposta inesperada
}

// ---------- janela Destrava › Licença ----------

function abrirLicenca() {
  abrirJanela_('JanelaLicenca', 'Licença', 520, 560, {});
}

/** Situação para a janela, sem dados técnicos. */
function carregarLicenca() {
  return executar_('carregarLicenca', () => {
    const l = lerLicencaLocal_();
    const ativada = !!l.chave && l.planilhaId === idPlanilha_() && l.situacao !== 'NAO_ATIVADA';
    return {
      desenvolvimento: MODO_DESENVOLVIMENTO,
      ativada: ativada,
      situacao: ativada ? l.situacao : 'NAO_ATIVADA',
      chave: ativada ? mascararChave_(l.chave) : '',
      cliente: ativada ? String(l.cliente || '') : '',
      plano: ativada ? (NOME_PLANO_[l.plano] || '') : '',
      usadas: ativada ? Number(l.usadas) || 0 : 0,
      limite: ativada ? Number(l.limite) || 0 : 0,
      aprovadaHoje: ativada && l.situacao === 'APROVADA' && !!l.validoAte && new Date(l.validoAte) > new Date(),
      clienteSugerido: String(lerConfig().NOME_NEGOCIO || '')
    };
  });
}

/**
 * form: { chave, cliente }. Ativa esta planilha com a chave.
 * Limite atingido não é erro de digitação: volta com o link de upgrade para a janela mostrar o botão.
 */
function ativarLicenca(form) {
  return executar_('ativarLicenca', () => {
    const chave = normalizarChave_(form.chave);
    if (!chave) throw new ErroDD('DD-19', { campo: 'chave', dica: 'A chave tem o formato DD-XXXX-XXXX-XXXX. Copie do e-mail de compra.' });
    const cliente = texto_(form.cliente, 120).replace(/\s+/g, ' ').trim();
    if (cliente.length < 2) throw new ErroDD('DD-10', { campos: 'nome do cliente' });

    const r = apiLicenca_('/v1/ativacoes', { chave: chave, planilhaId: idPlanilha_(), cliente: cliente });
    const codigo = r.corpo && r.corpo.codigo;
    if ((r.status === 201 || r.status === 200) && (codigo === 'ATIVADA' || codigo === 'JA_ATIVADA')) {
      const agora = new Date().toISOString();
      salvarLicencaLocal_(Object.assign({ chave: chave, cliente: cliente, planilhaId: idPlanilha_(), situacao: 'APROVADA',
        ativadaEm: agora, conferidaEm: agora, usadas: r.corpo.usadas, limite: r.corpo.limite }, dadosDoToken_(r.corpo.token)));
      registrarAtividade('Planilha ativada para ' + cliente + ' (plano ' + (NOME_PLANO_[r.corpo.token.plano] || 'desconhecido')
        + ', ' + r.corpo.usadas + ' de ' + r.corpo.limite + ' ativações em uso).');
      return { ativada: true, jaEstava: codigo === 'JA_ATIVADA', usadas: r.corpo.usadas, limite: r.corpo.limite };
    }
    if (codigo === 'LIMITE_ATINGIDO') {
      return { ativada: false, limiteAtingido: true, erro: montarMensagem_('DD-03'),
        usadas: r.corpo.usadas, limite: r.corpo.limite, linkUpgrade: linkSeguro_(r.corpo.linkUpgrade) };
    }
    if (codigo === 'CHAVE_INEXISTENTE') throw new ErroDD('DD-02');
    if (codigo === 'REVOGADA') throw new ErroDD('DD-04');
    if (codigo === 'DADOS_INVALIDOS') throw new ErroDD('DD-19', { campo: 'chave', dica: 'Confira a chave e o nome do cliente.' });
    throw new ErroDD('DD-05');
  });
}

/** Botão "Conferir agora": pede a aprovação do dia na hora (útil depois de uma reativação no suporte). */
function conferirLicenca() {
  return executar_('conferirLicenca', () => {
    const l = lerLicencaLocal_();
    if (!l.chave || l.planilhaId !== idPlanilha_()) throw new ErroDD('DD-01');
    aprovarHoje_(l);
    return { aprovada: true };
  });
}

// ---------- apoio ----------

const NOME_PLANO_ = { FUNDADOR: 'Fundador', FREELANCER: 'Freelancer', AGENCIA: 'Agência' };

function lerLicencaLocal_() {
  const p = PropertiesService.getDocumentProperties().getProperty(PROP_LICENCA);
  if (!p) return { mostrarMarca: true };
  try { return JSON.parse(p); } catch (e) { return { mostrarMarca: true }; }
}

function salvarLicencaLocal_(l) {
  PropertiesService.getDocumentProperties().setProperty(PROP_LICENCA, JSON.stringify(l));
}

function dadosDoToken_(t) {
  t = t || {};
  return { plano: String(t.plano || ''), mostrarMarca: t.mostrarMarca !== false, validoAte: String(t.validoAte || '') };
}

function idPlanilha_() {
  return SpreadsheetApp.getActive().getId();
}

/** Aceita a chave com minúsculas, espaços ou sem hífens; devolve DD-XXXX-XXXX-XXXX ou null. */
function normalizarChave_(texto) {
  const s = String(texto || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^DD[0-9A-Z]{12}$/.test(s)) return null;
  const chave = 'DD-' + s.slice(2, 6) + '-' + s.slice(6, 10) + '-' + s.slice(10, 14);
  return FORMATO_CHAVE.test(chave) ? chave : null;
}

/** Na janela, só o fim da chave aparece: quem usa a planilha do cliente não copia a chave do freelancer. */
function mascararChave_(chave) {
  return 'DD-••••-••••-' + String(chave).slice(-4);
}

/** Só links de checkout da Hotmart viram botão. */
function linkSeguro_(link) {
  return /^https:\/\/(pay|go)\.hotmart\.com\//.test(String(link || '')) ? String(link) : '';
}

/** POST JSON na API. Nunca lança: falha de rede vira { status: 0 }. */
function chamarApiLicencas_(rota, dados) {
  try {
    const resp = UrlFetchApp.fetch(URL_API_LICENCAS + rota, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(dados),
      muteHttpExceptions: true, followRedirects: false
    });
    let corpo = {};
    try { corpo = JSON.parse(resp.getContentText()); } catch (e) { corpo = {}; }
    return { status: resp.getResponseCode(), corpo: corpo };
  } catch (e) {
    console.warn('[licença] sem resposta da API: ' + e);
    return { status: 0, corpo: {} };
  }
}
