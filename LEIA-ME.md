# Destrava Digital — sistema v1 (código da planilha)

Código Apps Script da planilha modelo. A pasta `src/` é a fonte da verdade: o editor do Apps Script é só onde o código roda.

## Teste automático

No editor do Apps Script, escolha a função **`testarSistema`** e clique em **Executar**. Em cerca de 1 minuto aparece uma janela na planilha com o relatório (✅ ou ❌ em cada verificação). O mesmo texto fica no Registro de execução.

- Confere estrutura, fórmulas, configurações, cadastros, ficha técnica, cálculo de preço, pedidos (ciclo, pagamento, baixa e estorno de estoque, cancelamento), entrada e ajuste de estoque, custo médio, caixa avulso, painel do mês, licença (com o servidor simulado) e atividades.
- Usa a própria planilha com dados marcados `[TESTE]` e, no fim, apaga tudo e devolve configurações, contadores e nome do arquivo como estavam.
- Não use a planilha enquanto ele roda.
- Rode depois de cada `clasp push`. Cada bloco novo acrescenta os testes dele.
- `Testes.gs` **sai do modelo de venda**.

## Bloco 1 — fundação

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

## Bloco 2 — cadastros e ficha técnica

| Arquivo | O que faz |
| --- | --- |
| `Cadastros.gs` + `JanelaCadastro.html` | Destrava › Cadastrar › Cliente, Produto e Insumo. Gera o código, recusa nome repetido (DD-18) e dados inválidos (DD-19) |
| `FichaTecnica.gs` + `JanelaFicha.html` | Destrava › Ficha técnica: insumos por unidade do produto, com custo calculado na hora |

Regra de uso: **criar** cadastros sempre pelo menu (é ele que gera o código). **Alterar** um cadastro existente pode ser direto na célula.

### Roteiro de teste do bloco 2

- [ ] Cadastrar › Cliente com WhatsApp de 11 dígitos grava `(11) 91234-5678` e código `CLI-0001`
- [ ] Cadastrar o mesmo nome de novo, com maiúsculas ou sem acento, mostra a DD-18
- [ ] WhatsApp com 5 dígitos ou e-mail sem domínio mostram a DD-19
- [ ] Cadastrar › Insumo: "Paguei 6,50 por 1000 g" calcula custo 0,0065; "Quanto tem hoje" 5000 faz o saldo em Insumos mostrar 5.000
- [ ] Cadastrar › Produto (encomenda, 1,5 h, preço 80) mostra a prévia do preço e o botão "Montar ficha técnica"
- [ ] O botão abre a Ficha técnica já com o produto escolhido
- [ ] Ficha com 300 g de farinha: o total da janela confere com a coluna "Custo dos insumos" em Produtos após salvar
- [ ] O mesmo insumo em duas linhas mostra a DD-19; quantidade zero também
- [ ] Trocar de produto ou fechar com alterações pede confirmação na janela própria
- [ ] Remover todas as linhas e salvar pede confirmação e apaga a ficha
- [ ] Atividades mostra as frases de cada cadastro e ficha, com custo por grama em 4 casas (R$ 0,0065)

## Bloco 3 — pedidos, itens e pagamentos

| Arquivo | O que faz |
| --- | --- |
| `Pedidos.gs` | Criar e alterar pedido, ciclo de status, pagamento, cancelamento, baixa e estorno de estoque |
| `JanelaPedido.html` | Destrava › Novo pedido (e "Alterar itens" de um orçamento) |
| `JanelaPedidos.html` | Destrava › Pedidos: lista com busca e filtro, detalhe, avançar status, pagamento e cancelamento |

Regras: um passo de status por vez (Orçamento → Confirmado → Em produção → Pronto → Entregue); pedido só de pronta-entrega pode ir de Confirmado direto para Entregue. Itens só mudam no orçamento (DD-22). Em produção baixa os insumos da ficha; Entregue baixa os produtos prontos; Cancelado estorna tudo e pode devolver dinheiro (DD-23 se passar do pago). Estoque negativo e produto sem ficha pedem confirmação, não bloqueiam.

### Roteiro de teste do bloco 3

- [ ] Novo pedido com cliente da lista, 2 tortas de R$ 80, desconto 10, confirmado com sinal de 50 no Pix: Pedidos mostra total 150, pago 50, saldo 100; Caixa ganha a entrada do sinal
- [ ] "Cliente novo" no pedido cadastra o cliente em Clientes com código
- [ ] Sem itens mostra a DD-10; sinal acima do total, a DD-15; entrega no passado pede confirmação
- [ ] Em Pedidos, avançar para Em produção baixa os insumos da ficha (confira em Insumos)
- [ ] Quantidade que deixa insumo negativo pede confirmação e, confirmando, a Situação vira "Repor"
- [ ] Registrar pagamento maior que o saldo mostra a DD-15; o valor exato quita o pedido
- [ ] Entregar com saldo em aberto avisa quanto falta receber
- [ ] Cancelar pedido em produção devolve os insumos; devolução maior que o pago mostra a DD-23
- [ ] Pedido só de pronta-entrega oferece Entregue direto e baixa o estoque do produto
- [ ] "Alterar itens" só aparece em orçamento
- [ ] Pedido com entrega vencida aparece marcado como atrasado na lista
- [ ] Atividades conta cada passo em frase legível

## Bloco 4 — estoque e caixa

| Arquivo | O que faz |
| --- | --- |
| `Estoque.gs` + `JanelaEstoque.html` | Destrava › Entrada de estoque e Ajuste de estoque (a mesma janela, em dois modos) |
| `Caixa.gs` + `JanelaCaixa.html` | Destrava › Caixa: resumo do mês, lançamento avulso e exclusão de avulso |

Regras:

- **Compra de insumo** recalcula o custo médio: (saldo × custo atual + valor pago) ÷ (saldo + quantidade). Com saldo zerado ou negativo, vale o custo da compra.
- **Produto de pronta-entrega** entra de dois jeitos:
  - "Produzi aqui": baixa os insumos da ficha como "Saída por produção";
  - "Comprei pronto": recalcula o custo de compra pela mesma média.
- **Compra** pode lançar a saída no caixa na hora.
- **Ajuste**: informe quanto existe de verdade e o motivo (obrigatório). O sistema grava só a diferença.
- **Caixa**:
  - pedidos lançam o próprio dinheiro; aqui entra só o avulso;
  - data futura é recusada;
  - lançamento de pedido não se exclui por aqui.

Depois do `clasp push`, rode `configurarPlanilha` uma vez. Ele acrescenta o tipo "Saída por produção" à lista da aba Movimentos.

### Roteiro de teste do bloco 4

- [ ] Entrada de 1000 g de um insumo a R$ 0,01 por R$ 30 mostra na janela "custo médio passa a R$ 0,0200" antes de salvar; depois, Insumos confere
- [ ] A mesma compra com "Lançar a saída no caixa" aparece no Caixa como Compra de insumos
- [ ] Produto de pronta-entrega com ficha abre em "Produzi aqui"; produzir 10 baixa os insumos e soma 10 ao produto
- [ ] Produzir mais do que os insumos permitem pede confirmação (DD-14); sem ficha, avisa (DD-13)
- [ ] Ajuste: contar menos do que o sistema mostra a diferença negativa e pede confirmação; sem motivo, DD-10
- [ ] Caixa abre no mês atual com Entrou, Saiu e Resultado; setas trocam de mês e não passam do mês atual
- [ ] Lançar saída de conta de luz com data de ontem aparece com a data de ontem
- [ ] Escolher "Venda sem pedido" mostra a dica de usar Novo pedido para produtos com estoque
- [ ] Excluir um lançamento avulso pede confirmação e registra em Atividades; lançamento de pedido não tem botão de excluir

## Bloco 5 — painel do mês

| Arquivo | O que faz |
| --- | --- |
| `Painel.gs` | Monta a aba Painel: 6 números, 2 listas e o gráfico dos últimos 6 meses, tudo por fórmula |

O painel se atualiza sozinho. O dono só escolhe o mês na lista (em branco = mês atual). A cor e o nome do negócio vêm de Configurações.

| Número | Conta |
| --- | --- |
| Vendido no mês | Total dos pedidos marcados Entregue no mês (pela nova coluna "Entregue em" da aba Pedidos) |
| Recebido no mês | Entradas do caixa no mês, sem "Dinheiro colocado pelo dono" |
| A receber | Saldo dos pedidos, sem cancelados e sem orçamentos |
| Margem média | (Vendido − custo de materiais dos entregues) ÷ Vendido. Não desconta hora nem custos fixos |
| Resultado do caixa | Todas as entradas − todas as saídas do mês |
| Pedidos em aberto | Confirmados, em produção e prontos (orçamentos aparecem na legenda) |

Listas: entregas até daqui a 7 dias, com os atrasados em vermelho; e insumos abaixo do mínimo. Cada lista mostra 12 linhas e avisa quando há mais.

Depois do `clasp push`, rode `configurarPlanilha`. Ele cria a coluna "Entregue em" em Pedidos e monta o painel. Pedidos entregues antes desta versão não têm essa data e não entram no Vendido.

### Roteiro de teste do bloco 5

- [ ] O painel abre sem nenhum #ERROR!, com o nome e a cor do negócio no título
- [ ] Entregar um pedido hoje soma o total dele em Vendido; registrar o pagamento soma em Recebido
- [ ] Uma entrada "Dinheiro colocado pelo dono" não muda Recebido, mas muda Resultado do caixa
- [ ] Um orçamento não entra em A receber nem em Pedidos em aberto (aparece na legenda)
- [ ] Pedido confirmado com entrega em 3 dias aparece em Entregas; com data vencida aparece em vermelho, antes dos outros
- [ ] Insumo abaixo do mínimo aparece em Insumos para repor
- [ ] Escolher o mês passado na lista muda os 6 números e o gráfico; apagar a célula volta ao mês atual
- [ ] Mudar a cor em Configurações muda o título, os cartões e o gráfico

## Bloco 6 — licença

| Arquivo | O que faz |
| --- | --- |
| `Licenca.gs` | Ativação da chave, aprovação diária e a porta `exigirLicenca_()` de toda gravação |
| `JanelaLicenca.html` | Destrava › Licença: ativar com a chave e o nome do cliente, ver a situação, "Conferir agora" |

Regras:

- **Sem aprovação do dia, nada é gravado.** Ler a planilha nunca depende da licença.
- **Uma chamada ao servidor por dia**, na primeira ação que grava. A aprovação vale até 23h59 de São Paulo.
- **Arquivo copiado não herda a aprovação.** A licença guarda o ID da planilha; a cópia precisa de ativação própria.
- **Janela:** mostra só o fim da chave (`DD-••••-••••-XXXX`) e cuida de cada situação:
  - limite atingido: mostra o botão "Aumentar meu plano", que só aceita link da Hotmart;
  - revogada: DD-04;
  - servidor fora: DD-05.
- **Plano Agência** esconde "feito com Destrava Digital" do rodapé, a partir da aprovação seguinte.
- **Testes:** a janela de ativação sempre fala com a API de verdade, mesmo em modo desenvolvimento. O `testarSistema` usa um servidor simulado.

### Roteiro de teste do bloco 6 (com a API no ar)

- [ ] No painel `/admin`, "Registrar compra" cria uma licença de teste para o seu e-mail; a chave chega no e-mail
- [ ] Destrava › Licença: chave errada mostra a DD-02; a chave certa ativa e mostra "Aprovada hoje", o plano e "1 de 5"
- [ ] Ativar de novo a mesma planilha diz "já estava ativada" e continua 1 de 5
- [ ] No painel, a planilha aparece com o nome do cliente; "Liberar vaga" e depois "Conferir agora" na planilha mostra a DD-01
- [ ] Revogar no painel e "Conferir agora" mostra a DD-04; reativar e conferir volta ao normal
- [ ] Com `MODO_DESENVOLVIMENTO = false` numa cópia de teste: gravar sem ativar mostra a DD-01

## Próximos passos

- Manual em PDF
- Página de vendas e cadastro na Hotmart

Antes de gerar o modelo de venda:

1. `MODO_DESENVOLVIMENTO = false` em `Licenca.gs`.
2. Apagar `Testes.gs`.
3. Rodar `configurarPlanilha`.
4. Conferir que Destrava › Licença não mostra o aviso de modo desenvolvimento.
