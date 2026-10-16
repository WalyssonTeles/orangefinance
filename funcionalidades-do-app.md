# Orange Finance — Funcionalidades do app

> **Versão 1.1.0**
> Este arquivo descreve o que o app **já faz hoje**.
> No final há um espaço para você escrever as funcionalidades que deseja nas próximas versões.
> As versões anteriores estão salvas no GitHub nas tags `v0.1.0` e `v1.0.0`.

---

## Versão 1.1 — ajustes implementados

- Seletor mensal com setas de um mês, seleção de meses em grade 4 × 3 e navegação por páginas de 12 anos (2015–2026, 2003–2014 etc.). No celular, a seleção abre em tela cheia.
- Na home mobile, seletor abaixo da saudação e acima do saldo, ocupando a largura disponível. Em Lançamentos, seletor expandido e remoção do botão redundante “+ Novo”.
- Mais ícones de categoria, incluindo beleza, e quatro novas cores.
- Titular opcional em contas e cartões de espaços compartilhados, sem modificar os lançamentos existentes.
- Uma única ação de retorno por nível de Ajustes, com área de toque ampliada.
- Campo para o responsável alterar o nome do espaço compartilhado.
- Relatório por pessoa em formato de comprovante, com atalhos para lançamentos por titular e tipo.
- Labels visíveis nos filtros de Lançamentos.
- Itens de Gastos por categoria abrem Lançamentos com a categoria aplicada.
- Preservação de contas, lançamentos, backups e sincronização de usuários existentes. Arquivamento após desvinculação e Excel não fazem parte desta versão.

---

## 1. Visão geral

O Orange Finance é um app de gestão financeira pessoal, irmão do Orange Notes. Ele funciona no navegador do computador e do celular e pode ser **instalado como aplicativo** (PWA).

- Tudo funciona **sem internet**; os dados ficam salvos no aparelho.
- Opcionalmente, **Entrar com Google** sincroniza os dados entre aparelhos pelo Supabase.
- Cada conta tem um espaço **Pessoal** e pode participar de **espaços compartilhados** (ex.: família).

---

## 2. Início (painel)

- Saudação de acordo com o horário e com o nome definido em **Ajustes → Perfil**.
- **Seletor de espaço**: ao lado do nome do espaço, a seta para baixo abre a lista de espaços (Pessoal e compartilhados) para trocar, além do atalho **Gerenciar espaços**.
- **Seletor de mês**: setas avançam/voltam um mês. O título abre a grade de 12 meses (4 colunas); as setas internas mudam um ano. Clicar no ano abre páginas de 12 anos, sem sobreposição (2015–2026, 2003–2014 etc.); selecionar um ano retorna aos meses e selecionar um mês aplica o período. Há também o atalho **Mês atual**. No celular, o seletor fica abaixo da saudação, com largura total, e abre em tela cheia. O mês escolhido vale para Início, Lançamentos e Orçamentos.
- **Cartão de saldo**:
  - **Saldo em contas** — soma das contas (sem os cartões de crédito), considerando apenas o que já foi pago/recebido;
  - **Previsto para o fim do mês** — saldo somando também os lançamentos pendentes até o último dia do mês;
  - **Receitas** e **Despesas** do mês.
  - O cartão é clicável: o **saldo** abre Lançamentos com tudo (entradas e saídas), **Receitas** abre só as receitas e **Despesas** só as despesas do mês.
- **Por pessoa** (espaços compartilhados): comprovantes com nome, receitas, despesas e total do mês. Nome/total abrem Lançamentos pelo titular; receitas/despesas combinam os dois filtros. As linhas têm área de toque ampliada.
- **Gastos por categoria**: gráfico de rosca com as 5 maiores categorias e as demais agrupadas; a lista mostra todas as categorias, com percentual e valor. Clicar numa linha abre as despesas daquela categoria no mês.
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
- **Editar séries**: ao salvar um lançamento parcelado ou mensal, escolha **Só este** ou **Este e os próximos**. Todos os dados mudam (valor, descrição, categoria, conta, observações, titular). Nos próximos, o status pago/pendente é mantido e uma nova data preserva a repetição mensal (ex.: dia 10 → dia 15 em todos os meses seguintes).
- **Titular** (espaços compartilhados): indica a quem pertence a receita ou despesa. Por padrão é quem lança, mas pode ser outro participante ou “Sem titular”.
- O formulário mostra em qual espaço o lançamento será salvo.

### Excluir
- Confirmação antes de excluir.
- Em séries (parcelas ou mensais): excluir **só este** ou **este e os próximos**.
- Aviso com botão **Desfazer** após excluir.

### Lista
- Agrupada por dia (“Hoje”, “Ontem”, “Quinta-feira, 22 de outubro”…).
- Resumo do mês: **Receitas**, **Despesas** e **Resultado**.
- **Busca** por descrição, categoria ou observação (ignora acentos e maiúsculas).
- Filtros por tipo (**Todos, Despesas, Receitas, Transferências, Pendentes**), por **conta** e por **categoria**, com botão **Limpar filtros**. O filtro de categoria lista **só as categorias presentes nos lançamentos da tela** (mês, tipo e pessoa escolhidos).
- **Por pessoa** (espaços compartilhados): ver tudo junto ou apenas os lançamentos de um participante; o resumo do mês acompanha o filtro.
- Labels visíveis: **Buscar Lançamentos**, **Tipo de Lançamento**, **Titular** (espaços compartilhados), **Contas e Cartões** e **Categoria**. Os atalhos do painel preenchem os filtros, que continuam combináveis.
- Seletor de mês com largura total no celular e expandido no computador; sem botão “+ Novo” redundante. A criação continua pela barra inferior, menu lateral ou tecla N.
- Cada item mostra ícone da categoria, titular (em espaços compartilhados), conta, selo de parcela/mensal, valor e etiqueta de status: **verde** quando pago/recebido e **vermelha** quando pendente ou atrasado.
- **O item inteiro é clicável** e abre o lançamento.
- **Computador**: ao passar o mouse (ou navegar com Tab), aparecem os botões **relógio** (marcar pendente) ou **check** (marcar pago) e **lixeira** (excluir).
- **Celular**: deslize o item para a esquerda para abrir a gaveta com **Pago/Pendente** e **Excluir**, como nos apps de e-mail. Tocar no item aberto fecha a gaveta.
- Excluir pela lista pergunta **Só este / Este e os próximos** em séries; todas as ações oferecem **Desfazer**.

---

## 4. Contas e cartões

- Tipos: **Conta corrente, Poupança, Carteira, Investimentos e Cartão de crédito**, cada um com ícone e cor escolhida.
- **Saldo inicial** (pode ser negativo) para começar com o valor real da conta.
- **Titular opcional** em contas e cartões de espaços compartilhados, exibido nos cartões e seletores de conta. Contas antigas continuam sem titular; definir o titular da conta não reatribui seus lançamentos.
- Categorias têm ícones adicionais (beleza, salão, cuidados pessoais, educação, transporte, internet, doações etc.) com nomes em português. A paleta ganhou preto, vermelho, ciano e roxo.
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

A tela Ajustes mostra um **menu**; cada item abre sua própria tela, com o botão **← Ajustes** para voltar.

- **Perfil**: nome (usado na saudação e mostrado aos participantes dos espaços compartilhados), sexo e data de nascimento. Sexo e data são opcionais e visíveis apenas para você. Com login, o perfil acompanha a conta em todos os aparelhos.
- **Conta e sincronização**: entrar com Google, status da sincronização, resolução de conflitos e sair da conta.
- **Espaço compartilhado**:
  - lista dos espaços compartilhados e os botões **Criar novo** e **Inserir código**;
  - dentro de um espaço: **código de 10 caracteres** (letras e números sem caracteres ambíguos) com botão **Copiar**, e a lista de participantes pelo nome definido no Perfil de cada um;
  - o responsável pode **alterar o nome do espaço**, **gerar um novo código** (o anterior deixa de funcionar) e **remover participantes**; participantes podem **sair do espaço**;
  - por segurança, há limite de tentativas com códigos inválidos.
- **Preferências**: ocultar valores ao abrir o app (privacidade). O botão de olho também oculta e mostra os valores a qualquer momento.
- **Categorias**: 12 de despesa e 5 de receita já vêm prontas. É possível criar, renomear, trocar ícone (41 opções) e cor (18 opções) e excluir as que não são usadas em lançamentos.
- **Retorno**: uma ação por nível, “Voltar para ajustes” nas seções e “Voltar” nos detalhes de um espaço, com altura mínima de 48 px.
- **Backup e dados**: exportar e importar o espaço aberto em `.json` e apagar todos os dados, com confirmação.
- Versão do app no fim do menu.

---

## 7. Aparência e uso

- Identidade visual Orange: fundo creme, laranja como destaque, tipografia Bricolage Grotesque e Figtree, logo da laranja com gomos em forma de gráfico.
- **Ícone e nome do app** no cabeçalho levam à tela inicial.
- **Computador**: menu lateral fixo.
- **Celular**: barra superior com ocultar valores e Ajustes; barra inferior com Início, Lançamentos, botão **+**, Contas e Orçamentos.
- Formulários como **folha inferior** no celular e **janela central** no computador. **Esc** fecha.
- Layout ajustado até **320 px** de largura.
- Valores com algarismos alinhados e formato brasileiro (`R$ 1.234,56`).
- Respeita a preferência do sistema por **menos animações**.
- **PWA**: instalável no Windows (Edge/Chrome), Android e iPhone, com funcionamento offline.

---

## 8. Limitações conhecidas

- Limpar os dados do navegador apaga a cópia local. Com login, os dados voltam da nuvem; sem login, faça backups.
- A fatura do cartão é o saldo acumulado do cartão. Ainda **não há dia de fechamento e vencimento** nem separação por fatura mensal.
- Lançamentos criados antes da 1.0 em espaços compartilhados aparecem como “Sem titular” até serem editados.
- Quem tiver o código de um espaço compartilhado pode entrar nele. Compartilhe o código por meio privado e gere um novo se necessário.
- Não há relatórios avançados, metas, anexos de comprovantes nem importação de extratos.

---

## 9. Histórico de versões

- **1.1.0** — seletor de meses/anos em tela cheia no celular, ajustes responsivos, 15 ícones e quatro cores adicionais, titular de contas/cartões, retorno único e ampliado, renomeação de espaços, comprovantes por pessoa clicáveis, labels nos filtros e atalhos por categoria. Mantém dados e backups anteriores.
- **1.0.0** — edição de séries (“só este” ou “este e os próximos”), cartão do início clicável, filtro de categorias por tela, cabeçalho leva ao início, Ajustes em menu, Perfil, titular e relatórios por pessoa, espaços compartilhados com código de 10 caracteres, seletor de espaço no início e ações rápidas nos lançamentos (hover no computador e gaveta no celular). Atualização compatível: nenhum dado existente é apagado.
- **0.1.0** — app local, login com Google, sincronização e espaços familiares.

---

## 10. Funcionalidades desejadas ✍️

> Escreva abaixo o que você quer que o Orange Finance faça. Pode ser em tópicos simples — depois transformamos em tarefas.
> Dica: indique a prioridade com **(alta)**, **(média)** ou **(baixa)**.

### Versão 1.0 (usabilidade) — ✅ implementada

> Requisito geral: a atualização **não pode apagar nem alterar** os dados atuais dos usuários (lançamentos, contas, categorias, orçamentos, espaços e sincronização).

#### Editar gastos recorrentes
Ter a opção de editar os gastos/receitas recorrentes. Exemplo: uma despesa que se repete todo mês, mas no terceiro mês muda o valor. Poder mudar no app e escolher alterar **apenas esse** ou **este e os próximos**. Não só o valor: todos os demais dados também, igual já existe para excluir.

#### Tela inicial — Card em destaque
Na tela inicial, ao clicar no card em destaque: clicar em **Despesas** mostra as despesas; clicar em **Receitas** mostra as receitas; clicar no **total** mostra a tela com tudo, entradas e saídas.

#### Tela de lançamentos — filtro de categorias
Na opção de filtrar categorias, exibir só as categorias disponíveis nesta tela.

#### Ícone do Header
Clicar no ícone e no nome do app no cabeçalho leva para a tela inicial.

#### Ajustes — menu em profundidade
Não expor todas as opções de uma vez. Mostrar um menu que leva a telas próprias, por exemplo: Conta e sincronização, Backup, Preferências do espaço, Categorias.

#### Ajustes — Perfil
Área de perfil com nome do usuário, sexo e data de nascimento.

#### Espaço compartilhado — titular dos lançamentos
No espaço compartilhado, apontar a quem pertence cada despesa ou receita, para gerar relatórios por pessoa e com tudo. Exemplo: eu lanço meu salário e me marco como titular; minha esposa lança os rendimentos e despesas dela e se marca como titular (ou me marca, se lançar algo por mim). Nos lançamentos posso ver tudo junto ou por pessoa, inclusive quando houver mais pessoas vinculadas.

#### Espaço compartilhado — gerenciamento e código de acesso
Item **Espaço compartilhado** em Ajustes, com a lista de espaços e os botões **Criar novo** e **Inserir código**. Dentro de um espaço existente: código de **10 caracteres** (como no Among Us) com botão de copiar, para outras pessoas entrarem, e a lista de participantes pelo nome que cada pessoa definiu no próprio app.

Na tela inicial, ao lado do nome do espaço, um botão com seta para baixo abre a lista de espaços disponíveis para trocar.

#### Tela de lançamentos — ações nos itens
Todo o item é clicável e abre o lançamento. No computador, ao passar o mouse, aparecem os botões de **lixeira** (excluir) e de **relógio** (marcar pendente) ou **check** (marcar pago). No celular, essas opções aparecem como uma gaveta ao deslizar o item para a esquerda, como nos apps de e-mail.

A etiqueta de status fica com fundo **vermelho** quando pendente e **verde** quando paga.

### Próximas funcionalidades

-
-

### Ideias para o futuro

-
-

### Ajustes no que já existe

-
-
