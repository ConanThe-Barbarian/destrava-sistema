/**
 * Destrava Digital — Caixa: lançamentos avulsos e visão do mês.
 *
 * Regras:
 * - Pedidos lançam o próprio dinheiro (sinal, pagamento, devolução). Aqui entram só os
 *   lançamentos avulsos: contas, embalagens, aporte, retirada do dono etc.
 * - Data de hoje ou do passado (para lançar algo esquecido). Data futura é recusada.
 * - Só lançamento avulso pode ser excluído. O que veio de um pedido se corrige pelo pedido.
 */

function abrirCaixa() {
  abrirJanela_('JanelaCaixa', 'Caixa', 640, 680, {});
}

/** mes: 'AAAA-MM' (vazio = mês atual). Devolve lançamentos do mês e o resumo. */
function carregarCaixa(mes) {
  return executar_('carregarCaixa', () => {
    const tz = Session.getScriptTimeZone();
    const alvo = /^\d{4}-\d{2}$/.test(String(mes || '')) ? String(mes) : Utilities.formatDate(new Date(), tz, 'yyyy-MM');
    const doMes = lerTabela(ABA.CAIXA).filter(c => c.data instanceof Date && Utilities.formatDate(c.data, tz, 'yyyy-MM') === alvo);
    let entradas = 0, saidas = 0;
    const lancamentos = doMes.map(c => {
      const valor = Number(c.valor) || 0;
      if (c.tipo === 'Entrada') entradas += valor; else saidas += valor;
      return {
        linha: c._linha, data: formatarData_(c.data), tipo: String(c.tipo), categoria: String(c.categoria),
        descricao: String(c.descricao), valor: valor, forma: String(c.forma), pedido: String(c.pedido || ''),
        assinatura: assinaturaCaixa_(c)
      };
    }).reverse();
    return {
      mes: alvo, hoje: hojeIso_(), lancamentos: lancamentos,
      entradas: centavos_(entradas), saidas: centavos_(saidas), resultado: centavos_(entradas - saidas),
      categorias: { Entrada: LISTA.CATEGORIA_ENTRADA, 'Saída': LISTA.CATEGORIA_SAIDA }, formas: LISTA.FORMA_PAGAMENTO
    };
  });
}

/** form: { tipo, categoria, descricao, valor, forma, data ('AAAA-MM-DD') } */
function lancarNoCaixa(form) {
  return executar_('lancarNoCaixa', () => {
    exigirLicenca_();
    const tipo = String(form.tipo || '');
    if (LISTA.TIPO_CAIXA.indexOf(tipo) < 0) throw new ErroDD('DD-10', { campos: 'entrada ou saída' });
    const categoria = String(form.categoria || '');
    const permitidas = tipo === 'Entrada' ? LISTA.CATEGORIA_ENTRADA : LISTA.CATEGORIA_SAIDA;
    if (permitidas.indexOf(categoria) < 0) throw new ErroDD('DD-10', { campos: 'categoria' });
    const descricao = texto_(form.descricao, 150);
    if (!descricao) throw new ErroDD('DD-10', { campos: 'descrição' });
    const valor = numero_(form.valor);
    if (valor === null || valor <= 0) throw new ErroDD('DD-19', { campo: 'valor', dica: 'Informe um valor maior que zero, com vírgula para os centavos.' });
    const forma = String(form.forma || '');
    if (LISTA.FORMA_PAGAMENTO.indexOf(forma) < 0) throw new ErroDD('DD-10', { campos: 'forma de pagamento' });

    const dia = form.data ? dataDeIso_(form.data) : hoje_();
    if (dia > hoje_()) throw new ErroDD('DD-19', { campo: 'data', dica: 'O caixa registra o que já aconteceu. Lance no dia em que o dinheiro entrar ou sair.' });
    const data = dia.getTime() === hoje_().getTime() ? new Date() : dia;

    return comTrava_(() => {
      inserirLinha(ABA.CAIXA, { data: data, tipo: tipo, categoria: categoria, descricao: descricao, valor: centavos_(valor), forma: forma, pedido: '' });
      registrarAtividade('Caixa: ' + (tipo === 'Entrada' ? 'entrada' : 'saída') + ' de ' + moedaBR_(valor) + ' (' + categoria + ', ' + forma + ')'
        + ' — ' + descricao + (data === dia ? ', com data de ' + formatarData_(dia) : '') + '.');
      return { valor: centavos_(valor) };
    });
  });
}

/** Exclui um lançamento avulso. A assinatura garante que a linha ainda é a mesma que a janela mostrou. */
function excluirLancamento(linha, assinatura) {
  return executar_('excluirLancamento', () => {
    exigirLicenca_();
    return comTrava_(() => {
      const c = lerTabela(ABA.CAIXA).find(x => x._linha === Number(linha));
      if (!c || assinaturaCaixa_(c) !== assinatura) {
        throw new ErroDD('DD-19', { campo: 'lançamento', dica: 'A aba Caixa mudou desde que a janela abriu. Feche e abra de novo o Caixa.' });
      }
      if (c.pedido) {
        throw new ErroDD('DD-19', { campo: 'lançamento', dica: 'Este valor é do pedido ' + c.pedido + '. Corrija pelo próprio pedido, em Destrava › Pedidos.' });
      }
      aba_(ABA.CAIXA).deleteRow(c._linha);
      registrarAtividade('Caixa: lançamento excluído — ' + (c.tipo === 'Entrada' ? 'entrada' : 'saída') + ' de ' + moedaBR_(Number(c.valor))
        + ' de ' + formatarData_(c.data) + ' (' + c.categoria + ') — ' + c.descricao + '.');
      return true;
    });
  });
}

function assinaturaCaixa_(c) {
  const d = c.data instanceof Date ? c.data.getTime() : String(c.data);
  return [d, c.tipo, c.valor, c.descricao, c.pedido].join('|');
}
