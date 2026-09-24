/**
 * Destrava Digital — Janela de Configurações.
 *
 * Marca do cliente (nome, logo, cor), contato de quem implantou e parâmetros de preço.
 * Percentuais chegam da janela em "15" (15%) e são guardados como fração (0,15).
 */

function abrirConfiguracoes() {
  abrirJanela_('JanelaConfiguracoes', 'Configurações', 600, 640);
}

function carregarConfiguracoes() {
  return executar_('carregarConfiguracoes', () => {
    const c = lerConfig();
    return {
      nomeNegocio: String(c.NOME_NEGOCIO || ''),
      logoUrl: String(c.LOGO_URL || ''),
      logoPreview: urlLogo_(String(c.LOGO_URL || '')),
      cor: String(c.COR_PRINCIPAL || '#8b7bff'),
      implantadorNome: String(c.IMPLANTADOR_NOME || ''),
      implantadorWhatsapp: String(c.IMPLANTADOR_WHATSAPP || ''),
      valorHora: Number(c.VALOR_HORA) || 0,
      custosFixosPct: paraPercentual_(c.CUSTOS_FIXOS_PCT),
      taxasPct: paraPercentual_(c.TAXAS_PCT),
      margemPct: paraPercentual_(c.MARGEM_PCT)
    };
  });
}

function salvarConfiguracoes(form) {
  return executar_('salvarConfiguracoes', () => {
    exigirLicenca_();

    const faltando = [];
    const nome = String(form.nomeNegocio || '').trim();
    if (!nome) faltando.push('nome do negócio');
    const valorHora = numero_(form.valorHora);
    if (valorHora === null || valorHora < 0) faltando.push('valor da hora');
    const fixos = numero_(form.custosFixosPct);
    const taxas = numero_(form.taxasPct);
    const margem = numero_(form.margemPct);
    if (fixos === null || fixos < 0) faltando.push('custos fixos');
    if (taxas === null || taxas < 0) faltando.push('taxas');
    if (margem === null || margem < 0) faltando.push('margem desejada');
    if (faltando.length) throw new ErroDD('DD-10', { campos: faltando.join(', ') });
    if (fixos + taxas + margem >= 100) throw new ErroDD('DD-16');

    const cor = /^#[0-9a-f]{6}$/i.test(String(form.cor)) ? String(form.cor) : '#8b7bff';
    const whatsapp = String(form.implantadorWhatsapp || '').replace(/\D/g, '');

    return comTrava_(() => {
      const alteradas = salvarConfig({
        NOME_NEGOCIO: nome,
        LOGO_URL: String(form.logoUrl || '').trim(),
        COR_PRINCIPAL: cor,
        IMPLANTADOR_NOME: String(form.implantadorNome || '').trim(),
        IMPLANTADOR_WHATSAPP: whatsapp,
        VALOR_HORA: valorHora,
        CUSTOS_FIXOS_PCT: fixos / 100,
        TAXAS_PCT: taxas / 100,
        MARGEM_PCT: margem / 100
      });
      // O nome do arquivo acompanha o nome do negócio.
      const ss = SpreadsheetApp.getActive();
      const nomeArquivo = nome + ' — Gestão';
      if (ss.getName() !== nomeArquivo) ss.rename(nomeArquivo);
      pintarPainel_(ss, nome, cor);
      return { alteradas: alteradas.length, marca: marcaAtual_() };
    });
  });
}

// ---------- utilitários de número ----------

/** Aceita "12,5", "12.5", "R$ 1.234,56". Devolve null se não for número. */
function numero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v || '').replace(/[R$\s%]/g, '');
  if (!s) return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function paraPercentual_(fracao) {
  const n = Number(fracao) || 0;
  return Math.round(n * 1000) / 10;
}
