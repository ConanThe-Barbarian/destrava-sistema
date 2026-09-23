/**
 * Destrava Digital — Menu.
 *
 * O menu só lista o que já funciona: cada bloco novo acrescenta seus itens aqui.
 * onOpen é um gatilho simples: não pode chamar serviços que exigem autorização,
 * então ele só monta o menu.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Destrava')
    .addSubMenu(ui.createMenu('Cadastrar')
      .addItem('Cliente', 'abrirCadastroCliente')
      .addItem('Produto', 'abrirCadastroProduto')
      .addItem('Insumo', 'abrirCadastroInsumo'))
    .addItem('Ficha técnica', 'abrirFichaTecnica')
    .addSeparator()
    .addItem('Configurações', 'abrirConfiguracoes')
    .addItem('Atividades', 'abrirAtividades')
    .addToUi();
}

/** Primeira instalação também monta o menu (quando o script é autorizado pela 1ª vez). */
function onInstall() { onOpen(); }
