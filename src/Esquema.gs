/**
 * Destrava Digital — Esquema da planilha.
 *
 * Fonte única da estrutura: nomes das abas, colunas, formatos, listas e fórmulas.
 * Todo o resto do código lê daqui. Para mudar uma coluna, mude só este arquivo
 * e rode configurarPlanilha() de novo.
 *
 * Regras:
 * - Colunas com `formula` são calculadas por ARRAYFORMULA no cabeçalho (linha 1).
 *   O script nunca escreve nelas; por isso as gravações usam inserirLinha(), que
 *   só preenche as colunas de entrada.
 * - Fórmulas em sintaxe en-US (vírgula como separador), que é o que setFormula exige,
 *   independente da localidade da planilha.
 * - Nenhuma coluna visível mostra ID técnico: os códigos (PED-0001, CLI-0001...) são
 *   legíveis e fazem parte do vocabulário do dono do negócio.
 */

const VERSAO_MODELO = '1.0.0';

const ABA = {
  PAINEL: 'Painel',
  PEDIDOS: 'Pedidos',
  CLIENTES: 'Clientes',
  PRODUTOS: 'Produtos',
  INSUMOS: 'Insumos',
  CAIXA: 'Caixa',
  ITENS: 'Itens_Pedido',
  FICHA: 'Ficha_Tecnica',
  MOVIMENTOS: 'Movimentos',
  CONFIG: 'Config',
  ATIVIDADES: 'Atividades'
};

const LISTA = {
  STATUS_PEDIDO: ['Orçamento', 'Confirmado', 'Em produção', 'Pronto', 'Entregue', 'Cancelado'],
  TIPO_PRODUTO: ['Encomenda', 'Pronta-entrega'],
  UNIDADE: ['un', 'g', 'kg', 'ml', 'L', 'm'],
  TIPO_CAIXA: ['Entrada', 'Saída'],
  FORMA_PAGAMENTO: ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Outro'],
  TIPO_MOVIMENTO: ['Entrada', 'Saída por pedido', 'Estorno', 'Ajuste']
};

const FMT = {
  MOEDA: '"R$" #,##0.00',
  DATA: 'dd/mm/yyyy',
  DATA_HORA: 'dd/mm/yyyy hh:mm',
  PCT: '0.0%',
  NUM: '#,##0.###',
  TEXTO: '@'
};

/**
 * Cada coluna: { chave, titulo, largura, formato?, lista?, caixa? (checkbox), formula? }
 * `formula` recebe a letra das colunas por chave (L.xxx) e devolve o trecho que vai
 * dentro do ARRAYFORMULA, sempre começando na linha 2.
 */
const ESQUEMA = {
  [ABA.PEDIDOS]: {
    visivel: true, cor: '#8b7bff',
    colunas: [
      { chave: 'codigo', titulo: 'Código', largura: 90 },
      { chave: 'data', titulo: 'Data do pedido', largura: 110, formato: FMT.DATA },
      { chave: 'cliente', titulo: 'Cliente', largura: 180 },
      { chave: 'entrega', titulo: 'Entrega', largura: 100, formato: FMT.DATA },
      { chave: 'status', titulo: 'Status', largura: 115, lista: LISTA.STATUS_PEDIDO },
      { chave: 'total', titulo: 'Total', largura: 100, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,SUMIF(${ref(ABA.ITENS,'pedido')},${L.codigo}2:${L.codigo},${ref(ABA.ITENS,'subtotal')})-${L.desconto}2:${L.desconto})` },
      { chave: 'desconto', titulo: 'Desconto', largura: 90, formato: FMT.MOEDA },
      { chave: 'pago', titulo: 'Pago', largura: 100, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,SUMIFS(${ref(ABA.CAIXA,'valor')},${ref(ABA.CAIXA,'pedido')},${L.codigo}2:${L.codigo},${ref(ABA.CAIXA,'tipo')},"Entrada")-SUMIFS(${ref(ABA.CAIXA,'valor')},${ref(ABA.CAIXA,'pedido')},${L.codigo}2:${L.codigo},${ref(ABA.CAIXA,'tipo')},"Saída"))` },
      { chave: 'saldo', titulo: 'Saldo', largura: 100, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,IF(${L.status}2:${L.status}="Cancelado",0,${L.total}2:${L.total}-${L.pago}2:${L.pago}))` },
      { chave: 'custo', titulo: 'Custo', largura: 100, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,SUMIF(${ref(ABA.ITENS,'pedido')},${L.codigo}2:${L.codigo},${ref(ABA.ITENS,'custoTotal')}))` },
      { chave: 'obs', titulo: 'Observações', largura: 240 }
    ]
  },

  [ABA.CLIENTES]: {
    visivel: true, cor: '#5ce1c6',
    colunas: [
      { chave: 'codigo', titulo: 'Código', largura: 90 },
      { chave: 'nome', titulo: 'Nome', largura: 200 },
      { chave: 'whatsapp', titulo: 'WhatsApp', largura: 140, formato: FMT.TEXTO },
      { chave: 'email', titulo: 'E-mail', largura: 200 },
      { chave: 'endereco', titulo: 'Endereço', largura: 240 },
      { chave: 'obs', titulo: 'Observações', largura: 220 },
      { chave: 'cadastro', titulo: 'Cadastrado em', largura: 110, formato: FMT.DATA },
      { chave: 'qtdPedidos', titulo: 'Pedidos', largura: 80, formato: '0',
        formula: L => `IF(${L.nome}2:${L.nome}="",,COUNTIFS(${ref(ABA.PEDIDOS,'cliente')},${L.nome}2:${L.nome},${ref(ABA.PEDIDOS,'status')},"<>Cancelado"))` }
    ]
  },

  [ABA.PRODUTOS]: {
    visivel: true, cor: '#ffb86b',
    colunas: [
      { chave: 'codigo', titulo: 'Código', largura: 90 },
      { chave: 'nome', titulo: 'Nome', largura: 200 },
      { chave: 'tipo', titulo: 'Tipo', largura: 120, lista: LISTA.TIPO_PRODUTO },
      { chave: 'unidade', titulo: 'Unidade de venda', largura: 110, lista: LISTA.UNIDADE },
      { chave: 'horas', titulo: 'Horas por unidade', largura: 110, formato: FMT.NUM },
      { chave: 'custoCompra', titulo: 'Custo de compra', largura: 110, formato: FMT.MOEDA },
      { chave: 'custoInsumos', titulo: 'Custo dos insumos', largura: 120, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,SUMIF(${ref(ABA.FICHA,'produto')},${L.codigo}2:${L.codigo},${ref(ABA.FICHA,'custo')}))` },
      { chave: 'custoUnit', titulo: 'Custo por unidade', largura: 120, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,${L.custoCompra}2:${L.custoCompra}+${L.custoInsumos}2:${L.custoInsumos})` },
      { chave: 'precoSugerido', titulo: 'Preço sugerido', largura: 115, formato: FMT.MOEDA,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,IF(1-(CFG_CUSTOS_FIXOS_PCT+CFG_TAXAS_PCT+CFG_MARGEM_PCT)<=0,"Revise Configurações",(${L.custoUnit}2:${L.custoUnit}+${L.horas}2:${L.horas}*CFG_VALOR_HORA)/(1-(CFG_CUSTOS_FIXOS_PCT+CFG_TAXAS_PCT+CFG_MARGEM_PCT))))` },
      { chave: 'preco', titulo: 'Preço de venda', largura: 110, formato: FMT.MOEDA },
      { chave: 'margem', titulo: 'Margem líquida', largura: 110, formato: FMT.PCT,
        formula: L => `IF((${L.codigo}2:${L.codigo}="")+(${L.preco}2:${L.preco}<=0),,(${L.preco}2:${L.preco}*(1-CFG_CUSTOS_FIXOS_PCT-CFG_TAXAS_PCT)-${L.custoUnit}2:${L.custoUnit}-${L.horas}2:${L.horas}*CFG_VALOR_HORA)/${L.preco}2:${L.preco})` },
      { chave: 'saldo', titulo: 'Saldo', largura: 80, formato: FMT.NUM,
        formula: L => `IF(${L.tipo}2:${L.tipo}<>"Pronta-entrega",,SUMIF(${ref(ABA.MOVIMENTOS,'item')},${L.codigo}2:${L.codigo},${ref(ABA.MOVIMENTOS,'quantidade')}))` },
      { chave: 'minimo', titulo: 'Estoque mínimo', largura: 100, formato: FMT.NUM },
      { chave: 'ativo', titulo: 'Ativo', largura: 60, caixa: true }
    ]
  },

  [ABA.INSUMOS]: {
    visivel: true, cor: '#ff6b8b',
    colunas: [
      { chave: 'codigo', titulo: 'Código', largura: 90 },
      { chave: 'nome', titulo: 'Nome', largura: 200 },
      { chave: 'unidade', titulo: 'Unidade', largura: 80, lista: LISTA.UNIDADE },
      { chave: 'saldo', titulo: 'Saldo', largura: 90, formato: FMT.NUM,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,SUMIF(${ref(ABA.MOVIMENTOS,'item')},${L.codigo}2:${L.codigo},${ref(ABA.MOVIMENTOS,'quantidade')}))` },
      { chave: 'minimo', titulo: 'Estoque mínimo', largura: 110, formato: FMT.NUM },
      { chave: 'custoMedio', titulo: 'Custo médio por unidade', largura: 150, formato: '"R$" #,##0.0000' },
      { chave: 'situacao', titulo: 'Situação', largura: 90,
        formula: L => `IF(${L.codigo}2:${L.codigo}="",,IF((${L.saldo}2:${L.saldo}<0)+(${L.saldo}2:${L.saldo}<${L.minimo}2:${L.minimo}),"Repor","OK"))` },
      { chave: 'ativo', titulo: 'Ativo', largura: 60, caixa: true }
    ]
  },

  [ABA.CAIXA]: {
    visivel: true, cor: '#4caf82',
    colunas: [
      { chave: 'data', titulo: 'Data', largura: 110, formato: FMT.DATA },
      { chave: 'tipo', titulo: 'Tipo', largura: 90, lista: LISTA.TIPO_CAIXA },
      { chave: 'categoria', titulo: 'Categoria', largura: 150 },
      { chave: 'descricao', titulo: 'Descrição', largura: 260 },
      { chave: 'valor', titulo: 'Valor', largura: 110, formato: FMT.MOEDA },
      { chave: 'forma', titulo: 'Forma de pagamento', largura: 140, lista: LISTA.FORMA_PAGAMENTO },
      { chave: 'pedido', titulo: 'Pedido', largura: 90 }
    ]
  },

  [ABA.ITENS]: {
    visivel: false,
    colunas: [
      { chave: 'pedido', titulo: 'Pedido', largura: 90 },
      { chave: 'produtoCodigo', titulo: 'Código do produto', largura: 110 },
      { chave: 'produto', titulo: 'Produto', largura: 200 },
      { chave: 'tipo', titulo: 'Tipo', largura: 110 },
      { chave: 'quantidade', titulo: 'Quantidade', largura: 90, formato: FMT.NUM },
      { chave: 'precoUnit', titulo: 'Preço unitário', largura: 110, formato: FMT.MOEDA },
      { chave: 'custoUnit', titulo: 'Custo unitário', largura: 110, formato: FMT.MOEDA },
      { chave: 'subtotal', titulo: 'Subtotal', largura: 110, formato: FMT.MOEDA,
        formula: L => `IF(${L.pedido}2:${L.pedido}="",,${L.quantidade}2:${L.quantidade}*${L.precoUnit}2:${L.precoUnit})` },
      { chave: 'custoTotal', titulo: 'Custo total', largura: 110, formato: FMT.MOEDA,
        formula: L => `IF(${L.pedido}2:${L.pedido}="",,${L.quantidade}2:${L.quantidade}*${L.custoUnit}2:${L.custoUnit})` },
      { chave: 'baixado', titulo: 'Estoque baixado', largura: 110, caixa: true }
    ]
  },

  [ABA.FICHA]: {
    visivel: false,
    colunas: [
      { chave: 'produto', titulo: 'Produto', largura: 100 },
      { chave: 'insumo', titulo: 'Insumo', largura: 100 },
      { chave: 'insumoNome', titulo: 'Nome do insumo', largura: 200,
        formula: L => `IF(${L.insumo}2:${L.insumo}="",,IFERROR(VLOOKUP(${L.insumo}2:${L.insumo},{${ref(ABA.INSUMOS,'codigo')},${ref(ABA.INSUMOS,'nome')}},2,FALSE),"Insumo não encontrado"))` },
      { chave: 'quantidade', titulo: 'Quantidade por unidade', largura: 150, formato: FMT.NUM },
      { chave: 'custo', titulo: 'Custo', largura: 110, formato: FMT.MOEDA,
        formula: L => `IF(${L.insumo}2:${L.insumo}="",,${L.quantidade}2:${L.quantidade}*IFERROR(VLOOKUP(${L.insumo}2:${L.insumo},{${ref(ABA.INSUMOS,'codigo')},${ref(ABA.INSUMOS,'custoMedio')}},2,FALSE),0))` }
    ]
  },

  [ABA.MOVIMENTOS]: {
    visivel: false,
    colunas: [
      { chave: 'data', titulo: 'Data', largura: 130, formato: FMT.DATA_HORA },
      { chave: 'item', titulo: 'Item', largura: 100 },
      { chave: 'itemNome', titulo: 'Nome do item', largura: 200 },
      { chave: 'tipo', titulo: 'Tipo', largura: 130, lista: LISTA.TIPO_MOVIMENTO },
      { chave: 'quantidade', titulo: 'Quantidade', largura: 100, formato: FMT.NUM },
      { chave: 'custoUnit', titulo: 'Custo unitário', largura: 120, formato: '"R$" #,##0.0000' },
      { chave: 'pedido', titulo: 'Pedido', largura: 90 },
      { chave: 'quem', titulo: 'Feito por', largura: 180 },
      { chave: 'obs', titulo: 'Observação', largura: 240 }
    ]
  },

  [ABA.CONFIG]: {
    visivel: false,
    colunas: [
      { chave: 'chave', titulo: 'Chave', largura: 200 },
      { chave: 'valor', titulo: 'Valor', largura: 260 },
      { chave: 'descricao', titulo: 'Para que serve', largura: 380 }
    ]
  },

  [ABA.ATIVIDADES]: {
    visivel: false,
    colunas: [
      { chave: 'data', titulo: 'Data', largura: 130, formato: FMT.DATA_HORA },
      { chave: 'quem', titulo: 'Quem', largura: 200 },
      { chave: 'oque', titulo: 'O que aconteceu', largura: 520 }
    ]
  }
};

/**
 * Configurações padrão. `nome` vira intervalo nomeado quando a fórmula precisa do valor.
 * Percentuais são guardados como fração (0,15 = 15%).
 */
const CONFIG_PADRAO = [
  { chave: 'NOME_NEGOCIO', rotulo: 'nome do negócio', valor: 'Meu Negócio', descricao: 'Nome exibido nas janelas e no nome do arquivo' },
  { chave: 'LOGO_URL', rotulo: 'logo', valor: '', descricao: 'Link da imagem do logo no Drive (compartilhada com qualquer pessoa com o link)' },
  { chave: 'COR_PRINCIPAL', rotulo: 'cor principal', valor: '#8b7bff', descricao: 'Cor das janelas e dos destaques' },
  { chave: 'IMPLANTADOR_NOME', rotulo: 'contato de suporte', valor: '', descricao: 'Quem instalou o sistema (aparece no rodapé como contato de suporte)' },
  { chave: 'IMPLANTADOR_WHATSAPP', rotulo: 'WhatsApp de suporte', valor: '', descricao: 'WhatsApp de quem instalou o sistema' },
  { chave: 'VALOR_HORA', rotulo: 'valor da hora', valor: 20, descricao: 'Quanto vale uma hora de trabalho, em reais', nome: 'CFG_VALOR_HORA' },
  { chave: 'CUSTOS_FIXOS_PCT', rotulo: 'custos fixos', valor: 0.10, descricao: 'Parte do preço que cobre custos fixos (aluguel, luz, internet)', nome: 'CFG_CUSTOS_FIXOS_PCT' },
  { chave: 'TAXAS_PCT', rotulo: 'taxas', valor: 0.05, descricao: 'Parte do preço que vai para taxas (cartão, aplicativo)', nome: 'CFG_TAXAS_PCT' },
  { chave: 'MARGEM_PCT', rotulo: 'margem desejada', valor: 0.20, descricao: 'Lucro desejado sobre o preço de venda', nome: 'CFG_MARGEM_PCT' },
  { chave: 'CONTADOR_PEDIDO', valor: 0, descricao: 'Último número de pedido usado' },
  { chave: 'CONTADOR_CLIENTE', valor: 0, descricao: 'Último número de cliente usado' },
  { chave: 'CONTADOR_PRODUTO', valor: 0, descricao: 'Último número de produto usado' },
  { chave: 'CONTADOR_INSUMO', valor: 0, descricao: 'Último número de insumo usado' },
  { chave: 'VERSAO_MODELO', valor: VERSAO_MODELO, descricao: 'Versão do modelo Destrava Digital' }
];

// ---------- utilitários do esquema ----------

/** Letra da coluna (1 → A, 27 → AA). */
function letraColuna(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/** Mapa chave → letra para uma aba. */
function letras(nomeAba) {
  const mapa = {};
  ESQUEMA[nomeAba].colunas.forEach((c, i) => { mapa[c.chave] = letraColuna(i + 1); });
  return mapa;
}

/** Mapa chave → índice (1-based) para uma aba. */
function indices(nomeAba) {
  const mapa = {};
  ESQUEMA[nomeAba].colunas.forEach((c, i) => { mapa[c.chave] = i + 1; });
  return mapa;
}

/** Referência de coluna de outra aba a partir da linha 2, ex.: 'Caixa'!E2:E */
function ref(nomeAba, chave) {
  const l = letras(nomeAba)[chave];
  if (!l) throw new Error('Coluna inexistente no esquema: ' + nomeAba + '.' + chave);
  return `'${nomeAba}'!${l}2:${l}`;
}
