/**
 * Destrava Digital — Painel do mês (aba Painel).
 *
 * Tudo por fórmula: o painel se atualiza sozinho, sem botão e sem script rodando.
 * O dono só escolhe o mês na lista (em branco = mês atual).
 *
 * Decisões:
 * - Vendido conta pelo dia em que o pedido foi ENTREGUE (coluna "Entregue em"), não pelo dia
 *   em que foi criado nem pela data prevista de entrega.
 * - Recebido não conta "Dinheiro colocado pelo dono": aporte não é venda.
 * - A receber e Pedidos em aberto ignoram orçamentos: orçamento ainda não é compromisso.
 * - A margem desconta só o custo de materiais gravado nos pedidos. A legenda diz isso.
 *
 * Montado por configurarPlanilha() (as fórmulas são gravadas em en_US, como no resto).
 * Endereços fixos ficam em PAINEL para o teste automático ler os mesmos números.
 */

const PAINEL = {
  MES: 'B4',
  VENDIDO: 'B7', RECEBIDO: 'D7', A_RECEBER: 'F7',
  MARGEM: 'B11', RESULTADO: 'D11', EM_ABERTO: 'F11',
  ENTREGAS: 'B16', REPOR: 'B33',
  LINHAS_LISTA: 12,
  INICIO: 'I1', FIM: 'I2'
};

function montarPainel_(ss, aba) {
  const mesEscolhido = aba.getRange(PAINEL.MES).getValue();
  aba.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  aba.getCharts().forEach(c => aba.removeChart(c));
  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).breakApart();
  aba.clear();
  aba.clearConditionalFormatRules();
  aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).clearDataValidations();

  // Grade: A margem, B..G conteúdo (cartões ocupam 2 colunas), H..M apoio (ocultas).
  ajustarGrade_(aba, 60, 13);
  aba.setHiddenGridlines(true);
  aba.setColumnWidth(1, 24);
  for (let c = 2; c <= 7; c++) aba.setColumnWidth(c, 128);
  aba.getRange('A1:G60').setFontFamily('Roboto').setFontSize(10).setVerticalAlignment('middle').setFontColor('#1c2233');

  const P = k => ref(ABA.PEDIDOS, k);
  const C = k => ref(ABA.CAIXA, k);
  const I = k => ref(ABA.INSUMOS, k);
  const doMes = (col, ini, fim) => `${col},">="&${ini},${col},"<"&${fim}`;

  // ---------- apoio (colunas ocultas) ----------
  // Meses para a lista: M = 1º dia de cada um dos últimos 24 meses; L = nome por extenso.
  aba.getRange('M2').setFormula('=ARRAYFORMULA(DATE(YEAR(TODAY()),MONTH(TODAY())-SEQUENCE(24)+1,1))');
  aba.getRange('L2').setFormula('=ARRAYFORMULA(TEXT(M2:M25,"mmmm ""de"" yyyy"))');
  aba.getRange('I1').setFormula(`=IF(${PAINEL.MES}="",M2,IFERROR(INDEX(M2:M25,MATCH(${PAINEL.MES},L2:L25,0)),M2))`);
  aba.getRange('I2').setFormula('=EDATE(I1,1)');
  // Vendido dos 6 meses que terminam no mês escolhido (dados do gráfico).
  aba.getRange('I4:J4').setValues([['Mês', 'Vendido']]);
  for (let k = 0; k < 6; k++) {
    const r = 5 + k, desloc = k - 5;
    aba.getRange('I' + r).setFormula(`=TEXT(EDATE($I$1,${desloc}),"mmm/yy")`);
    aba.getRange('J' + r).setFormula(`=SUMIFS(${P('total')},${P('status')},"Entregue",${doMes(P('entregueEm'), `EDATE($I$1,${desloc})`, `EDATE($I$1,${desloc + 1})`)})`);
  }
  aba.getRange('K1').setFormula(`=SUMIFS(${P('custo')},${P('status')},"Entregue",${doMes(P('entregueEm'), '$I$1', '$I$2')})`);

  // ---------- cabeçalho e seletor de mês ----------
  aba.getRange('B1:G1').merge().setFontSize(20).setFontWeight('bold');
  aba.setRowHeight(1, 44);
  aba.getRange('B3').setValue('Mês').setFontColor('#5b6478').setFontWeight('bold');
  aba.getRange('B4:C4').merge();
  aba.getRange(PAINEL.MES).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(aba.getRange('L2:L25'), true).setAllowInvalid(false)
    .setHelpText('Escolha o mês na lista. Em branco, o painel mostra o mês atual.').build())
    .setBackground('#ffffff').setBorder(true, true, true, true, false, false, '#c9ceda', SpreadsheetApp.BorderStyle.SOLID)
    .setFontSize(11);
  aba.getRange('D4:G4').merge().setFormula('="Mostrando "&TEXT(I1,"mmmm ""de"" yyyy")&IF(B4="","  ·  deixe em branco para acompanhar sempre o mês atual","")')
    .setFontColor('#5b6478');
  if (mesEscolhido) {
    try { aba.getRange(PAINEL.MES).setValue(mesEscolhido); } catch (e) { /* mês saiu da lista: volta ao atual */ }
  }

  // ---------- cartões ----------
  const cartoes = [
    { rotulo: 'Vendido no mês', celula: PAINEL.VENDIDO, formato: FMT.MOEDA,
      formula: `=SUMIFS(${P('total')},${P('status')},"Entregue",${doMes(P('entregueEm'), '$I$1', '$I$2')})`,
      legenda: 'Pedidos entregues no mês. Vender não é receber: compare com o recebido ao lado.' },
    { rotulo: 'Recebido no mês', celula: PAINEL.RECEBIDO, formato: FMT.MOEDA,
      formula: `=SUMIFS(${C('valor')},${C('tipo')},"Entrada",${C('categoria')},"<>Dinheiro colocado pelo dono",${doMes(C('data'), '$I$1', '$I$2')})`,
      legenda: 'Dinheiro que entrou no caixa no mês, sem contar dinheiro colocado pelo dono.' },
    { rotulo: 'A receber', celula: PAINEL.A_RECEBER, formato: FMT.MOEDA,
      formula: `=SUMIFS(${P('saldo')},${P('status')},"<>Cancelado",${P('status')},"<>Orçamento")`,
      legenda: 'O que os clientes ainda devem, hoje, nos pedidos confirmados e entregues.' },
    { rotulo: 'Margem média', celula: PAINEL.MARGEM, formato: '0.0%',
      formula: `=IF(${PAINEL.VENDIDO}=0,"—",(${PAINEL.VENDIDO}-K1)/${PAINEL.VENDIDO})`,
      legenda: 'Do vendido no mês, o que sobra depois dos materiais. Não desconta sua hora nem custos fixos.' },
    { rotulo: 'Resultado do caixa', celula: PAINEL.RESULTADO, formato: FMT.MOEDA,
      formula: `=SUMIFS(${C('valor')},${C('tipo')},"Entrada",${doMes(C('data'), '$I$1', '$I$2')})-SUMIFS(${C('valor')},${C('tipo')},"Saída",${doMes(C('data'), '$I$1', '$I$2')})`,
      legenda: 'Tudo que entrou menos tudo que saiu do caixa no mês.' },
    { rotulo: 'Pedidos em aberto', celula: PAINEL.EM_ABERTO, formato: '0',
      formula: `=COUNTIFS(${P('codigo')},"<>",${P('status')},"<>Entregue",${P('status')},"<>Cancelado",${P('status')},"<>Orçamento")`,
      legenda: `="Confirmados, em produção ou prontos, hoje. "&COUNTIFS(${P('status')},"Orçamento")&" orçamento(s) esperando resposta."` }
  ];
  cartoes.forEach(k => {
    const a1 = aba.getRange(k.celula);
    const col = a1.getColumn(), lin = a1.getRow();
    const rotulo = aba.getRange(lin - 1, col, 1, 2).merge();
    const valor = aba.getRange(lin, col, 1, 2).merge();
    const legenda = aba.getRange(lin + 1, col, 1, 2).merge();
    rotulo.setValue(k.rotulo).setFontWeight('bold').setFontColor('#5b6478');
    valor.setFormula(k.formula).setNumberFormat(k.formato).setFontSize(22).setFontWeight('bold').setHorizontalAlignment('left');
    if (k.legenda.charAt(0) === '=') legenda.setFormula(k.legenda); else legenda.setValue(k.legenda);
    legenda.setFontSize(9).setFontColor('#5b6478').setWrap(true).setVerticalAlignment('top');
    aba.getRange(lin - 1, col, 3, 2).setBorder(true, true, true, true, false, false, '#e3e6ee', SpreadsheetApp.BorderStyle.SOLID);
  });
  [6, 10].forEach(l => { aba.setRowHeight(l, 26); aba.setRowHeight(l + 1, 40); aba.setRowHeight(l + 2, 40); });
  [5, 9, 13].forEach(l => aba.setRowHeight(l, 14));

  // ---------- listas ----------
  const n = PAINEL.LINHAS_LISTA;
  const abertos = `(${P('status')}="Confirmado")+(${P('status')}="Em produção")+(${P('status')}="Pronto")`;
  const filtroEntregas = `FILTER({${P('entrega')},${P('codigo')},${P('cliente')},${P('status')},${P('saldo')}},${P('codigo')}<>"",${abertos},${P('entrega')}<>"",${P('entrega')}<=TODAY()+7)`;
  const filtroRepor = `FILTER({${I('nome')},${I('saldo')},${I('minimo')},${I('unidade')}},${I('codigo')}<>"",${I('situacao')}="Repor",${I('ativo')}<>FALSE)`;

  montarLista_(aba, 14, 'Entregas dos próximos 7 dias', ['Entrega', 'Pedido', 'Cliente', 'Status', 'A receber'],
    `=IFERROR(ARRAY_CONSTRAIN(SORT(${filtroEntregas},1,TRUE),${n},5),"Nenhuma entrega nos próximos 7 dias.")`,
    `=IFERROR(IF(ROWS(${filtroEntregas})>${n},"e mais "&(ROWS(${filtroEntregas})-${n})&" — veja todos em Destrava › Pedidos",""),"")`,
    [FMT.DATA, '@', '@', '@', FMT.MOEDA]);
  // Atrasados em vermelho.
  const faixa = aba.getRange(16, 2, n, 5);
  aba.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($B16),$B16<TODAY())')
    .setFontColor('#d6415f').setBackground('#fdecef').setRanges([faixa]).build()]);

  montarLista_(aba, 31, 'Insumos para repor', ['Insumo', 'Tem', 'Mínimo', 'Unidade'],
    `=IFERROR(ARRAY_CONSTRAIN(SORT(${filtroRepor},2,TRUE),${n},4),"Nada para repor.")`,
    `=IFERROR(IF(ROWS(${filtroRepor})>${n},"e mais "&(ROWS(${filtroRepor})-${n})&" — veja todos na aba Insumos",""),"")`,
    ['@', FMT.NUM, FMT.NUM, '@']);

  // ---------- gráfico ----------
  aba.getRange('B48').setValue('Vendido nos últimos 6 meses').setFontSize(12).setFontWeight('bold');
  aba.insertChart(aba.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(aba.getRange('I4:J10'))
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setNumHeaders(1)
    .setPosition(49, 2, 0, 0)
    .setOption('legend', { position: 'none' })
    .setOption('width', 768).setOption('height', 240)
    .setOption('vAxis', { format: 'R$ #,##0', gridlines: { color: '#e3e6ee' }, minValue: 0 })
    .setOption('chartArea', { left: 70, top: 16, width: '88%', height: '75%' })
    .build());

  aba.hideColumns(8, 6);
  aba.setFrozenRows(0);
  aba.setTabColor('#1f2640');
  aba.showSheet();

  // Só o seletor de mês é editável; o resto avisa antes de mexer.
  aba.protect().setDescription('Painel calculado automaticamente. Só o mês é escolhido aqui.')
    .setUnprotectedRanges([aba.getRange(PAINEL.MES)]).setWarningOnly(true);

  const c = lerConfig();
  pintarPainel_(ss, String(c.NOME_NEGOCIO || 'Painel'), String(c.COR_PRINCIPAL || '#8b7bff'));
}

function montarLista_(aba, linha, titulo, colunas, formula, formulaMais, formatos) {
  const n = PAINEL.LINHAS_LISTA;
  aba.getRange(linha, 2).setValue(titulo).setFontSize(12).setFontWeight('bold').setFontColor('#1c2233');
  aba.getRange(linha + 1, 2, 1, colunas.length).setValues([colunas]).setFontWeight('bold').setFontColor('#5b6478')
    .setBorder(false, false, true, false, false, false, '#c9ceda', SpreadsheetApp.BorderStyle.SOLID);
  aba.getRange(linha + 2, 2).setFormula(formula);
  formatos.forEach((f, i) => aba.getRange(linha + 2, 2 + i, n, 1).setNumberFormat(f));
  aba.getRange(linha + 2 + n, 2, 1, 6).merge().setFormula(formulaMais).setFontSize(9).setFontColor('#5b6478');
}

/** Título com o nome do negócio e a cor principal. Chamado também ao salvar Configurações. */
function pintarPainel_(ss, nome, cor) {
  const aba = ss.getSheetByName(ABA.PAINEL);
  if (!aba) return;
  aba.getRange('B1').setValue(nome).setFontColor(cor);
  const suave = misturarComBranco_(cor, 0.10);
  [PAINEL.VENDIDO, PAINEL.RECEBIDO, PAINEL.A_RECEBER, PAINEL.MARGEM, PAINEL.RESULTADO, PAINEL.EM_ABERTO].forEach(a1 => {
    const r = aba.getRange(a1);
    aba.getRange(r.getRow() - 1, r.getColumn(), 3, 2).setBackground(suave);
  });
  aba.getCharts().forEach(ch => aba.updateChart(ch.modify().setOption('colors', [cor]).build()));
}

/** Garante exatamente `linhas` × `colunas` na aba. */
function ajustarGrade_(aba, linhas, colunas) {
  if (aba.getMaxRows() < linhas) aba.insertRowsAfter(aba.getMaxRows(), linhas - aba.getMaxRows());
  if (aba.getMaxRows() > linhas) aba.deleteRows(linhas + 1, aba.getMaxRows() - linhas);
  if (aba.getMaxColumns() < colunas) aba.insertColumnsAfter(aba.getMaxColumns(), colunas - aba.getMaxColumns());
  if (aba.getMaxColumns() > colunas) aba.deleteColumns(colunas + 1, aba.getMaxColumns() - colunas);
  aba.showColumns(1, colunas);
}

function misturarComBranco_(hex, forca) {
  const h = String(hex).replace('#', '');
  const canal = i => Math.round(parseInt(h.substr(i, 2), 16) * forca + 255 * (1 - forca));
  return '#' + [0, 2, 4].map(i => ('0' + canal(i).toString(16)).slice(-2)).join('');
}

/** Números do painel, lidos como o dono vê (usado pelo teste automático). */
function lerPainel_() {
  const aba = aba_(ABA.PAINEL);
  SpreadsheetApp.flush();
  const v = a1 => aba.getRange(a1).getValue();
  return {
    vendido: v(PAINEL.VENDIDO), recebido: v(PAINEL.RECEBIDO), aReceber: v(PAINEL.A_RECEBER),
    margem: v(PAINEL.MARGEM), resultado: v(PAINEL.RESULTADO), emAberto: v(PAINEL.EM_ABERTO),
    exibidos: aba.getRange('A1:G60').getDisplayValues()
  };
}

/** Células do painel (inclusive as de apoio) que mostram erro de fórmula. */
function errosDoPainel_(ss) {
  const aba = ss.getSheetByName(ABA.PAINEL);
  if (!aba) return ['a aba Painel não existe'];
  const falhas = [];
  const valores = aba.getRange(1, 1, aba.getMaxRows(), aba.getMaxColumns()).getDisplayValues();
  valores.forEach((linha, i) => linha.forEach((v, j) => {
    if (/^#(ERROR|REF|NAME|VALUE|N\/A|DIV|NUM)/.test(v)) falhas.push('Painel!' + letraColuna(j + 1) + (i + 1) + ' mostra "' + v + '"');
  }));
  return falhas;
}
