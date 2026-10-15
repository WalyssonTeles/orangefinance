# Orange Finance — Funcionalidades do app

> **Versão 0.1.0 · Fase 1 (local)**
> Este arquivo descreve o que o app **já faz hoje**.
> No final há um espaço para você escrever as funcionalidades que deseja nas próximas versões.

---

## 1. Visão geral

O Orange Finance é um app de gestão financeira pessoal, irmão do Orange Notes. Ele funciona no navegador do computador e do celular e pode ser **instalado como aplicativo** (PWA). Nesta fase:

- tudo funciona **sem internet**;
- os dados ficam salvos **apenas no dispositivo/navegador** em que foram cadastrados;
- **não há login, servidor nem sincronização** (planejado para uma próxima fase).

---

## 2. Início (painel)

- Saudação de acordo com o horário (“Bom dia”, “Boa tarde”, “Boa noite”) e com o nome configurado em Ajustes.
- **Seletor de mês**: setas para navegar e clique no nome do mês para voltar ao mês atual. O mês escolhido vale para Início, Lançamentos e Orçamentos.
- **Cartão de saldo**:
  - **Saldo em contas** — soma das contas (sem os cartões de crédito), considerando apenas o que já foi pago/recebido;
  - **Previsto para o fim do mês** — saldo somando também os lançamentos pendentes até o último dia do mês;
  - **Receitas** e **Despesas** do mês.
- **Gastos por categoria**: gráfico de rosca com as 5 maiores categorias, percentual e valor de cada uma, além do total de “Outras categorias”.
- **Contas a pagar**: despesas pendentes até o fim do mês, com destaque para **atrasadas** e **vencendo hoje**. Um clique no círculo marca como pago (com opção **Desfazer**).
- **Orçamentos**: os 4 orçamentos mais próximos do limite, com barra de progresso.
- **Últimos 6 meses**: gráfico de barras de receitas × despesas. Clicar em um mês muda o mês selecionado.
- **Cartões de crédito**: fatura atual de cada cartão e botão **Pagar**.
- **Últimos lançamentos**: os 5 mais recentes.
- **Primeiro uso**: convite para criar o primeiro lançamento ou **explorar com dados de exemplo** (6 meses de dados fictícios para conhecer todas as telas).

---

## 3. Lançamentos

### Criar e editar
- Botão **+** (barra inferior no celular), **Novo lançamento** (menu lateral no computador) ou tecla **N**.
- Três tipos: **Despesa**, **Receita** e **Transferência** entre contas.
- **Campo de valor estilo app de banco**: os números entram pela direita (digitar `1`, `2`, `5`, `0` resulta em `12,50`). No celular, abre o teclado numérico.
- Descrição (opcional), categoria com ícone e cor, conta ou cartão, data (com atalhos **Hoje** e **Ontem**) e observações.
- Status **Pago / Recebido** ou **Pendente**.
- **Repetição** (ao criar despesas e receitas):
  - **Parcelada** — divide o valor total em 2 a 120 parcelas mensais, sem perder centavos, com o selo `2/10` em cada parcela;
  - **Mensal** — repete o mesmo valor por N meses (ex.: aluguel, assinaturas).
  - Apenas o primeiro lançamento usa o status escolhido; os próximos ficam pendentes.
- Validação com mensagens claras (valor zerado, categoria não escolhida, transferência para a mesma conta etc.).
- Editar um lançamento de uma série altera só aquele lançamento.

### Excluir
- Confirmação antes de excluir.
- Em séries (parcelas ou mensais): excluir **só este** ou **este e os próximos**.
- Aviso com botão **Desfazer** após excluir.

### Lista
- Agrupada por dia (“Hoje”, “Ontem”, “Quinta-feira, 22 de outubro”…).
- Resumo do mês: **Receitas**, **Despesas** e **Resultado**.
- **Busca** por descrição, categoria ou observação (ignora acentos e maiúsculas).
- Filtros por tipo (**Todos, Despesas, Receitas, Transferências, Pendentes**), por **conta** e por **categoria**, com botão **Limpar filtros**.
- Cada item mostra ícone da categoria, conta, selo de parcela/mensal, valor e status (**Pago**, **Recebido**, **Pendente** ou **Atrasado**). Clicar no status alterna entre pago e pendente.

---

## 4. Contas e cartões

- Tipos: **Conta corrente, Poupança, Carteira, Investimentos e Cartão de crédito**, cada um com ícone e cor escolhida.
- **Saldo inicial** (pode ser negativo) para começar com o valor real da conta.
- Saldo atual e saldo **previsto no fim do mês** de cada conta.
- Totais: **Saldo em contas** e **Faturas de cartão**.
- **Cartão de crédito**:
  - compras no cartão aumentam a fatura, sem reduzir o saldo das contas;
  - limite do cartão com barra de uso e **limite disponível**;
  - fatura em aberto inicial (para quem já tem compras antes de usar o app);
  - botão **Pagar fatura**, que abre uma transferência já preenchida com o valor da fatura.
- Uma conta com lançamentos não pode ser excluída. Isso evita perder histórico.

---

## 5. Orçamentos

- Limite **mensal** por categoria de despesa, repetido todos os meses.
- Resumo: **Planejado**, **Gasto** e **Restante/Excedido**, com barra geral.
- Cada orçamento mostra gasto × limite, percentual e quanto **resta** ou quanto **excedeu**.
- Cores: verde até 79%, laranja de 80% a 100% e vermelho acima do limite.
- Total gasto em **categorias sem orçamento**.
- Navegação por mês para consultar meses anteriores.

---

## 6. Ajustes

- **Nome** usado na saudação.
- **Ocultar valores ao abrir o app** (privacidade). O botão de olho também oculta e mostra os valores a qualquer momento.
- **Categorias**: 12 de despesa e 5 de receita já vêm prontas. É possível criar, renomear, trocar ícone (26 opções) e cor (14 opções) e excluir as que não são usadas em lançamentos.
- **Backup**:
  - **Exportar** todos os dados em um arquivo `.json`;
  - **Importar** um backup, substituindo os dados atuais após confirmação.
- **Apagar todos os dados** do dispositivo, com confirmação.
- Versão do app.

---

## 7. Aparência e uso

- Identidade visual Orange: fundo creme, laranja como destaque, tipografia Bricolage Grotesque e Figtree, logo da laranja com gomos em forma de gráfico.
- **Computador**: menu lateral fixo.
- **Celular**: barra superior com ocultar valores e Ajustes; barra inferior com Início, Lançamentos, botão **+**, Contas e Orçamentos.
- Formulários como **folha inferior** no celular e **janela central** no computador. **Esc** fecha.
- Layout ajustado até **320 px** de largura.
- Valores com algarismos alinhados e formato brasileiro (`R$ 1.234,56`).
- Respeita a preferência do sistema por **menos animações**.
- **PWA**: instalável no Windows (Edge/Chrome), Android e iPhone, com funcionamento offline.

---

## 8. Limitações conhecidas desta fase

- Os dados **não sincronizam** entre dispositivos. Cada navegador/celular tem seus próprios dados. Use **Exportar/Importar backup** para transferi-los manualmente.
- Limpar os dados do navegador apaga os dados do app. Faça backups.
- A fatura do cartão é o saldo acumulado do cartão. Ainda **não há dia de fechamento e vencimento** nem separação por fatura mensal.
- Editar uma série altera só o lançamento escolhido. Ainda não há opção “alterar este e os próximos”.
- Não há relatórios avançados, metas, anexos de comprovantes nem importação de extratos.

---

## 9. Funcionalidades desejadas ✍️

> Escreva abaixo o que você quer que o Orange Finance faça. Pode ser em tópicos simples — depois transformamos em tarefas.
> Dica: indique a prioridade com **(alta)**, **(média)** ou **(baixa)**.

### Próximas funcionalidades

-
-
-

### Ideias para o futuro

-
-

### Ajustes no que já existe

-
-
