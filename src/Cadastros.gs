/**
 * Destrava Digital — Cadastros de cliente, produto e insumo.
 *
 * Criar sempre pelo menu: é o menu que gera o código (CLI-0001, PRD-0001, INS-0001),
 * e as fórmulas do sistema dependem desse código. Alterar um cadastro existente pode
 * ser feito direto na célula da aba.
 *
 * Nomes são únicos dentro de cada tipo (sem diferenciar maiúsculas e acentos), porque
 * as janelas de pedido e de ficha técnica mostram os cadastros pelo nome.
 */

const TIPOS_CADASTRO = {
  cliente: { titulo: 'Novo cliente', largura: 520, altura: 600 },
  produto: { titulo: 'Novo produto', largura: 600, altura: 660 },
  insumo: { titulo: 'Novo insumo', largura: 560, altura: 640 }
};

function abrirCadastroCliente() { abrirCadastro_('cliente'); }
function abrirCadastroProduto() { abrirCadastro_('produto'); }
function abrirCadastroInsumo() { abrirCadastro_('insumo'); }

function abrirCadastro_(tipo) {
  const t = TIPOS_CADASTRO[tipo];
  abrirJanela_('JanelaCadastro', t.titulo, t.largura, t.altura, { tipo: tipo });
}

/** Dados de apoio das janelas: listas e parâmetros de preço para a prévia. */
function carregarCadastro() {
  return executar_('carregarCadastro', () => {
    const c = lerConfig();
    return {
      unidades: LISTA.UNIDADE,
      tiposProduto: LISTA.TIPO_PRODUTO,
      valorHora: Number(c.VALOR_HORA) || 0,
      somaPercentuais: (Number(c.CUSTOS_FIXOS_PCT) || 0) + (Number(c.TAXAS_PCT) || 0) + (Number(c.MARGEM_PCT) || 0)
    };
  });
}

// ---------- cliente ----------

function salvarCliente(form) {
  return executar_('salvarCliente', () => {
    exigirLicenca_();
    const nome = texto_(form.nome, 80);
    if (!nome) throw new ErroDD('DD-10', { campos: 'nome' });

    const whatsapp = String(form.whatsapp || '').replace(/\D/g, '');
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 11)) {
      throw new ErroDD('DD-19', { campo: 'WhatsApp', dica: 'Use o número com DDD, por exemplo (11) 91234-5678.' });
    }
    const email = texto_(form.email, 120).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new ErroDD('DD-19', { campo: 'e-mail', dica: 'Confira se o e-mail está completo, por exemplo nome@gmail.com, ou deixe em branco.' });
    }

    return comTrava_(() => {
      exigirNomeUnico_(ABA.CLIENTES, nome, 'um cliente');
      const codigo = proximoCodigo('CLIENTE', 'CLI');
      inserirLinha(ABA.CLIENTES, {
        codigo: codigo,
        nome: nome,
        whatsapp: whatsapp ? formatarWhats_(whatsapp) : '',
        email: email,
        endereco: texto_(form.endereco, 200),
        obs: texto_(form.obs, 300),
        cadastro: new Date()
      });
      registrarAtividade('Cliente cadastrado: ' + codigo + ' — ' + nome + '.');
      return { codigo: codigo, nome: nome };
    });
  });
}

// ---------- produto ----------

function salvarProduto(form) {
  return executar_('salvarProduto', () => {
    exigirLicenca_();
    const faltando = [];
    const nome = texto_(form.nome, 80);
    if (!nome) faltando.push('nome');
    const tipo = String(form.tipo || '');
    if (LISTA.TIPO_PRODUTO.indexOf(tipo) < 0) faltando.push('tipo');
    const unidade = String(form.unidade || '');
    if (LISTA.UNIDADE.indexOf(unidade) < 0) faltando.push('unidade de venda');
    if (faltando.length) throw new ErroDD('DD-10', { campos: faltando.join(', ') });

    const horas = numeroOpcional_(form.horas, 'horas por unidade');
    const custoCompra = numeroOpcional_(form.custoCompra, 'custo de compra');
    const preco = numeroOpcional_(form.preco, 'preço de venda');
    const minimo = tipo === 'Pronta-entrega' ? numeroOpcional_(form.minimo, 'estoque mínimo') : 0;

    return comTrava_(() => {
      exigirNomeUnico_(ABA.PRODUTOS, nome, 'um produto');
      const codigo = proximoCodigo('PRODUTO', 'PRD');
      inserirLinha(ABA.PRODUTOS, {
        codigo: codigo,
        nome: nome,
        tipo: tipo,
        unidade: unidade,
        horas: horas,
        custoCompra: custoCompra,
        preco: preco || '',
        minimo: minimo,
        ativo: true
      });
      registrarAtividade('Produto cadastrado: ' + codigo + ' — ' + nome + ' (' + tipo.toLowerCase() + ')'
        + (preco ? ', preço de venda ' + moedaBR_(preco) : '') + '.');
      return { codigo: codigo, nome: nome, tipo: tipo };
    });
  });
}

// ---------- insumo ----------

function salvarInsumo(form) {
  return executar_('salvarInsumo', () => {
    exigirLicenca_();
    const faltando = [];
    const nome = texto_(form.nome, 80);
    if (!nome) faltando.push('nome');
    const unidade = String(form.unidade || '');
    if (LISTA.UNIDADE.indexOf(unidade) < 0) faltando.push('unidade');
    if (faltando.length) throw new ErroDD('DD-10', { campos: faltando.join(', ') });

    const custoMedio = numeroOpcional_(form.custoMedio, 'custo por unidade');
    const minimo = numeroOpcional_(form.minimo, 'estoque mínimo');
    const saldoInicial = numeroOpcional_(form.saldoInicial, 'quantidade em estoque hoje');

    return comTrava_(() => {
      exigirNomeUnico_(ABA.INSUMOS, nome, 'um insumo');
      const codigo = proximoCodigo('INSUMO', 'INS');
      inserirLinha(ABA.INSUMOS, {
        codigo: codigo,
        nome: nome,
        unidade: unidade,
        minimo: minimo,
        custoMedio: custoMedio,
        ativo: true
      });
      // O saldo nunca é digitado: é a soma dos movimentos. O estoque de hoje entra como ajuste.
      if (saldoInicial > 0) {
        inserirLinha(ABA.MOVIMENTOS, {
          data: new Date(),
          item: codigo,
          itemNome: nome,
          tipo: 'Ajuste',
          quantidade: saldoInicial,
          custoUnit: custoMedio,
          pedido: '',
          quem: quemEsta_(),
          obs: 'Estoque informado no cadastro'
        });
      }
      registrarAtividade('Insumo cadastrado: ' + codigo + ' — ' + nome + ', custo ' + moedaBR_(custoMedio, true) + ' por ' + unidade
        + (saldoInicial > 0 ? ', com ' + String(saldoInicial).replace('.', ',') + ' ' + unidade + ' em estoque' : '') + '.');
      return { codigo: codigo, nome: nome };
    });
  });
}

// ---------- apoio ----------

function exigirNomeUnico_(nomeAba, nome, tipo) {
  const alvo = normalizar_(nome);
  const existe = lerTabela(nomeAba).some(r => normalizar_(r.nome) === alvo);
  if (existe) throw new ErroDD('DD-18', { tipo: tipo, nome: nome, aba: nomeAba });
}

/** Número maior ou igual a zero; vazio vale 0. Qualquer outra coisa gera DD-19 com o nome do campo. */
function numeroOpcional_(v, campo) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = numero_(v);
  if (n === null || n < 0) throw new ErroDD('DD-19', { campo: campo, dica: 'Use só números, com vírgula para os centavos. Deixe em branco se for zero.' });
  return n;
}
