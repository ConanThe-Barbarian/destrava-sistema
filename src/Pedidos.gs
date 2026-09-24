/**
 * Destrava Digital — Pedidos, itens, pagamentos e efeitos no estoque.
 *
 * Regras (especificação v1):
 * - Ciclo: Orçamento → Confirmado → Em produção → Pronto → Entregue. Um passo por vez.
 *   Exceção: pedido só com itens de pronta-entrega pode ir de Confirmado direto para Entregue.
 *   Cancelado a partir de qualquer status que não seja final. Entregue e Cancelado são finais.
 * - Itens só mudam enquanto o pedido é Orçamento.
 * - Preço e custo de cada item são gravados no momento do pedido.
 * - Em produção: baixa os insumos da ficha técnica dos itens de encomenda.
 * - Entregue: baixa o estoque dos itens de pronta-entrega.
 * - Cancelado: estorna tudo que foi baixado; devolução de dinheiro é opcional e sai do caixa.
 * - Estoque insuficiente e produto sem ficha não bloqueiam: pedem confirmação.
 *
 * Toda conta de total, pago e saldo é feita aqui no código a partir das abas de origem,
 * sem depender das colunas calculadas da aba Pedidos (que existem para o dono ler).
 */

const FLUXO_PEDIDO = { 'Orçamento': 'Confirmado', 'Confirmado': 'Em produção', 'Em produção': 'Pronto', 'Pronto': 'Entregue' };
const STATUS_FINAIS = ['Entregue', 'Cancelado'];

// ---------- janelas ----------

function abrirNovoPedido() {
  abrirJanela_('JanelaPedido', 'Novo pedido', 720, 680, { codigo: '' });
}

function abrirEditarPedido(codigo) {
  abrirJanela_('JanelaPedido', 'Alterar pedido ' + codigo, 720, 680, { codigo: String(codigo) });
}

function abrirPedidos() {
  abrirJanela_('JanelaPedidos', 'Pedidos', 720, 680, {});
}

/** Dados de apoio da janela de pedido. Com código, traz também o pedido para edição. */
function carregarDadosPedido(codigo) {
  return executar_('carregarDadosPedido', () => {
    SpreadsheetApp.flush();
    const dados = {
      clientes: lerTabela(ABA.CLIENTES).filter(c => c.codigo).map(c => ({ codigo: String(c.codigo), nome: String(c.nome) })),
      produtos: lerTabela(ABA.PRODUTOS).filter(p => p.codigo && p.ativo !== false).map(p => ({
        codigo: String(p.codigo), nome: String(p.nome), tipo: String(p.tipo), unidade: String(p.unidade),
        preco: Number(p.preco) || 0
      })),
      formas: LISTA.FORMA_PAGAMENTO,
      hoje: hojeIso_()
    };
    if (codigo) {
      const p = lerPedido_(codigo);
      if (p.status !== 'Orçamento') throw new ErroDD('DD-22', { status: p.status });
      dados.pedido = {
        codigo: String(p.codigo), cliente: String(p.cliente), entrega: isoData_(p.entrega),
        desconto: Number(p.desconto) || 0, obs: String(p.obs || ''),
        itens: itensDoPedido_(codigo).map(i => ({ produto: String(i.produtoCodigo), quantidade: Number(i.quantidade), preco: Number(i.precoUnit) }))
      };
    }
    return dados;
  });
}

// ---------- criar e alterar ----------

/**
 * form: { codigo? (edição), cliente, novoCliente?, clienteWhatsapp?, entrega ('AAAA-MM-DD'),
 *         status ('Orçamento' | 'Confirmado'), itens: [{produto, quantidade, preco}], desconto,
 *         sinalValor?, sinalForma?, obs, confirmado? }
 * Devolve { confirmar: true, avisos } quando precisa da confirmação do usuário.
 */
function salvarPedido(form) {
  return executar_('salvarPedido', () => {
    exigirLicenca_();
    const editando = !!form.codigo;
    const existente = editando ? lerPedido_(form.codigo) : null;
    if (existente && existente.status !== 'Orçamento') throw new ErroDD('DD-22', { status: existente.status });

    // Cliente: da lista ou novo.
    const nomeCliente = texto_(form.cliente, 80);
    let clienteNovo = null;
    if (form.novoCliente) {
      clienteNovo = validarCliente_({ nome: nomeCliente, whatsapp: form.clienteWhatsapp });
    } else {
      if (!nomeCliente) throw new ErroDD('DD-10', { campos: 'cliente' });
      if (!lerTabela(ABA.CLIENTES).some(c => normalizar_(c.nome) === normalizar_(nomeCliente))) {
        throw new ErroDD('DD-19', { campo: 'cliente', dica: 'Escolha um cliente da lista, ou marque "Cliente novo" para cadastrar agora.' });
      }
    }

    // Itens.
    const produtos = porCodigo_(lerTabela(ABA.PRODUTOS));
    const itens = (form.itens || []).filter(i => i && (i.produto || String(i.quantidade || '').trim()));
    if (!itens.length) throw new ErroDD('DD-10', { campos: 'pelo menos um item' });
    const limpos = itens.map((i, n) => {
      const p = produtos[String(i.produto)];
      if (!p) throw new ErroDD('DD-10', { campos: 'produto do item ' + (n + 1) });
      const q = numero_(i.quantidade);
      if (q === null || q <= 0) throw new ErroDD('DD-19', { campo: 'quantidade de ' + p.nome, dica: 'Informe uma quantidade maior que zero.' });
      const preco = numeroOpcional_(i.preco, 'preço de ' + p.nome);
      return { produto: p, quantidade: q, preco: preco };
    });

    const subtotal = centavos_(limpos.reduce((s, i) => s + i.quantidade * i.preco, 0));
    const desconto = numeroOpcional_(form.desconto, 'desconto');
    if (desconto > subtotal) throw new ErroDD('DD-19', { campo: 'desconto', dica: 'O desconto não pode ser maior que a soma dos itens (' + moedaBR_(subtotal) + ').' });
    const total = centavos_(subtotal - desconto);

    // Entrega: obrigatória quando há encomenda; no passado pede confirmação.
    const temEncomenda = limpos.some(i => i.produto.tipo === 'Encomenda');
    const entrega = dataDeIso_(form.entrega);
    if (temEncomenda && !entrega) throw new ErroDD('DD-10', { campos: 'data de entrega' });

    const status = editando ? 'Orçamento' : (form.status === 'Confirmado' ? 'Confirmado' : 'Orçamento');
    const sinal = (!editando && status === 'Confirmado') ? numeroOpcional_(form.sinalValor, 'valor do sinal') : 0;
    const forma = String(form.sinalForma || '');
    if (sinal > 0 && LISTA.FORMA_PAGAMENTO.indexOf(forma) < 0) throw new ErroDD('DD-10', { campos: 'forma de pagamento do sinal' });
    if (sinal > total) throw new ErroDD('DD-15', { saldo: moedaBR_(total) });

    if (entrega && entrega < hoje_() && !form.confirmado) {
      return { confirmar: true, avisos: [montarMensagem_('DD-11')] };
    }

    return comTrava_(() => {
      if (clienteNovo) criarCliente_(clienteNovo);
      const nome = clienteNovo ? clienteNovo.nome : nomeClienteCadastrado_(nomeCliente);
      const codigo = editando ? String(existente.codigo) : proximoCodigo('PEDIDO', 'PED');
      const custos = custoAtualDosProdutos_();

      if (editando) {
        atualizarLinha(ABA.PEDIDOS, existente._linha, { cliente: nome, entrega: entrega || '', desconto: desconto, obs: texto_(form.obs, 300) });
        apagarLinhas_(ABA.ITENS, i => String(i.pedido) === codigo);
      } else {
        inserirLinha(ABA.PEDIDOS, {
          codigo: codigo, data: new Date(), cliente: nome, entrega: entrega || '', status: status,
          desconto: desconto, obs: texto_(form.obs, 300)
        });
      }
      limpos.forEach(i => inserirLinha(ABA.ITENS, {
        pedido: codigo, produtoCodigo: i.produto.codigo, produto: i.produto.nome, tipo: i.produto.tipo,
        quantidade: i.quantidade, precoUnit: i.preco, custoUnit: custos[i.produto.codigo] || 0, baixado: false
      }));
      if (sinal > 0) lancarCaixa_('Entrada', 'Venda', 'Sinal do pedido ' + codigo + ' — ' + nome, sinal, forma, codigo);

      const resumo = limpos.length + (limpos.length === 1 ? ' item' : ' itens') + ', total ' + moedaBR_(total)
        + (entrega ? ', entrega em ' + formatarData_(entrega) : '');
      registrarAtividade(editando
        ? 'Pedido ' + codigo + ' alterado: ' + resumo + '.'
        : 'Pedido ' + codigo + ' criado para ' + nome + ' (' + status.toLowerCase() + '): ' + resumo
          + (sinal > 0 ? '. Sinal de ' + moedaBR_(sinal) + ' (' + forma + ')' : '') + '.');
      return { codigo: codigo, total: total };
    });
  });
}

// ---------- status ----------

/**
 * opcoes: { confirmado?: true, devolucaoValor?, devolucaoForma? }
 * Devolve { confirmar: true, avisos } quando o estoque vai ficar negativo ou falta ficha técnica.
 */
function mudarStatus(codigo, novo, opcoes) {
  return executar_('mudarStatus', () => {
    exigirLicenca_();
    opcoes = opcoes || {};
    const p = lerPedido_(codigo);
    const itens = itensDoPedido_(codigo);
    const permitidos = proximosStatus_(p.status, itens);
    if (permitidos.indexOf(novo) < 0) {
      throw new ErroDD('DD-12', { atual: p.status, novo: novo, proximo: permitidos.filter(s => s !== 'Cancelado').join(' ou ') || 'nenhum, este status é final' });
    }

    if (novo === 'Cancelado') return cancelarPedido_(p, itens, opcoes);

    // Planeja as baixas antes de gravar qualquer coisa.
    const baixas = [];
    const avisos = [];
    if (novo === 'Em produção') {
      const plano = planejarBaixaInsumos_(itens.filter(i => i.tipo === 'Encomenda' && i.baixado !== true));
      plano.semFicha.forEach(nome => avisos.push(montarMensagem_('DD-13', { nome: nome })));
      baixas.push.apply(baixas, plano.baixas);
    }
    if (novo === 'Entregue') {
      const produtos = porCodigo_(lerTabela(ABA.PRODUTOS));
      itens.filter(i => i.tipo === 'Pronta-entrega' && i.baixado !== true).forEach(i => {
        const prod = produtos[String(i.produtoCodigo)];
        baixas.push({ item: String(i.produtoCodigo), nome: String(i.produto), quantidade: Number(i.quantidade),
          custo: Number(i.custoUnit) || 0, unidade: prod ? String(prod.unidade) : '' });
      });
    }
    const negativos = saldosQueFicamNegativos_(baixas);
    if (negativos.length) avisos.push(montarMensagem_('DD-14', { lista: negativos.join('; ') }));
    if (avisos.length && !opcoes.confirmado) return { confirmar: true, avisos: avisos };

    return comTrava_(() => {
      baixas.forEach(b => inserirLinha(ABA.MOVIMENTOS, {
        data: new Date(), item: b.item, itemNome: b.nome, tipo: 'Saída por pedido', quantidade: -b.quantidade,
        custoUnit: b.custo, pedido: String(p.codigo), quem: quemEsta_(), obs: novo === 'Em produção' ? 'Produção do pedido' : 'Entrega do pedido'
      }));
      const tiposBaixados = novo === 'Em produção' ? 'Encomenda' : (novo === 'Entregue' ? 'Pronta-entrega' : null);
      if (tiposBaixados) {
        itens.filter(i => i.tipo === tiposBaixados && i.baixado !== true)
          .forEach(i => atualizarLinha(ABA.ITENS, i._linha, { baixado: true }));
      }
      atualizarLinha(ABA.PEDIDOS, p._linha, { status: novo });

      const saldo = saldoDoPedido_(p, itens);
      registrarAtividade('Pedido ' + p.codigo + ': ' + p.status + ' → ' + novo + '.'
        + (baixas.length ? ' Estoque baixado: ' + baixas.map(descreverQuantidade_).join(', ') + '.' : '')
        + (novo === 'Entregue' && saldo > 0 ? ' Entregue com ' + moedaBR_(saldo) + ' a receber.' : ''));
      return { status: novo, saldo: saldo };
    });
  });
}

function cancelarPedido_(p, itens, opcoes) {
  const pago = pagoDoPedido_(String(p.codigo));
  const devolucao = numeroOpcional_(opcoes.devolucaoValor, 'valor devolvido');
  const forma = String(opcoes.devolucaoForma || '');
  if (devolucao > pago + 0.001) throw new ErroDD('DD-23', { valor: moedaBR_(devolucao), pago: moedaBR_(pago) });
  if (devolucao > 0 && LISTA.FORMA_PAGAMENTO.indexOf(forma) < 0) throw new ErroDD('DD-10', { campos: 'forma da devolução' });

  return comTrava_(() => {
    // Estorna o saldo líquido de cada item movimentado por este pedido.
    const liquido = {};
    lerTabela(ABA.MOVIMENTOS).filter(m => String(m.pedido) === String(p.codigo)).forEach(m => {
      const k = String(m.item);
      liquido[k] = liquido[k] || { nome: String(m.itemNome), quantidade: 0, custo: Number(m.custoUnit) || 0 };
      liquido[k].quantidade += Number(m.quantidade) || 0;
    });
    const estornos = Object.keys(liquido).filter(k => liquido[k].quantidade < -1e-9).map(k => ({
      item: k, nome: liquido[k].nome, quantidade: -liquido[k].quantidade, custo: liquido[k].custo
    }));
    estornos.forEach(e => inserirLinha(ABA.MOVIMENTOS, {
      data: new Date(), item: e.item, itemNome: e.nome, tipo: 'Estorno', quantidade: e.quantidade,
      custoUnit: e.custo, pedido: String(p.codigo), quem: quemEsta_(), obs: 'Cancelamento do pedido'
    }));
    itens.filter(i => i.baixado === true).forEach(i => atualizarLinha(ABA.ITENS, i._linha, { baixado: false }));
    if (devolucao > 0) lancarCaixa_('Saída', 'Devolução', 'Devolução do pedido ' + p.codigo + ' — ' + p.cliente, devolucao, forma, String(p.codigo));
    atualizarLinha(ABA.PEDIDOS, p._linha, { status: 'Cancelado' });

    registrarAtividade('Pedido ' + p.codigo + ' cancelado (estava ' + p.status.toLowerCase() + ').'
      + (estornos.length ? ' Estoque devolvido: ' + estornos.map(descreverQuantidade_).join(', ') + '.' : '')
      + (devolucao > 0 ? ' Devolução de ' + moedaBR_(devolucao) + ' (' + forma + ').' : '')
      + (pago - devolucao > 0.001 ? ' Ficou com o negócio: ' + moedaBR_(pago - devolucao) + '.' : ''));
    return { status: 'Cancelado', estornos: estornos.length };
  });
}

// ---------- pagamento ----------

function registrarPagamento(codigo, form) {
  return executar_('registrarPagamento', () => {
    exigirLicenca_();
    const p = lerPedido_(codigo);
    if (p.status === 'Cancelado') throw new ErroDD('DD-12', { atual: 'Cancelado', novo: 'pago', proximo: 'nenhum, este status é final' });
    const valor = numero_(form.valor);
    if (valor === null || valor <= 0) throw new ErroDD('DD-19', { campo: 'valor do pagamento', dica: 'Informe um valor maior que zero, com vírgula para os centavos.' });
    const forma = String(form.forma || '');
    if (LISTA.FORMA_PAGAMENTO.indexOf(forma) < 0) throw new ErroDD('DD-10', { campos: 'forma de pagamento' });

    return comTrava_(() => {
      const saldo = saldoDoPedido_(p, itensDoPedido_(codigo));
      if (valor > saldo + 0.001) throw new ErroDD('DD-15', { saldo: moedaBR_(saldo) });
      lancarCaixa_('Entrada', 'Venda', 'Pagamento do pedido ' + p.codigo + ' — ' + p.cliente, valor, forma, String(p.codigo));
      const restante = centavos_(saldo - valor);
      registrarAtividade('Pagamento de ' + moedaBR_(valor) + ' (' + forma + ') no pedido ' + p.codigo + '. '
        + (restante > 0 ? 'Falta receber ' + moedaBR_(restante) + '.' : 'Pedido quitado.'));
      return { saldo: restante };
    });
  });
}

// ---------- lista para a janela ----------

function listarPedidos() {
  return executar_('listarPedidos', () => {
    const itensPor = agrupar_(lerTabela(ABA.ITENS), i => String(i.pedido));
    const caixaPor = agrupar_(lerTabela(ABA.CAIXA).filter(c => c.pedido), c => String(c.pedido));
    const hoje = hoje_();
    return lerTabela(ABA.PEDIDOS).filter(p => p.codigo).reverse().map(p => {
      const cod = String(p.codigo);
      const itens = itensPor[cod] || [];
      const movs = caixaPor[cod] || [];
      const total = totalDoPedido_(p, itens);
      const pago = centavos_(movs.reduce((s, c) => s + (c.tipo === 'Entrada' ? 1 : -1) * (Number(c.valor) || 0), 0));
      const entrega = p.entrega instanceof Date ? p.entrega : null;
      return {
        codigo: cod, cliente: String(p.cliente), status: String(p.status),
        data: formatarData_(p.data), entrega: entrega ? formatarData_(entrega) : '',
        atrasado: !!entrega && entrega < hoje && STATUS_FINAIS.indexOf(p.status) < 0,
        total: total, pago: pago, saldo: p.status === 'Cancelado' ? 0 : centavos_(total - pago),
        desconto: Number(p.desconto) || 0, obs: String(p.obs || ''),
        itens: itens.map(i => ({ produto: String(i.produto), tipo: String(i.tipo), quantidade: Number(i.quantidade), preco: Number(i.precoUnit) })),
        pagamentos: movs.map(c => ({ data: formatarData_(c.data), tipo: String(c.tipo), valor: Number(c.valor), forma: String(c.forma), descricao: String(c.descricao) })),
        proximos: proximosStatus_(p.status, itens)
      };
    });
  });
}

// ---------- regras e apoio ----------

function proximosStatus_(atual, itens) {
  const r = [];
  if (FLUXO_PEDIDO[atual]) r.push(FLUXO_PEDIDO[atual]);
  if (atual === 'Confirmado' && itens.length && itens.every(i => i.tipo === 'Pronta-entrega')) r.push('Entregue');
  if (STATUS_FINAIS.indexOf(atual) < 0) r.push('Cancelado');
  return r;
}

function planejarBaixaInsumos_(itensEncomenda) {
  const ficha = agrupar_(lerTabela(ABA.FICHA), f => String(f.produto));
  const insumos = porCodigo_(lerTabela(ABA.INSUMOS));
  const consumo = {};
  const semFicha = [];
  itensEncomenda.forEach(i => {
    const linhas = ficha[String(i.produtoCodigo)] || [];
    if (!linhas.length) { if (semFicha.indexOf(String(i.produto)) < 0) semFicha.push(String(i.produto)); return; }
    linhas.forEach(l => { consumo[String(l.insumo)] = (consumo[String(l.insumo)] || 0) + Number(l.quantidade) * Number(i.quantidade); });
  });
  const baixas = Object.keys(consumo).filter(k => insumos[k]).map(k => ({
    item: k, nome: String(insumos[k].nome), quantidade: consumo[k],
    custo: Number(insumos[k].custoMedio) || 0, unidade: String(insumos[k].unidade)
  }));
  return { baixas: baixas, semFicha: semFicha };
}

function saldosQueFicamNegativos_(baixas) {
  if (!baixas.length) return [];
  const saldo = {};
  lerTabela(ABA.MOVIMENTOS).forEach(m => { saldo[String(m.item)] = (saldo[String(m.item)] || 0) + (Number(m.quantidade) || 0); });
  return baixas.filter(b => (saldo[b.item] || 0) - b.quantidade < -1e-9)
    .map(b => b.nome + ' (fica com ' + numeroBR_((saldo[b.item] || 0) - b.quantidade) + ' ' + b.unidade + ')');
}

function lerPedido_(codigo) {
  const p = lerTabela(ABA.PEDIDOS).find(r => String(r.codigo) === String(codigo));
  if (!p) throw new ErroDD('DD-19', { campo: 'pedido', dica: 'O pedido ' + codigo + ' não foi encontrado na aba Pedidos.' });
  return p;
}

function itensDoPedido_(codigo) {
  return lerTabela(ABA.ITENS).filter(i => String(i.pedido) === String(codigo));
}

function totalDoPedido_(p, itens) {
  return centavos_(itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.precoUnit), 0) - (Number(p.desconto) || 0));
}

function pagoDoPedido_(codigo) {
  return centavos_(lerTabela(ABA.CAIXA).filter(c => String(c.pedido) === String(codigo))
    .reduce((s, c) => s + (c.tipo === 'Entrada' ? 1 : -1) * (Number(c.valor) || 0), 0));
}

function saldoDoPedido_(p, itens) {
  return centavos_(totalDoPedido_(p, itens) - pagoDoPedido_(String(p.codigo)));
}

/** Custo por unidade atual de cada produto: custo de compra + insumos da ficha (mesma conta da aba Produtos). */
function custoAtualDosProdutos_() {
  const insumos = porCodigo_(lerTabela(ABA.INSUMOS));
  const custoFicha = {};
  lerTabela(ABA.FICHA).forEach(f => {
    const ins = insumos[String(f.insumo)];
    custoFicha[String(f.produto)] = (custoFicha[String(f.produto)] || 0) + Number(f.quantidade) * (ins ? Number(ins.custoMedio) || 0 : 0);
  });
  const r = {};
  lerTabela(ABA.PRODUTOS).forEach(p => { r[String(p.codigo)] = (Number(p.custoCompra) || 0) + (custoFicha[String(p.codigo)] || 0); });
  return r;
}

function nomeClienteCadastrado_(nome) {
  const c = lerTabela(ABA.CLIENTES).find(x => normalizar_(x.nome) === normalizar_(nome));
  return c ? String(c.nome) : nome;
}

function lancarCaixa_(tipo, categoria, descricao, valor, forma, pedido) {
  inserirLinha(ABA.CAIXA, { data: new Date(), tipo: tipo, categoria: categoria, descricao: descricao, valor: centavos_(valor), forma: forma, pedido: pedido || '' });
}

/** Apaga, de baixo para cima, as linhas de uma aba que atendem ao filtro. */
function apagarLinhas_(nomeAba, filtro) {
  const aba = aba_(nomeAba);
  lerTabela_(aba).filter(filtro).map(r => r._linha).sort((a, b) => b - a).forEach(l => aba.deleteRow(l));
}

function descreverQuantidade_(b) {
  return b.nome + ' ' + numeroBR_(b.quantidade) + (b.unidade ? ' ' + b.unidade : '');
}

function porCodigo_(linhas) {
  return linhas.reduce((m, r) => { if (r.codigo) m[String(r.codigo)] = r; return m; }, {});
}

function agrupar_(linhas, chave) {
  return linhas.reduce((m, r) => { const k = chave(r); (m[k] = m[k] || []).push(r); return m; }, {});
}

function centavos_(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function numeroBR_(n) {
  const v = Math.round((Number(n) || 0) * 1000) / 1000;
  return String(v).replace('.', ',');
}

// ---------- datas ----------

function hoje_() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function hojeIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** 'AAAA-MM-DD' → Date à meia-noite no fuso do script. Vazio → null. Inválido → DD-19. */
function dataDeIso_(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new ErroDD('DD-19', { campo: 'data de entrega', dica: 'Escolha a data no calendário do campo.' });
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoData_(d) {
  return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}

function formatarData_(d) {
  return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy') : '';
}
