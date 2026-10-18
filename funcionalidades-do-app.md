# Orange Finance — Funcionalidades do app

> **Versão 1.3.1**
> Este arquivo descreve o que o app **já faz hoje**.
> No final há um espaço para você escrever as funcionalidades que deseja nas próximas versões.
> As versões anteriores são preservadas nas tags `v0.1.0`, `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.2.1`, `v1.2.2`, `v1.2.3` e `v1.3.0`.

---

## Versão 1.3.1 — identidade visual

- O Symbol é usado no cabeçalho, na tela de carregamento e como favicon do navegador.
- O Icon fornece as imagens de instalação do PWA no celular. Sem mudança de dados ou migração de banco.

---

## Versão 1.3.0 — espelho Google Sheets

- Planilhas individuais e compartilhadas criadas a partir dos modelos da pasta `Instructions`, com Dashboard, filtros por período/conta e filtros por titular nos espaços compartilhados.
- Envio e conferência manuais; o responsável é o único que atualiza a planilha compartilhada.
- O responsável concede acesso `reader` aos participantes com e-mail verificado. Participantes localizam o mesmo arquivo pelo app e o abrem somente para leitura.
- E-mails não são expostos pela listagem comum de participantes nem persistidos no dispositivo. O vínculo da planilha compartilhada é armazenado no Supabase após a migração 1.3.
- A área vazia do Dashboard a partir da coluna O usa fundo `#fbf7f4` sem ampliar desnecessariamente a planilha.
- Supabase continua sendo a sincronização principal. Sem edição bidirecional ou atualização automática do Sheets nesta versão.

---

## Versão 1.2.3 — ajustes visuais

- Itens de lançamentos sem o contorno colorido das ações de swipe recolhidas; arrastar e foco de teclado preservados.
- Busca fora do card de filtros, sempre visível entre os filtros e os lançamentos. Limpar filtros não apaga o termo da busca.
- Ordenação à esquerda e Exibir/Ocultar filtros à direita.
- Valores com atalhos da inicial sem sublinhado, mantendo os mesmos destinos.
- Formas de pagamento e vouchers não foram alterados nesta versão. Sem mudança de dados ou migração de banco.

---

## Versão 1.2.2 — usabilidade

- Campos, radios e switches só ativam pelo controle; clicar no título, hint ou espaço ao redor não os aciona. Os controles mantêm nomes acessíveis para leitores de tela.
- Date Field com cursor por clique, seleção de partes por duplo clique e seleção total ao repetir o duplo clique na mesma parte. O erro de data aparece junto ao campo, com borda vermelha mais espessa.
- Toast no topo por 5 segundos, sem bloquear a página; swipe horizontal no mobile e botão X no desktop, separado de Desfazer.
- Busca pela lupa ou tecla de busca do teclado fecha o teclado e rola até os resultados.
- Frequência antes de ocorrências, hints curtos pela data e sem Personalizado nas novas recorrências. Séries personalizadas anteriores são preservadas.
- Contas do lote compartilhado mostram o titular; dropdown ampliado e alinhado ao campo. Selo de recorrência na terceira linha, com texto Quinzenal.
- Sem alteração de dados nem nova migração de banco.

---

## Versão 1.2 — novidades

- Atalhos da inicial levam diretamente ao card da lista, já filtrado, inclusive os cartões de crédito.
- Filtro inicialmente recolhido com “Exibir Filtros” / “Ocultar filtros”, separado do card de lançamentos, e botão de ordenação nas duas direções.
- Contas e cartões reordenáveis por arraste fluido, mouse, toque prolongado e teclado. A ordem acompanha os seletores e a sincronização.
- Faturas por ciclo, fechamento e vencimento; compras no fechamento vão para a próxima. Pagamento único por transferência controla o status de todas as compras, sem outra despesa.
- Recorrências diária, semanal, quinzenal (14 dias), mensal, anual e personalizada; quantidade de ocorrências inclui a primeira. É possível mudar um lançamento único para parcelado/recorrente depois de criado.
- Lote desktop (a partir de 1.024 px), com tabela, validação integral, sucesso inline e desfazer com recuperação das linhas.
- Sugestões de descrições anteriores em dropdown, sem autocompletar.
- Migração preserva os dados e uma cópia local anterior à 1.2, exportável em Ajustes → Backup.

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
  - Os valores são link buttons: o **saldo** abre Lançamentos com tudo (entradas e saídas), **Receitas** abre só as receitas e **Despesas** só as despesas do mês. Títulos e áreas livres do card não navegam.
- **Por pessoa** (espaços compartilhados): comprovantes com nome, receitas, despesas e total do mês. Nome/total abrem Lançamentos pelo titular; os valores de receitas/despesas combinam os dois filtros. Apenas os links são interativos.
- **Gastos por categoria**: gráfico de rosca com as 5 maiores categorias e as demais agrupadas; a lista mostra todas as categorias, com percentual e valor. O link no valor abre as despesas daquela categoria no mês.
- **Contas a pagar**: despesas pendentes até o fim do mês, com destaque para **atrasadas** e **vencendo hoje**. Compras vinculadas usam o vencimento da fatura; o círculo leva ao pagamento da fatura em Contas. Outras despesas podem ser marcadas individualmente, com **Desfazer**.
- **Orçamentos**: os 4 orçamentos mais próximos do limite, com barra de progresso.
- **Últimos 6 meses**: gráfico de barras de receitas × despesas. Clicar em um mês muda o mês selecionado.
- **Cartões de crédito**: saldo devedor total de cada cartão; o link no valor abre os lançamentos filtrados e rolados até a lista. O botão **Pagar** abre Contas para escolher a fatura.
- **Últimos lançamentos**: os 5 mais recentes.
- **Primeiro uso**: convite para criar o primeiro lançamento ou **explorar com dados de exemplo** (6 meses de dados fictícios para conhecer todas as telas).

---

## 3. Lançamentos

### Criar e editar
- Botão **+** (barra inferior no celular), **Novo lançamento** (menu lateral no computador) ou tecla **N**.
- Três tipos: **Despesa**, **Receita** e **Transferência** entre contas.
- **Campo de valor estilo app de banco**: os números entram pela direita (digitar `1`, `2`, `5`, `0` resulta em `12,50`). No celular, abre o teclado numérico.
- Descrição (opcional), categoria com ícone e cor, conta ou cartão, data (com atalhos **Hoje** e **Ontem**) e observações.
- Status **Pago / Recebido** ou **Pendente**. Em novas despesas de cartão, o status é controlado pela fatura e a data é a da compra.
- Descrição com sugestões de despesas anteriores por trecho digitado, sem autocompletar; seleção por mouse, toque ou setas e Enter.
- Campo de data editável com teclado numérico e máscara **DD/MM/AAAA**. Tocar no texto não abre o calendário; somente o botão com ícone abre o seletor. Datas incompletas/impossíveis não são salvas. Calendário próprio, em português e com a identidade visual da home, também usado no lote, pagamento de faturas e nascimento. Abre no mês atual; semanas **D S T Q Q S S**, de domingo a sábado. Setas navegam os meses; tocar no mês abre **JAN–DEZ**, tocar no ano abre páginas de 12 anos. No celular abre em tela cheia, como o seletor da home; **Hoje** seleciona a data atual e **Limpar** aparece apenas nos campos opcionais.
- Um clique posiciona o cursor na data; um duplo clique seleciona a parte e outro na mesma parte seleciona tudo. Digitar substitui a seleção, mantendo a máscara. Data inválida exibe **Informe uma data válida** e borda vermelha de 2 px (1 px a mais que o normal); os limites de nascimento continuam valendo.
- **Repetição** (ao criar ou editar despesas e receitas; até 1.200 ocorrências):
  - **Única** — um lançamento;
  - **Parcelada** — divide o valor total em parcelas mensais, sem perder centavos, com o selo `2/10` em cada parcela;
  - **Recorrente** — repete o mesmo valor diariamente, semanalmente, quinzenalmente (a cada duas semanas), mensalmente ou anualmente. Regras personalizadas já existentes continuam válidas e podem ser editadas, sem oferecer essa escolha para séries novas;
  - **Frequência** vem antes de **Quantidade de ocorrências**, com hint baseado na data: “Dia após dia”, “Toda segunda-feira”, “Segunda sim, segunda não”, “Todo dia 16 do mês” ou “Todo dia 16 de outubro”;
  - **Quantidade de ocorrências** inclui o lançamento inicial. Prévia das datas antes de salvar.
  - Apenas o primeiro lançamento usa o status escolhido; os próximos ficam pendentes.
- Validação com mensagens claras por toast no topo da tela durante 5 segundos (valor zerado, categoria não escolhida, data/repetição inválida, transferência para a mesma conta etc.). O texto não bloqueia cliques nos controles abaixo; ações continuam clicáveis. Swipe para os lados dispensa no mobile; no desktop, o botão X tem alvo de 44 px e espaçamento de 16 px em relação a Desfazer.
- **Editar séries**: em alterações comuns, escolha **Só este** ou **Este e os próximos**. Nos próximos, o status é mantido e uma nova data preserva a frequência original. Mudar a repetição substitui este e os próximos, preservando o ID inicial e o histórico anterior; ocorrências futuras pagas bloqueiam essa substituição. Único pode virar parcelado ou recorrente sem recriar o lançamento manualmente.
- **Titular** (espaços compartilhados): indica a quem pertence a receita ou despesa. Por padrão é quem lança, mas pode ser outro participante ou “Sem titular”.
- O formulário mostra em qual espaço o lançamento será salvo.

### Excluir
- Confirmação antes de excluir.
- Em séries (parcelas ou mensais): excluir **só este** ou **este e os próximos**.
- Aviso com botão **Desfazer** após excluir.

### Lista
- Agrupada por dia (“Hoje”, “Ontem”, “Quinta-feira, 22 de outubro”…).
- Resumo do mês: **Receitas**, **Despesas** e **Resultado**.
- Lista em card próprio, sem título ou descrição de filtros redundantes; filtros separados e inicialmente recolhidos. O botão com setas alterna entre mais recentes e mais antigos.
- No mobile, o título da tela e o seletor de mês ficam fixos abaixo da barra superior. No desktop, o cabeçalho rola normalmente e um botão flutuante com seta para cima aparece após rolar verticalmente; esse botão não aparece no mobile.
- **Busca** por descrição, categoria ou observação (ignora acentos e maiúsculas). A lupa e a tecla de busca/Enter do teclado fecham o teclado e rolam até a lista filtrada.
- Filtros por tipo (**Todos, Despesas, Receitas, Transferências, Pendentes**), por **conta** e por **categoria**, com botão **Limpar filtros**. O filtro de categoria lista **só as categorias presentes nos lançamentos da tela** (mês, tipo e pessoa escolhidos).
- **Por pessoa** (espaços compartilhados): ver tudo junto ou apenas os lançamentos de um participante; o resumo do mês acompanha o filtro.
- Labels visíveis: **Buscar Lançamentos**, **Tipo de Lançamento**, **Titular** (espaços compartilhados), **Contas e Cartões** e **Categoria**. Os atalhos do painel preenchem os filtros, que continuam combináveis.
- Seletor de mês com largura total no celular e expandido no computador; sem botão “+ Novo” redundante. A criação continua pela barra inferior, menu lateral ou tecla N.
- Cada item mostra ícone da categoria, titular (em espaços compartilhados), conta, valor e etiqueta de status: **verde** quando pago/recebido e **vermelha** quando pendente ou atrasado. O selo de parcela/frequência ocupa uma terceira linha; a frequência de 14 dias aparece como **Quinzenal**.
- **O item inteiro é clicável** e abre o lançamento.
- **Computador**: ao passar o mouse (ou navegar com Tab), aparecem os botões **relógio** (marcar pendente) ou **check** (marcar pago) e **lixeira** (excluir).
- **Celular**: deslize o item para a esquerda para abrir a gaveta com **Pago/Pendente** e **Excluir**, como nos apps de e-mail. Tocar no item aberto fecha a gaveta.
- Excluir pela lista pergunta **Só este / Este e os próximos** em séries; todas as ações oferecem **Desfazer**.

### Lote (somente desktop)
- **Adicionar em lote**, disponível a partir de 1.024 px como link abaixo de **Novo lançamento** na barra lateral, abre uma tabela com tipo, valor, descrição, categoria, conta/cartão, data contextual, repetição, quantidade, frequência, titular, status e observações. O link não fica no cabeçalho de Lançamentos.
- Escolhas únicas usam selects; valor e textos permanecem livres. Todos os selects do aplicativo abrem abaixo do campo, com visual padronizado no desktop e no celular, até quatro opções visíveis e rolagem interna para listas maiores.
- **Número de parcelas** tem coluna própria e fica desabilitado fora de **Parcelada**. Ocorrências/frequência são habilitadas para **Recorrente**. A coluna **Titular** só aparece em espaços compartilhados.
- As sugestões de descrição incluem despesas anteriores e textos das outras linhas ainda não salvas, sem autocompletar.
- O link **Adicionar em lote** é centralizado abaixo de **Novo lançamento**. **Fechar** fica ao lado de **Salvar lançamentos**, à direita; **Nova linha** fica à esquerda.
- Botão **Nova linha**, remoção por linha, até 200 linhas e 5.000 lançamentos gerados. Se qualquer linha for inválida, nenhuma é salva.
- Ao salvar, a tabela é limpa e aparece **Lançamentos realizados com sucesso** com **Desfazer lançamentos**, que recupera a tabela. A ação vale para o último lote enquanto a tela estiver aberta e é bloqueada se registros tiverem sido editados ou faturas pagas posteriormente.

---

## 4. Contas e cartões

- Tipos: **Conta corrente, Poupança, Carteira, Investimentos e Cartão de crédito**, cada um com ícone e cor escolhida.
- **Saldo inicial** (pode ser negativo) para começar com o valor real da conta.
- **Titular opcional** em contas e cartões de espaços compartilhados, exibido nos cartões e seletores de conta. Contas antigas continuam sem titular; definir o titular da conta não reatribui seus lançamentos.
- Categorias têm ícones adicionais (beleza, salão, cuidados pessoais, educação, transporte, internet, doações etc.) com nomes em português. A paleta ganhou preto, vermelho, ciano e roxo.
- Saldo atual e saldo **previsto no fim do mês** de cada conta.
- Totais: **Saldo em contas** e **Saldo devedor em cartões**.
- **Cartão de crédito**:
  - compras no cartão aumentam a fatura, sem reduzir o saldo das contas;
  - limite do cartão com barra de uso e **limite disponível**;
  - fatura em aberto inicial (para quem já tem compras antes de usar o app);
  - dias de fechamento e vencimento configuráveis; compras no fechamento vão para o próximo ciclo e dias inexistentes usam o último dia do mês;
  - **Faturas por vencimento** permite pagar uma fatura inteira escolhendo conta e data; uma transferência é a única fonte do status de pagamento das compras;
  - **Reabrir fatura** desfaz o pagamento; alterações nas compras de uma fatura paga exigem reabri-la;
  - alterar o fechamento não recalcula faturas já vinculadas. Relatórios continuam pela data da compra, e a dívida total não deve ser confundida com uma fatura;
  - lançamentos anteriores à 1.2 conservam seus valores/status e não são redistribuídos automaticamente. Há pagamento separado do saldo anterior. Pagamentos parciais não estão incluídos.
- Segure um card para arrastar: ele flutua, reserva espaço e os demais deslizam. A ordem é mantida por seção, persistida e usada nos seletores. Pelo teclado, use o botão de reordenar, Espaço, setas e Espaço; Esc cancela.
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
- **Backup e dados**: exportar e importar o espaço aberto em `.json`, apagar todos os dados com confirmação e abrir **Planilha**.
  - Espelho Google Sheets em teste: cria uma nova planilha com o modelo individual ou compartilhado, preserva a planilha simples anterior e permite envio e conferência manuais. No compartilhado, somente o responsável envia; o app concede automaticamente permissão de leitura no Google Drive aos participantes com e-mail verificado e publica o mesmo vínculo para os membros do espaço.
  - Participantes abrem a planilha compartilhada em modo somente leitura. Novos membros recebem acesso na próxima atualização feita pelo responsável; os e-mails são consultados por uma função restrita ao responsável e não são guardados no dispositivo.
  - Dashboard com seletores de ano, mês, conta e titular (compartilhado); Lançamentos exibe parcelas, frequência, repetição e ocorrências. O Supabase continua sincronizando os aparelhos; a planilha não importa edições nem recebe atualizações automáticas nesta etapa.
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
