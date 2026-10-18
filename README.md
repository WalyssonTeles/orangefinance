# Orange Finance 🍊

Gestão financeira pessoal da família Orange (irmão do **Orange Notes**).
Aplicativo web progressivo (PWA): funciona no navegador do computador e pode ser instalado no Android, no iPhone e no Windows — tudo **offline e salvo localmente**.

> Os dados ficam no IndexedDB do navegador. Opcionalmente, entre com Google para sincronizar entre dispositivos usando Supabase. O banco financeiro nunca é salvo no GitHub.

## Como abrir

### Jeito mais fácil (Windows)

Dê dois cliques em **`Abrir Orange Finance.bat`**. Ele instala as dependências (só na primeira vez), gera a versão otimizada, inicia o servidor local e abre o app em uma janela própria do Edge.

Para ter o app no Menu Iniciar e na barra de tarefas: com ele aberto no Edge, clique no ícone **Instalar** na barra de endereço (ou menu **⋯ → Aplicativos → Instalar Orange Finance**). Depois de instalado, ele abre mesmo sem o servidor rodando, porque os arquivos ficam em cache.

### Desenvolvimento

```powershell
npm install
npm run dev        # http://localhost:5180 com recarregamento automático
npm test           # testes unitários (Vitest)
npm run build      # checagem de tipos + build de produção com service worker
npm run preview    # serve o build em http://localhost:5180
npm run icons      # regenera os ícones PWA a partir de public/orange-finance-icon.svg
```

> **Importante:** os dados do IndexedDB pertencem ao endereço exato. `localhost:5180` e `127.0.0.1:5180` são “sites” diferentes e não compartilham dados. Por isso o projeto usa sempre a porta **5180**, tanto no `dev` quanto no `preview`.

### Testar no celular (mesma rede Wi-Fi)

```powershell
npm run dev -- --host
```

Abra no celular o endereço “Network” mostrado no terminal. Mantenha o computador ligado e o terminal aberto. Se necessário, permita o Node.js no Firewall do Windows apenas para redes privadas. Nesse modo (HTTP pela rede) o navegador não ativa o service worker; para instalação e uso offline, use a publicação HTTPS abaixo.

### Publicar no GitHub Pages

O projeto está preparado para o repositório [WalyssonTeles/orangefinance](https://github.com/WalyssonTeles/orangefinance).

1. Envie o projeto para a branch `main` desse repositório.
2. No GitHub, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**. A disponibilidade do Pages depende da visibilidade do repositório e do plano da conta.
3. Na aba **Actions**, acompanhe o workflow **Deploy GitHub Pages**. Se o primeiro envio ocorreu antes de configurar o Pages, execute novamente o workflow por **Run workflow**.
4. Após a publicação concluir, acesse **https://walyssonteles.github.io/orangefinance/** no celular ou computador.

Cada envio para `main` executa os testes, gera o aplicativo e publica uma atualização. O workflow usa `npm run build:pages` para configurar o prefixo `/orangefinance/`, incluindo ícones e service worker. O build local normal continua usando `/`, sem alterar o endereço usado pelo arquivo de abertura do Windows.

Para enviar pelo terminal, com o Git autenticado no GitHub e o remoto `origin` configurado:

```powershell
git push -u origin main
```

Nunca coloque senhas, tokens ou arquivos de backup financeiro no repositório. O GitHub hospeda o código e os arquivos do aplicativo, não o banco financeiro do navegador.

### Instalar no celular ou computador

Abra o endereço HTTPS publicado e aguarde o carregamento inicial com internet:

- **Android / Chrome:** menu **⋮ → Instalar aplicativo** ou **Adicionar à tela inicial**.
- **iPhone / Safari:** **Compartilhar → Adicionar à Tela de Início**.
- **Computador / Edge ou Chrome:** use o ícone de instalação na barra de endereço ou a opção de instalar no menu do navegador.

Após o cache inicial, o app pode abrir offline, sem depender do computador que contém o projeto. A instalação e a disponibilidade dos menus dependem do navegador.

### Usar em diferentes dispositivos

O mesmo link funciona em celulares, tablets e computadores. Em **Ajustes → Conta e sincronização → Entrar com Google**, use a mesma conta Google em cada aparelho. O Supabase precisa estar configurado conforme a seção abaixo; a conta do GitHub não autentica o acesso aos dados financeiros.

- **Ao entrar, a sincronização começa automaticamente.** Em um aparelho novo, o app carrega os dados da conta sem perguntar sobre cópias locais ou nuvem. A conta e as categorias iniciais geradas pelo app não contam como dados pessoais.
- Se a conta ainda não tiver dados próprios, os dados já existentes no aparelho são enviados automaticamente. Não é necessário “ativar” ou escolher uma origem.
- Somente quando o aparelho e a conta já contiverem dados próprios diferentes, o app pausa antes de substituir qualquer coisa. Nesse caso, permite **Salvar cópia deste aparelho** e **Continuar com minha conta**, com confirmação da substituição. Os dois conjuntos ficam intactos até a decisão.
- A sincronização envia alterações locais após uma breve espera e consulta a nuvem a cada **15 segundos** enquanto o app está visível, além de retomar ao reconectar ou reabrir.
- Offline, as alterações ficam no IndexedDB e são reconciliadas ao retornar. O navegador pode suspender o app fechado; não há execução contínua em segundo plano.
- Alterações em registros diferentes são mescladas. Se o mesmo registro mudar de formas diferentes em dois aparelhos, o envio pausa e **Ajustes** permite comparar as versões e escolher qual manter para os registros em conflito. Horários dos dispositivos não são usados para decidir quem vence.
- Perfil, contas, categorias, lançamentos e orçamentos são sincronizados. A preferência de ocultar valores permanece local.
- Importar backup e apagar os dados também são alterações sincronizáveis; essas ações afetam a nuvem e os outros aparelhos depois de sincronizar.
- Ao sair, os dados locais pendentes são preservados e a interface fica bloqueada até entrar na mesma conta. Para outra conta, use outro perfil do navegador. Esse bloqueio não criptografa o IndexedDB; proteja o aparelho e o perfil com bloqueio de tela.

Sem sincronização configurada, o modo local continua disponível. Para transferir manualmente:

1. No dispositivo de origem, abra **Ajustes → Backup → Exportar backup**.
2. Transfira o arquivo JSON por um meio seguro para o outro aparelho.
3. No destino, abra o app e use **Ajustes → Backup → Importar**.
4. Confira a confirmação antes de substituir os dados existentes. A importação **não mescla** lançamentos de dispositivos diferentes.

Exporte também um backup antes de trocar de navegador, limpar os dados do site ou migrar de `localhost` para o endereço publicado. O arquivo contém informações financeiras e não deve ser publicado no GitHub.

### Planilha Google (espelho em teste)

Em **Ajustes → Backup e dados → Planilha**, o espaço aberto pode gerar uma nova planilha Google a partir do modelo XLSX individual ou compartilhado da pasta `Instructions`. A planilha simples criada em testes anteriores permanece intacta. O app continua lendo e gravando no IndexedDB; o **Supabase ainda é a sincronização principal**. O envio ao Sheets ocorre somente ao tocar em **Criar planilha com modelo** ou **Atualizar planilha com modelo**, não automaticamente. Edições feitas na planilha não retornam ao app.

O Dashboard convertido inclui filtros de ano, mês, conta e, no compartilhado, titular. Em Lançamentos, valores são exibidos em reais; os centavos e os campos completos do app permanecem em colunas técnicas ocultas. Parcelas, frequência, repetição, ocorrências e intervalo personalizado aparecem em colunas visíveis. Use **Conferir planilha** para comparar contagens e totais por conta, mês e tipo; no compartilhado a comparação também considera o titular. A conversão de fórmulas e gráficos do Excel é feita pelo Google: confira o resultado antes de depender dele.

No espaço compartilhado, somente o responsável cria e atualiza o espelho. Em cada envio, o app consulta no Supabase os e-mails verificados dos participantes, concede a eles permissão `reader` no Google Drive e registra o ID da planilha no espaço. Os participantes encontram o mesmo arquivo em **Ajustes → Backup e dados → Planilha** e podem abri-lo somente para leitura; a função geral de participantes continua sem expor e-mails. Novos participantes recebem acesso quando o responsável atualiza a planilha novamente. Mantenha também backups JSON independentes.

Esse fluxo requer a migração Supabase `202610170001_sheets_mirror.sql`. O vínculo remoto guarda apenas o ID do arquivo; tokens Google continuam apenas na memória do navegador e e-mails não são persistidos no IndexedDB. No Dashboard, a faixa visual vazia `O1:U84` usa o fundo `#fbf7f4` sem ampliar a grade da planilha.

### Versão 1.3.0

- Planilhas individuais e compartilhadas geradas a partir dos modelos XLSX, com Dashboard, seletores e envio/conferência manuais.
- No espaço compartilhado, o responsável registra a planilha no Supabase e concede aos e-mails verificados dos participantes acesso somente leitura pelo Google Drive. Participantes abrem o mesmo arquivo pelo app.
- A área vazia do Dashboard da coluna O em diante recebe o fundo `#fbf7f4`, limitado às células existentes do layout.
- Supabase permanece como sincronização principal. Esta versão não ativa edição bidirecional nem envio automático ao Google Sheets; isso continua fora da Fase 1A.

### Versão 1.3.1

- Atualiza o logo do cabeçalho e o ícone de carregamento com o Symbol; o favicon da aba também usa o Symbol.
- Atualiza os ícones de instalação do app no celular com o Icon. Sem mudança de dados ou migração de banco.

### Versão 1.3.2

- Mantém o Icon novo nos ícones de instalação e na tela de abertura mobile; o Symbol permanece no cabeçalho, carregamento dentro do app e favicon da aba.
- Remove a margem extra da geração e preenche o fundo dos ícones adaptável e Apple com laranja até as bordas, evitando recortes e faixas claras quando o sistema aplica sua máscara. As URLs do manifesto incluem a versão para sinalizar a atualização dos ícones.
- Preserva os SVGs originais e o logo antigo no histórico. Sem mudança de dados ou migração de banco.

### Finanças pessoais e familiares

Cada conta possui um espaço **Pessoal**, que não pode receber participantes. Em **Ajustes → Espaço compartilhado → Criar novo**, crie um espaço separado, por exemplo “Nossa família”. O espaço novo começa com categorias e uma conta inicial, **sem copiar as finanças pessoais**. Na tela inicial, a seta ao lado do nome do espaço troca entre Pessoal e os compartilhados.

Para compartilhar com sua esposa:

1. Abra o espaço em **Ajustes → Espaço compartilhado** e toque em **Copiar** ao lado do código de **10 caracteres**.
2. Envie o código por um meio privado.
3. Ela entra com a própria conta Google, abre **Ajustes → Espaço compartilhado → Inserir código** e cola o código.
4. Os dois passam a ver e editar o mesmo espaço. Cada um mantém o Pessoal privado e aparece para o outro pelo nome definido em **Ajustes → Perfil**.

Nos espaços compartilhados, cada lançamento tem um **Titular** (por padrão, quem lançou). Em Lançamentos é possível ver tudo junto ou por pessoa, e o início mostra o resumo **Por pessoa**.

Na versão **1.1**, contas e cartões também podem ter um titular, sem alterar a titularidade dos lançamentos. O resumo por pessoa funciona como um comprovante com atalhos para os filtros de Lançamentos; gastos por categoria também abrem a lista filtrada. O seletor de período permite escolher meses e páginas de 12 anos, com tela cheia no celular. Os filtros têm labels visíveis e Ajustes tem um único retorno por nível, com alvo de toque ampliado.

### Versão 1.2.3

- Busca sempre visível fora do card de filtros, entre os filtros e a lista. Buscar não marca os filtros como ativos; limpar filtros mantém o termo pesquisado.
- Ordenação à esquerda e Exibir/Ocultar filtros à direita.
- Ações de swipe ficam transparentes quando recolhidas, eliminando o contorno colorido nos itens sem remover o foco de teclado.
- Valores interativos da inicial continuam sendo link buttons, agora sem sublinhado.
- Formas de pagamento e vouchers permanecem como antes, sem alteração dos dados nem nova migração.

### Versão 1.2.2

- Somente os controles ativam campos, radios e switches; títulos e hints não encaminham cliques. Os nomes acessíveis são preservados. Na inicial, os valores com atalhos são link buttons, sem tornar o card inteiro clicável.
- No Date Field, um clique posiciona o cursor; dois selecionam dia, mês ou ano e outro duplo clique na parte já selecionada marca a data inteira. Digitar substitui a seleção. Datas inválidas têm borda vermelha de 2 px e o hint **Informe uma data válida**.
- Toast sempre no topo, por **5 segundos**, sem bloquear cliques na página. No mobile, arraste para os lados para dispensar; no desktop, use **X**, separado de **Desfazer** por uma área segura.
- A lupa e a tecla de busca/Enter dos filtros encerram a digitação e rolam até os lançamentos filtrados.
- Frequência vem antes da quantidade de ocorrências, com hints curtos que acompanham a data. Novas recorrências oferecem diária, semanal, quinzenal, mensal e anual; regras personalizadas antigas continuam válidas e editáveis, sem conversão automática.
- No lote compartilhado, conta e destino de transferência exibem o titular. Os menus podem ampliar para caber o nome, alinhados à direita do campo ou à esquerda quando necessário.
- O selo da recorrência ocupa uma terceira linha no item, com **Quinzenal** abreviado para não disputar espaço com os demais dados.
- Sem nova migração de banco; dados, backups e faturas mantêm as regras da 1.2.1.

### Versão 1.2.1

- Correção do Date Field: tocar na data permite digitação com teclado numérico e máscara **DD/MM/AAAA**; somente o botão com ícone abre o calendário.
- A correção vale para lançamentos, lote, pagamento de faturas e nascimento. Datas incompletas ou impossíveis são rejeitadas, mantendo o formato ISO no armazenamento. Sem nova migração de banco.

### Versão 1.2

- Atalhos do painel aplicam os filtros e rolam até o card dos lançamentos. Cartões também abrem sua lista filtrada.
- Filtros separados da lista, inicialmente recolhidos, e ordenação por data nas duas direções. O card da lista não repete o título da página nem a descrição dos filtros. No mobile, título e seletor de mês permanecem fixos durante a rolagem; no desktop, um botão flutuante permite voltar ao topo após rolar verticalmente.
- Campos obrigatórios e erros ao salvar/editar lançamentos são informados pelo toast global, visível sobre o formulário sem precisar rolar até o rodapé.
- Contas e cartões podem ser reordenados por mouse, toque prolongado ou teclado (botão de arraste, Espaço, setas e Espaço para soltar; Esc cancela). A ordem é salva e sincronizada, inclusive nos seletores. Cada seção mantém sua própria ordem.
- Recorrência diária, semanal, quinzenal (**14 dias**), mensal, anual ou por intervalo em dias. **Quantidade de ocorrências** inclui a primeira, com prévia das datas; limite de 1.200 ocorrências por série. Parcelas dividem o valor total sem perder centavos.
- A repetição pode ser alterada em lançamentos existentes, inclusive de único para recorrente/parcelado. Alterar a regra substitui este e os próximos, preservando o ID original e o histórico anterior. Ocorrências futuras pagas impedem a substituição até serem reabertas. Edições comuns continuam oferecendo “Só este” ou “Este e os próximos”, preservando o status dos próximos.
- Descrições sugerem termos já utilizados em despesas, por trecho e sem distinção de acentos/maiúsculas. No lote, incluem também as descrições das outras linhas ainda não salvas. Nenhum texto é preenchido sem escolha explícita.
- Todos os selects usam o mesmo menu abaixo do campo, no desktop e no celular: até quatro opções visíveis e rolagem interna nas listas maiores, com navegação por teclado e Escape para fechar.
- Os campos de data exibem **DD/MM/AAAA**, inclusive como indicação quando vazios, e usam um calendário próprio em português, com a identidade visual do seletor da home. Abre no mês atual, com semanas de domingo a sábado (**D S T Q Q S S**); o cabeçalho alterna entre dias, meses abreviados (**JAN–DEZ**) e páginas de 12 anos. As datas continuam salvas em ISO, com limites preservados para nascimento e seleção por teclado.
- Lote em telas com largura a partir de **1.024 px**, pelo link **Adicionar em lote** abaixo de **Novo lançamento** na barra lateral: escolhas por selects, campos livres para valor/descrição/observações, data contextual por linha, parcelas e recorrências. Até 200 linhas / 5.000 lançamentos gerados; gravação atômica. A mensagem verde permite desfazer o último lote enquanto a tela estiver aberta, recuperando suas linhas. Se o lote foi editado ou uma fatura foi paga, a reversão é bloqueada para não apagar alterações posteriores.
- Na tabela do lote, **Número de parcelas** tem coluna própria, habilitada apenas para **Parcelada**; ocorrências e frequência são habilitadas para **Recorrente**. **Titular** aparece somente em espaços compartilhados. **Fechar** fica junto de **Salvar lançamentos** no rodapé.

**Faturas:** configure os dias de fechamento e vencimento em Contas. Compras no dia do fechamento entram no ciclo seguinte; dias inexistentes usam o último dia do mês. O vencimento é o primeiro dia configurado depois do fechamento. A data da compra continua determinando o mês dos relatórios; vencimento e pagamento são informações distintas.

Cada compra guarda seu ciclo/vencimento, e alterar a configuração do cartão não recalcula o histórico. O status de compras novas deriva de uma única transferência de quitação da fatura, sem gerar outra despesa. Em **Contas → cartão → Faturas por vencimento**, escolha **Marcar fatura como paga** e a conta de origem; **Reabrir fatura** desfaz a transferência e deixa as compras pendentes. Compras de fatura paga não podem ser alteradas sem reabrir a fatura. Pagamentos parciais não fazem parte desta versão.

**Histórico anterior:** compras e saldos antigos não são redistribuídos automaticamente entre faturas e conservam o status original. O saldo anterior pode ser pago separadamente. Alterar explicitamente a data, a conta ou a repetição de uma compra antiga passa a usar as novas regras. A tela informa essa diferença. O saldo devedor total inclui compromissos futuros; não é o valor de uma única fatura.

**Preservação:** a migração IndexedDB 4 → 5 não altera registros financeiros e guarda uma cópia local anterior à 1.2 (incluindo os espaços em cache). Ajustes → Backup permite exportar o backup padrão do espaço que estava aberto antes da atualização; ele pode ser diferente do espaço atual. Essa cópia permanece apenas no navegador e é removida por “Apagar dados”. Backups antigos continuam importáveis. Exporte backups de cada espaço antes da atualização; a cópia local não protege contra limpeza/evicção do navegador.

Backups novos usam o **formato 2**: a 1.2 importa os formatos 1 e 2, mas versões anteriores recusam o formato 2 em vez de interpretar faturas novas com regras antigas. A cópia pré-atualização permanece exportável no formato 1.

O responsável pode alterar o **Nome do espaço** nos detalhes em **Ajustes → Espaço compartilhado**. O novo nome aparece na lista e no seletor de espaços, e nos outros aparelhos após a atualização da lista. Isso não altera o código, participantes nem dados financeiros.

Quem tiver o código pode entrar no espaço, então trate-o como uma senha. O responsável pode **gerar um novo código** (o anterior para de funcionar) e remover participantes; há limite de 10 tentativas inválidas por hora por conta. Participantes podem sair, mas o responsável não pode sair do próprio espaço. Todos os membros podem alterar e apagar dados financeiros **do espaço compartilhado**. Sexo e data de nascimento do Perfil nunca são mostrados aos outros participantes.

A troca de espaços guarda alterações pendentes em caches separados; elas serão enviadas quando você voltar ao espaço correspondente e houver internet. O backup exportado contém apenas o espaço ativo. Não importe um backup pessoal dentro do espaço familiar sem querer compartilhar aquele conteúdo.

Revogar um acesso bloqueia novas leituras e escritas no servidor; a lista de espaços é revalidada enquanto há internet. **Não apaga cópias locais, backups ou capturas que a pessoa já tenha obtido.** O funcionamento offline implica manter uma cópia no aparelho. Em computadores compartilhados, use perfis separados de navegador para contas de pessoas diferentes.

### Configurar o Supabase

Este projeto é **Vite/React**, não Next.js. Não usa `@supabase/ssr`, middleware, cookies de servidor nem variáveis `NEXT_PUBLIC_*`.

1. No Supabase, mantenha **Data API** habilitada, desative **Automatically expose new tables** e ative **automatic RLS**.
2. No **SQL Editor**, execute em ordem [a migração inicial](./supabase/migrations/202610150001_finance_sync.sql), [a migração de espaços pessoais/familiares](./supabase/migrations/202610150002_workspaces.sql) e [a migração da versão 1.0](./supabase/migrations/202610160001_v1.sql). As duas primeiras criam os espaços e participações, com uma linha financeira JSON por espaço, revisão atômica e limite de 5 MB. A 1.0 é **somente aditiva**: cria perfis, códigos de 10 caracteres (inclusive para espaços já existentes) com limite de tentativas e a função de gravação `write_workspace_finance_v2`. Ela também revoga a gravação antiga, para que aparelhos ainda na versão 0.1 não sobrescrevam dados da 1.0; esses aparelhos mantêm as alterações localmente até atualizar o app. **Execute a migração 1.0 antes de publicar o código 1.0.** Leituras exigem autenticação e RLS; as funções conferem a identidade/participação no servidor.
3. Opcionalmente, execute [os testes SQL de usuários](./supabase/tests/rls.sql) e [os testes de espaços/convites](./supabase/tests/workspaces.sql) **antes** da migração 1.0, e [os testes da 1.0](./supabase/tests/v1.sql) depois dela. Eles validam isolamento, revisão concorrente, códigos, limite de tentativas, privacidade do perfil, revogação e bloqueio anônimo. Criam registros de teste dentro de transações revertidas ao final. O resultado esperado é `PASS`. Os mesmos scripts são executados automaticamente nos testes unitários em PostgreSQL local via PGlite, inclusive a atualização de um banco com dados existentes, sem usar contas ou dados reais.
4. Configure o provedor **Google** conforme a seção abaixo. O login usa OAuth/PKCE e não depende de SMTP ou da edição dos modelos de e-mail. Mantenha novos cadastros habilitados para permitir o primeiro acesso de cada pessoa.
5. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Reinicie o servidor local após alterar variáveis.
6. Para o GitHub Pages, crie as mesmas duas **Repository variables** em **Settings → Secrets and variables → Actions → Variables** e execute novamente a publicação. A configuração de ambiente é incorporada durante o build; o arquivo `.env.local` não é enviado ao GitHub.

**Atualização 1.0 → 1.1:** antes de publicar o frontend 1.1, execute somente [a migração da 1.1](./supabase/migrations/202610160002_v1_1.sql) sobre o banco que já recebeu as anteriores. Ela adiciona a função `rename_finance_workspace`, restrita ao responsável de espaços compartilhados, e não altera snapshots, revisões, códigos ou participantes. É reaplicável e compatível com o frontend 1.0. Titulares de contas são campos opcionais no JSON existente; backups antigos continuam aceitos, sem alteração do banco IndexedDB ou reatribuição de lançamentos. Os testes verificam a preservação e a sincronização desses dados, incluindo bases de comparação anteriores à 1.1.

**Atualização 1.1 → 1.2 — ordem obrigatória de publicação:**

1. Preserve as tags anteriores (`v0.1.0`, `v1.0.0`, `v1.1.0`) e exporte backups financeiros de cada espaço. A tag local `v1.1.0-pre-1.2` preserva a base anterior ao desenvolvimento; tags não contêm os bancos dos usuários.
2. No Supabase, execute [a migração da 1.2](./supabase/migrations/202610160003_v1_2.sql) **antes** de publicar o frontend. Ela adiciona `write_workspace_finance_v3`, sem reescrever snapshots ou revisões. É reaplicável. Não execute novamente migrações antigas depois desta, pois recriariam a função de gravação antiga sem sua proteção.
3. Execute `npm test` e `npm run build:pages`; só então publique o código. O workflow de `main` publica automaticamente, portanto não envie a release para `main` antes da etapa anterior.
4. Atualize os aparelhos/PWAs e confira saldos, espaços e um ciclo de fatura. A API anterior continua aceitando espaços legados; após usar campos da 1.2 naquele espaço, aparelhos antigos recebem uma mensagem para atualizar em vez de sobrescrever novas regras. Alterações locais são mantidas. Conflitos offline entre pagamento e compras da mesma fatura pausam a sincronização com orientação para reabrir e reconciliar, sem substituição silenciosa.
5. Não faça downgrade direto do banco IndexedDB 5 para a 1.1: a versão antiga não abre o banco mais novo. Tags permitem recuperar o código, não desfazer dados. Para contingência, preserve o banco/backup, mantenha a migração SQL e publique uma correção compatível com o esquema 5; restaurar um backup antigo requer confirmação e também se propaga pela sincronização.

**Atualização 1.2.3 → 1.3.0 — ordem obrigatória de publicação:**

1. Exporte backups JSON dos espaços que precisam de uma cópia independente.
2. No projeto Supabase usado pelo app, execute [a migração da 1.3](./supabase/migrations/202610170001_sheets_mirror.sql) antes de publicar o frontend. Ela adiciona o vínculo da planilha compartilhada e RPCs com acesso restrito ao responsável/membros; não altera os dados financeiros. É reaplicável e solicita a atualização do cache da API.
3. Execute `npm test` e `npm run build:pages`; só então publique o código. O workflow de `main` publica automaticamente, portanto não envie a release para `main` antes da migração.
4. Depois da publicação, o responsável deve atualizar a planilha compartilhada uma vez para registrar o vínculo e conceder leitura aos participantes atuais. Novos participantes recebem leitura na próxima atualização manual do responsável.
5. A planilha continua sendo um espelho manual e unidirecional; não remova as integrações Supabase nem trate esta versão como Fase 1B.

Somente a URL e a chave **publishable** podem ser incorporadas no navegador. Nunca use senha do banco, chave secreta, `service_role` ou token administrativo em variáveis `VITE_*`. A chave pública não é uma autorização para ler os dados: as políticas do banco são obrigatórias. Não remova a RLS nem conceda acesso a `anon` para contornar erros.

Sem as variáveis, o app avisa que a sincronização não foi configurada; erros de configuração, autenticação, dados inválidos e conflitos aparecem na interface, sem retornar sucesso fictício. Mantenha backups independentes. Ao excluir um usuário no Supabase Auth, **todos os espaços dos quais ele é responsável são excluídos por cascata**, inclusive os familiares. Exporte e confira backups de cada espaço antes de qualquer exclusão administrativa.

### Configurar Entrar com Google

1. No [Google Auth Platform](https://console.cloud.google.com/auth/overview), selecione/crie um projeto e configure o nome do app, e-mail de suporte e público externo. Se o aplicativo estiver em teste e a tela de público oferecer usuários de teste, adicione os e-mails autorizados (por exemplo, você e sua esposa).
2. Em **Data Access / Scopes**, solicite apenas `openid`, `userinfo.email` e `userinfo.profile`. Não solicite acesso ao Gmail, contatos ou Drive.
3. Em **Clients → Create client**, escolha **Web application**.
   - **Authorized JavaScript origins:** `https://walyssonteles.github.io`. Para desenvolvimento local, adicione `http://localhost:5180`. Essas origens não incluem `/orangefinance/`.
   - **Authorized redirect URIs:** `https://dtmphquwyczhqsplovzr.supabase.co/auth/v1/callback`. Se usar outro projeto, copie a URL indicada no provedor Google do Supabase.
4. No [provedor Google do Supabase](https://supabase.com/dashboard/project/dtmphquwyczhqsplovzr/auth/providers?provider=Google), habilite o provedor e preencha o **Client ID** e o **Client Secret** gerados no Google. O segredo fica **somente nesse painel**, nunca no app, GitHub ou variáveis `VITE_*`. Preserve as verificações padrão de nonce/e-mail; não as desative para contornar erros.
5. Em [Authentication → URL Configuration](https://supabase.com/dashboard/project/dtmphquwyczhqsplovzr/auth/url-configuration):
   - **Site URL:** `https://walyssonteles.github.io/orangefinance/`.
   - **Redirect URLs:** autorize exatamente `https://walyssonteles.github.io/orangefinance/` e, se necessário para testes, `http://localhost:5180/`. Evite curingas amplos em produção.
6. No app, abra Ajustes e toque em **Entrar com Google**. O retorno é processado antes de iniciar a interface, troca o código por sessão usando PKCE e remove os parâmetros de autenticação da barra de endereço. Finalize no mesmo navegador/perfil em que iniciou o login. Se o navegador interno de outro app bloquear o Google, abra o Orange Finance diretamente no Chrome, Safari ou Edge.

O app não recebe a senha do Google. A sessão é mantida no navegador para retomar a sincronização, inclusive entre aberturas. Em aplicativos instalados, o navegador pode tratar o retorno de forma diferente: se o login retornar em outra janela, conclua o acesso no navegador e abra/instale o app a partir dele. Não compartilhe URLs de retorno de autenticação.

## Tecnologias

| Parte | Escolha | Por quê |
|---|---|---|
| Interface | React 19 + TypeScript | Mesma base do Orange Notes; reaproveitável em Expo/Capacitor no futuro |
| Estilo | Tailwind CSS 4 | Tokens de cor e tipografia da identidade Orange |
| Banco local | IndexedDB via Dexie 4 | Rápido, transacional, reativo (`useLiveQuery`) |
| Sincronização | Supabase Auth + PostgreSQL/RLS | Login com Google, espaços pessoais/familiares e revisão atômica |
| PWA | vite-plugin-pwa (Workbox) | Instalável e funcionando offline |
| Ícones | lucide-react | Traço consistente e leve |
| Fontes | Bricolage Grotesque + Figtree (embutidas) | Identidade compartilhada com o Orange Notes, sem depender da internet |
| Testes | Vitest + fake-indexeddb | Regras financeiras e banco testados sem navegador |

## Estrutura

```
src/
  App.tsx                 layout (menu lateral no desktop, barra inferior no celular), atalhos e avisos
  state.ts                contexto global (mês selecionado, ocultar valores, abrir lançamento, avisos)
  lib/
    db.ts                 esquema do banco (contas, categorias, lançamentos, orçamentos, ajustes)
    repo.ts               gravações: lançamentos, parcelas, exclusão com desfazer, backup
    finance.ts            cálculos puros: saldos, resumo do mês, categorias, orçamentos, histórico
    money.ts / dates.ts   formatação em R$ e datas pt-BR
    demo.ts               dados de exemplo
    hooks.ts / router.ts  leitura reativa do banco e navegação por hash
  components/             formulários, modal/folha inferior, campo de valor, gráficos, ícones
  pages/                  Início, Lançamentos, Contas, Orçamentos, Ajustes
public/favicon.svg                logo tradicional da laranja preservado
public/orange-finance-symbol.svg  símbolo usado no cabeçalho, carregamento e favicon
public/orange-finance-icon.svg    ícone novo, fonte dos ícones de instalação
```

## Modelo de sincronização

Toda tabela financeira segue estas regras:

- **IDs UUID** gerados no aparelho; pagamentos de faturas usam um ID determinístico por cartão/ciclo para impedir duas quitações independentes;
- **valores em centavos** (inteiros), nunca números com vírgula;
- **`createdAt` / `updatedAt`** em todo registro;
- **exclusão lógica** (`deletedAt`) — a exclusão também poderá ser sincronizada.

## Identidade visual

| Token | Cor | Uso |
|---|---|---|
| `orange` | `#FF7A1A` | Destaques e gráficos |
| `brand` | `#E8590C` | Botões principais e estados ativos (mesmo laranja do Orange Notes) |
| `brand-ink` | `#C2410C` | Textos e links laranja sobre fundo claro |
| `orange-soft` | `#FFE8D8` | Fundos suaves de destaque |
| cartão de saldo | degradê `#FF8A2B → #E8590C` | Card principal |
| `cream` | `#FBF7F4` | Fundo |
| `ink` | `#29231F` | Texto e valores |
| `muted` | `#70665E` | Textos secundários |
| `positive` | `#247A52` | Receitas e estados saudáveis |
| `negative` | `#C43D3D` | Atrasos, excessos e erros |

O que fazer em cada fase está em [funcionalidades-do-app.md](./funcionalidades-do-app.md).
