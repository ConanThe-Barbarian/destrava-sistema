/**
 * Destrava Digital — Janela de Atividades.
 * Mostra as últimas 200 ações em frases legíveis, da mais recente para a mais antiga.
 */

function abrirAtividades() {
  abrirJanela_('JanelaAtividades', 'Atividades', 640, 600);
}

function listarAtividades() {
  return executar_('listarAtividades', () => {
    const fuso = Session.getScriptTimeZone();
    return lerTabela(ABA.ATIVIDADES)
      .slice(-200)
      .reverse()
      .map(r => ({
        quando: r.data instanceof Date ? Utilities.formatDate(r.data, fuso, "dd/MM/yyyy 'às' HH:mm") : '',
        quem: String(r.quem || ''),
        oque: String(r.oque || '')
      }));
  });
}
