/**
 * Destrava Digital — Licença (lado da planilha).
 *
 * ETAPA ATUAL: modo desenvolvimento. A API de licenças ainda não existe, então
 * exigirLicenca_() libera tudo. Quando a API estiver no ar (semana 2), este arquivo
 * ganha a ativação e a aprovação diária descritas na especificação, e
 * MODO_DESENVOLVIMENTO passa a false ANTES de gerar o modelo de venda.
 *
 * A situação da licença fica nas propriedades do documento (não numa aba), para o
 * usuário não alterar sem querer.
 */

const MODO_DESENVOLVIMENTO = true;

/** Chamada no início de toda ação que grava. Lança ErroDD se não puder gravar. */
function exigirLicenca_() {
  if (MODO_DESENVOLVIMENTO) return;
  // Semana 2: ativação obrigatória + aprovação do dia (ver especificação da API).
  throw new ErroDD('DD-01');
}

function lerLicencaLocal_() {
  const p = PropertiesService.getDocumentProperties().getProperty('DESTRAVA_LICENCA');
  if (!p) return { ativa: MODO_DESENVOLVIMENTO, mostrarMarca: true };
  try { return JSON.parse(p); } catch (e) { return { ativa: false, mostrarMarca: true }; }
}
