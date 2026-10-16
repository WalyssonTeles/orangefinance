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
npm run icons      # regenera os ícones PWA a partir de public/favicon.svg
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

### Finanças pessoais e familiares

Cada conta possui um espaço **Pessoal**, que não pode receber participantes. Em **Ajustes → Espaço compartilhado → Criar novo**, crie um espaço separado, por exemplo “Nossa família”. O espaço novo começa com categorias e uma conta inicial, **sem copiar as finanças pessoais**. Na tela inicial, a seta ao lado do nome do espaço troca entre Pessoal e os compartilhados.

Para compartilhar com sua esposa:

1. Abra o espaço em **Ajustes → Espaço compartilhado** e toque em **Copiar** ao lado do código de **10 caracteres**.
2. Envie o código por um meio privado.
3. Ela entra com a própria conta Google, abre **Ajustes → Espaço compartilhado → Inserir código** e cola o código.
4. Os dois passam a ver e editar o mesmo espaço. Cada um mantém o Pessoal privado e aparece para o outro pelo nome definido em **Ajustes → Perfil**.

Nos espaços compartilhados, cada lançamento tem um **Titular** (por padrão, quem lançou). Em Lançamentos é possível ver tudo junto ou por pessoa, e o início mostra o resumo **Por pessoa**.

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
public/favicon.svg        logo (laranja com gomos formando um gráfico de pizza)
```

## Modelo de sincronização

Toda tabela financeira segue estas regras:

- **IDs UUID** gerados no aparelho (sem conflito entre dispositivos);
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
