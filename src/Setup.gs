/**
 * Destrava Digital — Montagem do modelo.
 *
 * configurarPlanilha() monta (ou atualiza) toda a estrutura a partir do Esquema.gs.
 * É rodada por nós, no editor do Apps Script, para gerar o MODELO que o freelancer copia.
 * Não aparece no menu do cliente final.
 *
 * É segura para rodar de novo: nunca apaga linhas de dados. Só reescreve cabeçalhos,
 * fórmulas, formatos, validações, proteções e cria o que estiver faltando.
 */

function configurarPlanilha() {
  const ss = SpreadsheetApp.getActive();
  // As fórmulas do Esquema estão na sintaxe en-US (vírgula separando argumentos).
  // Com a planilha em pt_BR, a vírgula vira separador decimal e toda fórmula dá #ERROR!.
  // Por isso: grava em en_US e só no fim passa para pt_BR. O Sheets converte as
  // fórmulas já gravadas sozinho (passam a aparecer com ponto e vírgula).
  ss.setSpreadsheetLocale('en_US');
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');
  SpreadsheetApp.flush();

  // Config primeiro: as fórmulas de Produtos dependem dos intervalos nomeados.
  prepararAba_(ss, ABA.CONFIG);
  preencherConfigPadrao_(ss);

  const ordem = [ABA.PAINEL, ABA.PEDIDOS, ABA.CLIENTES, ABA.PRODUTOS, ABA.INSUMOS, ABA.CAIXA,
    ABA.ITENS, ABA.FICHA, ABA.MOVIMENTOS, ABA.ATIVIDADES];
  ordem.forEach(nome => {
    if (nome === ABA.PAINEL) prepararPainel_(ss);
    else prepararAba_(ss, nome);
  });

  // Ordem das abas: as visíveis primeiro, na ordem de uso.
  [ABA.PAINEL, ABA.PEDIDOS, ABA.CLIENTES, ABA.PRODUTOS, ABA.INSUMOS, ABA.CAIXA,
    ABA.ITENS, ABA.FICHA, ABA.MOVIMENTOS, ABA.CONFIG, ABA.ATIVIDADES]
    .forEach((nome, i) => { ss.setActiveSheet(ss.getSheetByName(nome)); ss.moveActiveSheet(i + 1); });

  removerAbaPadraoVazia_(ss);
  ss.setActiveSheet(ss.getSheetByName(ABA.PAINEL));
  SpreadsheetApp.flush();

  ss.setSpreadsheetLocale('pt_BR');
  SpreadsheetApp.flush();

  const falhas = verificarFormulas_(ss);
  if (falhas.length) {
    throw new Error('Fórmulas com erro depois da montagem: ' + falhas.join('; '));
  }
  console.log('Modelo configurado. Versão ' + VERSAO_MODELO + '. Todas as fórmulas conferidas.');
}

/**
 * Confere se o cabeçalho de cada coluna calculada mostra o título, e não #ERROR!,
 * #REF! ou #NAME?. Se a fórmula não compilou, o cabeçalho mostra o erro.
 */
function verificarFormulas_(ss) {
  const falhas = [];
  Object.keys(ESQUEMA).forEach(nome => {
    const aba = ss.getSheetByName(nome);
    ESQUEMA[nome].colunas.forEach((c, i) => {
      if (!c.formula) return;
      const exibido = aba.getRange(1, i + 1).getDisplayValue();
      if (exibido !== c.titulo) falhas.push(nome + '.' + c.chave + ' mostra "' + exibido + '"');
    });
  });
  return falhas;
}

function prepararAba_(ss, nome) {
  const def = ESQUEMA[nome];
  let aba = ss.getSheetByName(nome);
  if (!aba) aba = ss.insertSheet(nome);

  const cols = def.colunas;
  const L = letras(nome);
  const ultimaLinha = Math.max(aba.getMaxRows(), 2);

  // Garante o número de colunas exato do esquema.
  if (aba.getMaxColumns() < cols.length) aba.insertColumnsAfter(aba.getMaxColumns(), cols.length - aba.getMaxColumns());
  if (aba.getMaxColumns() > cols.length) aba.deleteColumns(cols.length + 1, aba.getMaxColumns() - cols.length);

  cols.forEach((c, i) => {
    const n = i + 1;
    const cabecalho = aba.getRange(1, n);
    if (c.formula) {
      // Cabeçalho + cálculo da coluna inteira numa célula só.
      cabecalho.setFormula(`={"${c.titulo}";ARRAYFORMULA(${c.formula(L)})}`);
    } else {
      cabecalho.setValue(c.titulo);
    }
    aba.setColumnWidth(n, c.largura || 120);

    const corpo = aba.getRange(2, n, ultimaLinha - 1, 1);
    if (c.formato) corpo.setNumberFormat(c.formato);
    if (c.lista) {
      corpo.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(c.lista, true).setAllowInvalid(false)
        .setHelpText('Escolha uma opção da lista.').build());
    }
    if (c.caixa) corpo.insertCheckboxes();
  });

  // Cabeçalho legível e fixo.
  aba.setFrozenRows(1);
  aba.getRange(1, 1, 1, cols.length)
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#1f2640')
    .setVerticalAlignment('middle').setWrap(true);
  aba.setRowHeight(1, 36);
  if (def.cor) aba.setTabColor(def.cor);

  protegerAba_(aba, def);
  if (def.visivel) aba.showSheet(); else aba.hideSheet();
}

/**
 * Proteções só com aviso: o dono continua podendo tudo, mas é avisado antes
 * de sobrescrever o que o sistema calcula ou grava.
 */
function protegerAba_(aba, def) {
  aba.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  aba.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());

  const gravadaPeloScript = !def.visivel || aba.getName() === ABA.PEDIDOS || aba.getName() === ABA.CAIXA;
  if (gravadaPeloScript) {
    aba.protect().setDescription('Gravada pelo sistema. Use o menu Destrava para alterar.').setWarningOnly(true);
    return;
  }
  // Nas abas de cadastro, protege só o cabeçalho e as colunas calculadas.
  aba.getRange(1, 1, 1, def.colunas.length).protect()
    .setDescription('Cabeçalho do sistema').setWarningOnly(true);
  def.colunas.forEach((c, i) => {
    if (c.formula) {
      aba.getRange(2, i + 1, Math.max(aba.getMaxRows() - 1, 1), 1).protect()
        .setDescription('Calculado automaticamente: ' + c.titulo).setWarningOnly(true);
    }
  });
}

function preencherConfigPadrao_(ss) {
  const aba = ss.getSheetByName(ABA.CONFIG);
  const existentes = lerTabela_(aba).reduce((m, r) => { m[r.chave] = r; return m; }, {});
  CONFIG_PADRAO.forEach(item => {
    if (!existentes[item.chave]) {
      inserirLinha(ABA.CONFIG, { chave: item.chave, valor: item.valor, descricao: item.descricao });
    }
  });
  // Versão sempre atualizada.
  salvarConfig({ VERSAO_MODELO: VERSAO_MODELO }, { semAtividade: true });

  // Intervalos nomeados apontando para a célula de valor de cada chave usada em fórmulas.
  const linhas = lerTabela_(aba);
  const colValor = indices(ABA.CONFIG).valor;
  CONFIG_PADRAO.filter(i => i.nome).forEach(item => {
    const pos = linhas.findIndex(r => r.chave === item.chave);
    const celula = aba.getRange(pos + 2, colValor);
    const existente = ss.getRangeByName(item.nome);
    if (existente) ss.removeNamedRange(item.nome);
    ss.setNamedRange(item.nome, celula);
  });
}

function prepararPainel_(ss) {
  let aba = ss.getSheetByName(ABA.PAINEL);
  if (!aba) aba = ss.insertSheet(ABA.PAINEL);
  // O painel completo é montado na etapa do painel. Aqui só garantimos a aba e a marca.
  if (!aba.getRange('A1').getValue()) {
    aba.getRange('A1').setValue('Painel').setFontSize(18).setFontWeight('bold');
  }
  aba.setTabColor('#1f2640');
  aba.showSheet();
}

function removerAbaPadraoVazia_(ss) {
  ['Página1', 'Sheet1', 'Planilha1'].forEach(n => {
    const a = ss.getSheetByName(n);
    if (a && a.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(a);
  });
}
