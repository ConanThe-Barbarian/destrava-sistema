# Destrava Digital — sistema v1 (código da planilha)

Código Apps Script da planilha modelo. A pasta `src/` é a fonte da verdade: o editor do Apps Script é só onde o código roda.

## Estado atual: bloco 1 — fundação

| Arquivo | O que faz |
| --- | --- |
| `Esquema.gs` | Estrutura inteira: abas, colunas, fórmulas, listas e configurações padrão |
| `Setup.gs` | `configurarPlanilha()` monta ou atualiza o modelo a partir do esquema |
| `Nucleo.gs` | Leitura e gravação por esquema, trava, mensagens DD, atividades, janelas |
| `Licenca.gs` | Licença em **modo desenvolvimento** (liberada) até a API existir |
| `Menu.gs` | Menu **Destrava** (só com o que já funciona) |
| `Configuracoes.gs` + `JanelaConfiguracoes.html` | Marca, contato de suporte e parâmetros de preço |
| `Atividades.gs` + `JanelaAtividades.html` | Registro de atividades legível, com filtro |
| `Estilo.html`, `Base.html` | Visual e script comuns: janela própria de aviso/confirmação, chamada ao servidor |
| `appsscript.json` | Fuso de São Paulo e escopos mínimos (só esta planilha, janelas e chamadas externas) |

## Como instalar (primeira vez)

**Opção A — clasp (recomendada, mantém o código versionado no Git)**

1. `npm install -g @google/clasp` e depois `clasp login`
2. Crie uma planilha nova no Google Drive chamada "Destrava Digital — Modelo".
3. Abra **Extensões › Apps Script**, copie o **ID do script** em Configurações do projeto.
4. Nesta pasta, crie `.clasp.json` com `{"scriptId": "COLE_O_ID", "rootDir": "src"}`
5. `clasp push`

**Opção B — colar no editor**

1. Crie a planilha e abra **Extensões › Apps Script**.
2. Para cada arquivo de `src/`, crie um arquivo com o **mesmo nome** (Script para `.gs`, HTML para `.html`) e cole o conteúdo.
3. Em Configurações do projeto, marque "Mostrar arquivo de manifesto appsscript.json" e cole o conteúdo do `appsscript.json`.

**Depois, nas duas opções:**

1. No editor, selecione a função `configurarPlanilha` e clique em **Executar**. Autorize quando pedir.
2. Volte à planilha e recarregue a página. O menu **Destrava** aparece na barra.

## Roteiro de teste deste bloco

- [ ] As 11 abas existem; só Painel, Pedidos, Clientes, Produtos, Insumos e Caixa ficam visíveis
- [ ] Cadastrar um insumo em Insumos (código `INS-0001`, nome, unidade `g`, custo médio 0,02) mostra Saldo 0 e Situação "OK"
- [ ] Cadastrar um produto em Produtos com horas e preço de venda mostra preço sugerido e margem líquida
- [ ] Destrava › Configurações abre com a cor e o nome padrão; salvar muda o nome do arquivo e a cor da janela
- [ ] Custos fixos + taxas + margem ≥ 100% mostra o aviso na janela e, se insistir, a DD-16
- [ ] Destrava › Atividades lista "Configurações alteradas: …" em frase legível
- [ ] Renomear a aba Caixa e abrir Configurações mostra a DD-21, não um erro técnico
- [ ] Nenhuma janela usa alert ou confirm do navegador

## Próximos blocos

2. Cadastros pelo menu (cliente, produto, insumo) e ficha técnica
3. Pedidos, itens e pagamentos
4. Estoque (entrada, ajuste, baixa e estorno) e caixa
5. Painel
6. Licença real (depois da API)

Antes de gerar o modelo de venda: `MODO_DESENVOLVIMENTO = false` em `Licenca.gs`.
