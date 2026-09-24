/**
 * Destrava Digital — Entrada e ajuste de estoque.
 *
 * Regras (especificação v1):
 * - Estoque é de insumos e de produtos de pronta-entrega. Produto de encomenda não tem estoque.
 * - Entrada de insumo é sempre compra: recalcula o custo médio.
 *     saldo > 0: (saldo × custo médio + valor pago) ÷ (saldo + quantidade)
 *     saldo ≤ 0: valor pago ÷ quantidade
 * - Entrada de produto pronto: "Comprei pronto" (revenda, recalcula o custo de compra pela
 *   mesma média) ou "Produzi aqui" (baixa os insumos da ficha técnica; sem dinheiro envolvido).
 * - Compra pode lançar a saída no caixa na mesma hora.
 * - Ajuste corrige o saldo depois de uma contagem: o dono informa quanto tem de verdade e
 *   o motivo (obrigatório). O sistema grava só a diferença.
 * - O saldo nunca é digitado: é sempre a soma dos movimentos.
 */

const MOTIVOS_AJUSTE = ['Contagem de estoque', 'Perda ou quebra', 'Venceu', 'Uso interno ou degustação', 'Brinde ou doação recebida'];

// ---------- janelas ----------

function abrirEntradaEstoque() {
  abrirJanela_('JanelaEstoque', 'Entrada de estoque', 560, 640, { modo: 'entrada' });
}

function abrirAjusteEstoque() {
  abrirJanela_('JanelaEstoque', 'Ajuste de estoque', 560, 600, { modo: 'ajuste' });
}

/** Itens com estoque (insumos ativos e produtos de pronta-entrega ativos), com saldo e custo atuais. */
function carregarDadosEstoque() {
  return executar_('carregarDadosEstoque', () => {
    const saldos = saldosPorItem_();
    const custos = custoAtualDosProdutos_();
    const fichas = agrupar_(lerTabela(ABA.FICHA), f => String(f.produto));
    const insumos = lerTabela(ABA.INSUMOS).filter(i => i.codigo && i.ativo !== false).map(i => ({
      codigo: String(i.codigo), nome: String(i.nome), unidade: String(i.unidade), tipo: 'insumo',
      saldo: saldos[String(i.codigo)] || 0, custo: Number(i.custoMedio) || 0
    }));
    const produtos = lerTabela(ABA.PRODUTOS)
      .filter(p => p.codigo && p.ativo !== false && p.tipo === 'Pronta-entrega')
      .map(p => ({
        codigo: String(p.codigo), nome: String(p.nome), unidade: String(p.unidade), tipo: 'produto',
        saldo: saldos[String(p.codigo)] || 0, custo: custos[String(p.codigo)] || 0,
        custoCompra: Number(p.custoCompra) || 0, temFicha: !!(fichas[String(p.codigo)] || []).length
      }));
    return { insumos: insumos, produtos: produtos, formas: LISTA.FORMA_PAGAMENTO, motivos: MOTIVOS_AJUSTE };
  });
}

// ---------- entrada ----------

/**
 * form: { item, origem ('compra' | 'producao'), quantidade, valorTotal, lancarNoCaixa, forma, obs, confirmado? }
 * Produção pede confirmação quando falta ficha ou algum insumo fica negativo.
 */
function registrarEntrada(form) {
  return executar_('registrarEntrada', () => {
    exigirLicenca_();
    const item = itemDeEstoque_(form.item);
    const q = numero_(form.quantidade);
    if (q === null || q <= 0) throw new ErroDD('DD-19', { campo: 'quantidade', dica: 'Informe uma quantidade maior que zero.' });

    const producao = item.tipo === 'produto' && form.origem === 'producao';
    let valor = 0, forma = '';
    if (!producao) {
      valor = numero_(form.valorTotal);
      if (valor === null || valor <= 0) {
        throw new ErroDD('DD-19', { campo: 'valor pago', dica: 'Informe quanto pagou pela compra inteira, com vírgula para os centavos. Brinde ou doação se registra em Ajuste de estoque.' });
      }
      if (form.lancarNoCaixa) {
        forma = String(form.forma || '');
        if (LISTA.FORMA_PAGAMENTO.indexOf(forma) < 0) throw new ErroDD('DD-10', { campos: 'forma de pagamento' });
      }
    }

    // Produção: planeja a baixa dos insumos antes de gravar.
    let baixas = [];
    if (producao) {
      const plano = planejarBaixaInsumos_([{ produtoCodigo: item.codigo, produto: item.nome, quantidade: q }]);
      const avisos = plano.semFicha.map(nome => montarMensagem_('DD-13', { nome: nome }));
      baixas = plano.baixas;
      const negativos = saldosQueFicamNegativos_(baixas);
      if (negativos.length) avisos.push(montarMensagem_('DD-14', { lista: negativos.join('; ') }));
      if (avisos.length && !form.confirmado) return { confirmar: true, avisos: avisos };
    }

    return comTrava_(() => {
      const saldo = saldosPorItem_()[item.codigo] || 0;
      const obs = texto_(form.obs, 200);
      let custoUnit, frase;

      if (producao) {
        custoUnit = baixas.reduce((s, b) => s + b.quantidade * b.custo, 0) / q;
        baixas.forEach(b => inserirLinha(ABA.MOVIMENTOS, {
          data: new Date(), item: b.item, itemNome: b.nome, tipo: 'Saída por produção', quantidade: -b.quantidade,
          custoUnit: b.custo, pedido: '', quem: quemEsta_(), obs: 'Produção de ' + numeroBR_(q) + ' ' + item.unidade + ' de ' + item.nome
        }));
        frase = 'Produção registrada: ' + numeroBR_(q) + ' ' + item.unidade + ' de ' + item.nome + '.'
          + (baixas.length ? ' Insumos usados: ' + baixas.map(descreverQuantidade_).join(', ') + '.' : ' Sem ficha técnica: nenhum insumo baixado.');
      } else {
        const custoAntes = item.tipo === 'insumo' ? item.custoMedio : item.custoCompra;
        const custoNovo = custoMedioNovo_(saldo, custoAntes, q, valor);
        custoUnit = valor / q;
        if (item.tipo === 'insumo') atualizarLinha(ABA.INSUMOS, item._linha, { custoMedio: custoNovo });
        else atualizarLinha(ABA.PRODUTOS, item._linha, { custoCompra: custoNovo });
        if (forma) {
          lancarCaixa_('Saída', item.tipo === 'insumo' ? 'Compra de insumos' : 'Compra de produtos',
            'Compra de ' + numeroBR_(q) + ' ' + item.unidade + ' de ' + item.nome, valor, forma, '');
        }
        const unitario = item.tipo === 'insumo';
        frase = 'Compra registrada: ' + numeroBR_(q) + ' ' + item.unidade + ' de ' + item.nome + ' por ' + moedaBR_(valor) + '.'
          + (Math.abs(custoNovo - custoAntes) > 1e-9
            ? ' Custo ' + (unitario ? 'médio' : 'de compra') + ' por ' + item.unidade + ': ' + moedaBR_(custoAntes, true) + ' → ' + moedaBR_(custoNovo, true) + '.'
            : '')
          + (forma ? ' Saída lançada no caixa (' + forma + ').' : ' Não lançada no caixa.');
      }

      inserirLinha(ABA.MOVIMENTOS, {
        data: new Date(), item: item.codigo, itemNome: item.nome, tipo: 'Entrada', quantidade: q,
        custoUnit: custoUnit, pedido: '', quem: quemEsta_(), obs: obs || (producao ? 'Produção' : 'Compra')
      });
      registrarAtividade(frase);
      return { saldo: saldo + q, custoUnit: custoUnit };
    });
  });
}

// ---------- ajuste ----------

/** form: { item, saldoReal, motivo, detalhe } — grava a diferença entre o contado e o saldo atual. */
function registrarAjuste(form) {
  return executar_('registrarAjuste', () => {
    exigirLicenca_();
    const item = itemDeEstoque_(form.item);
    if (String(form.saldoReal == null ? '' : form.saldoReal).trim() === '') throw new ErroDD('DD-10', { campos: 'quantidade que tem hoje' });
    const real = numero_(form.saldoReal);
    if (real === null || real < 0) throw new ErroDD('DD-19', { campo: 'quantidade que tem hoje', dica: 'Informe o que contou, zero ou mais, com vírgula para decimais.' });
    const motivo = texto_(form.motivo, 60);
    if (!motivo) throw new ErroDD('DD-10', { campos: 'motivo' });
    const detalhe = texto_(form.detalhe, 150);

    return comTrava_(() => {
      const saldo = saldosPorItem_()[item.codigo] || 0;
      const diferenca = Math.round((real - saldo) * 1000) / 1000;
      if (Math.abs(diferenca) < 1e-9) {
        throw new ErroDD('DD-19', { campo: 'quantidade que tem hoje', dica: 'O saldo de ' + item.nome + ' já é ' + numeroBR_(saldo) + ' ' + item.unidade + '. Não há o que ajustar.' });
      }
      const custo = item.tipo === 'insumo' ? item.custoMedio : (custoAtualDosProdutos_()[item.codigo] || 0);
      inserirLinha(ABA.MOVIMENTOS, {
        data: new Date(), item: item.codigo, itemNome: item.nome, tipo: 'Ajuste', quantidade: diferenca,
        custoUnit: custo, pedido: '', quem: quemEsta_(), obs: motivo + (detalhe ? ': ' + detalhe : '')
      });
      registrarAtividade('Estoque de ' + item.nome + ' ajustado de ' + numeroBR_(saldo) + ' para ' + numeroBR_(real) + ' ' + item.unidade
        + ' (' + (diferenca > 0 ? '+' : '') + numeroBR_(diferenca) + '). Motivo: ' + motivo + (detalhe ? ' — ' + detalhe : '') + '.');
      return { saldo: real, diferenca: diferenca };
    });
  });
}

// ---------- apoio ----------

/** Custo médio ponderado. Saldo zerado ou negativo não entra na média (não há o que ponderar). */
function custoMedioNovo_(saldo, custoAtual, quantidade, valorPago) {
  if (saldo <= 1e-9) return valorPago / quantidade;
  return (saldo * (Number(custoAtual) || 0) + valorPago) / (saldo + quantidade);
}

function saldosPorItem_() {
  const s = {};
  lerTabela(ABA.MOVIMENTOS).forEach(m => { const k = String(m.item); s[k] = (s[k] || 0) + (Number(m.quantidade) || 0); });
  Object.keys(s).forEach(k => { s[k] = Math.round(s[k] * 1000) / 1000; });
  return s;
}

/** Insumo ou produto de pronta-entrega pelo código, com a linha para atualizar o custo. */
function itemDeEstoque_(codigo) {
  const cod = String(codigo || '');
  if (!cod) throw new ErroDD('DD-10', { campos: 'item' });
  const ins = lerTabela(ABA.INSUMOS).find(i => String(i.codigo) === cod);
  if (ins) return { tipo: 'insumo', codigo: cod, nome: String(ins.nome), unidade: String(ins.unidade), custoMedio: Number(ins.custoMedio) || 0, _linha: ins._linha };
  const p = lerTabela(ABA.PRODUTOS).find(x => String(x.codigo) === cod);
  if (p && p.tipo === 'Pronta-entrega') {
    return { tipo: 'produto', codigo: cod, nome: String(p.nome), unidade: String(p.unidade), custoCompra: Number(p.custoCompra) || 0, _linha: p._linha };
  }
  if (p) throw new ErroDD('DD-19', { campo: 'item', dica: p.nome + ' é de encomenda: não tem estoque próprio. O estoque é dos insumos da ficha técnica.' });
  throw new ErroDD('DD-19', { campo: 'item', dica: 'O item ' + cod + ' não foi encontrado em Insumos nem em Produtos.' });
}
