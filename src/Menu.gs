/**
 * Destrava Digital — Menu.
 *
 * O menu só lista o que já funciona: cada bloco novo acrescenta seus itens aqui.
 * onOpen é um gatilho simples: não pode chamar serviços que exigem autorização,
 * então ele só monta o menu.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Destrava')
    .addItem('Configurações', 'abrirConfiguracoes')
    .addItem('Atividades', 'abrirAtividades')
    .addToUi();
}

/** Primeira instalação também monta o menu (quando o script é autorizado pela 1ª vez). */
function onInstall() { onOpen(); }
