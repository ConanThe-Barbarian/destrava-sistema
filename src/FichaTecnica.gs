/**
 * Destrava Digital — Ficha técnica.
 *
 * Diz quanto de cada insumo vai em UMA unidade do produto. É usada para:
 * - calcular o custo dos insumos e o preço sugerido do produto (fórmulas da aba Produtos);
 * - baixar os insumos quando um pedido de encomenda entra em produção (bloco 3).
 *
 * Salvar a ficha substitui a ficha inteira daquele produto.
 */

function abrirFichaTecnica(codigoInicial) {
  // Pelo menu, a função é chamada sem código; pela janela de produto, com o código recém-criado.
  const codigo = typeof codigoInicial === 'string' ? codigoInicial : '';
  abrirJanela_('JanelaFicha', 'Ficha técnica', 660, 640, { codigoInicial: codigo });
}

function carregarFicha() {
  return executar_('carregarFicha', () => {
    const produtos = lerTabela(ABA.PRODUTOS)
      .filter(p => p.codigo && p.ativo !== false)
      .map(p => ({ codigo: String(p.codigo), nome: String(p.nome), tipo: String(p.tipo), unidade: String(p.unidade) }));
    const insumos = lerTabela(ABA.INSUMOS)
      .filter(i => i.codigo && i.ativo !== false)
      .map(i => ({ codigo: String(i.codigo), nome: String(i.nome), unidade: String(i.unidade), custo: Number(i.custoMedio) || 0 }));
    const fichas = {};
    lerTabela(ABA.FICHA).forEach(f => {
      const cod = String(f.produto);
      (fichas[cod] = fichas[cod] || []).push({ insumo: String(f.insumo), quantidade: Number(f.quantidade) || 0 });
    });
    return { produtos: produtos, insumos: insumos, fichas: fichas };
  });
}

/**
 * itens: [{ insumo: 'INS-0001', quantidade: '250' }]. Lista vazia apaga a ficha.
 */
function salvarFicha(codigoProduto, itens) {
  return executar_('salvarFicha', () => {
    exigirLicenca_();
    const produto = lerTabela(ABA.PRODUTOS).find(p => String(p.codigo) === String(codigoProduto));
    if (!produto) throw new ErroDD('DD-10', { campos: 'produto' });

    const insumos = lerTabela(ABA.INSUMOS).reduce((m, i) => { m[String(i.codigo)] = i; return m; }, {});
    const vistos = {};
    const limpos = (itens || []).map((item, n) => {
      const ins = insumos[String(item.insumo)];
      if (!ins) throw new ErroDD('DD-10', { campos: 'insumo da linha ' + (n + 1) });
      if (vistos[ins.codigo]) {
        throw new ErroDD('DD-19', { campo: 'insumo', dica: '"' + ins.nome + '" aparece duas vezes. Junte as quantidades numa linha só.' });
      }
      vistos[ins.codigo] = true;
      const q = numero_(item.quantidade);
      if (q === null || q <= 0) {
        throw new ErroDD('DD-19', { campo: 'quantidade de ' + ins.nome, dica: 'Informe quanto vai em uma unidade do produto, maior que zero.' });
      }
      return { insumo: ins, quantidade: q };
    });

    return comTrava_(() => {
      const aba = aba_(ABA.FICHA);
      // Remove a ficha antiga de baixo para cima, para as linhas não mudarem de posição no meio.
      lerTabela_(aba)
        .filter(r => String(r.produto) === String(produto.codigo))
        .map(r => r._linha)
        .sort((a, b) => b - a)
        .forEach(l => aba.deleteRow(l));

      limpos.forEach(i => inserirLinha(ABA.FICHA, { produto: produto.codigo, insumo: i.insumo.codigo, quantidade: i.quantidade }));

      const custo = limpos.reduce((s, i) => s + i.quantidade * (Number(i.insumo.custoMedio) || 0), 0);
      registrarAtividade(limpos.length
        ? 'Ficha técnica de ' + produto.codigo + ' — ' + produto.nome + ' salva com ' + limpos.length
          + (limpos.length === 1 ? ' insumo' : ' insumos') + ' (custo dos insumos: ' + moedaBR_(custo) + ' por unidade).'
        : 'Ficha técnica de ' + produto.codigo + ' — ' + produto.nome + ' removida.');
      return { itens: limpos.length, custo: custo };
    });
  });
}
