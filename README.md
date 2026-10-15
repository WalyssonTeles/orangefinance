# Orange Finance 🍊

Gestão financeira pessoal da família Orange (irmão do **Orange Notes**).
Aplicativo web progressivo (PWA): funciona no navegador do computador e pode ser instalado no Android, no iPhone e no Windows — tudo **offline e salvo localmente**.

> Fase 1: sem servidor nem sincronização. Os dados ficam no IndexedDB do navegador.
> O modelo de dados já foi preparado para a sincronização futura (veja “Pronto para sincronizar”).

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

O mesmo link funciona em celulares, tablets e computadores, mas **não há login nem sincronização automática**. Os dados continuam locais em cada navegador, mesmo usando a mesma conta do GitHub.

Para transferir seus dados:

1. No dispositivo de origem, abra **Ajustes → Backup → Exportar backup**.
2. Transfira o arquivo JSON por um meio seguro para o outro aparelho.
3. No destino, abra o app e use **Ajustes → Backup → Importar**.
4. Confira a confirmação antes de substituir os dados existentes. A importação **não mescla** lançamentos de dispositivos diferentes.

Exporte também um backup antes de trocar de navegador, limpar os dados do site ou migrar de `localhost` para o endereço publicado. O arquivo contém informações financeiras e não deve ser publicado no GitHub. A sincronização automática com autenticação e backend permanece uma etapa futura.

## Tecnologias

| Parte | Escolha | Por quê |
|---|---|---|
| Interface | React 19 + TypeScript | Mesma base do Orange Notes; reaproveitável em Expo/Capacitor no futuro |
| Estilo | Tailwind CSS 4 | Tokens de cor e tipografia da identidade Orange |
| Banco local | IndexedDB via Dexie 4 | Rápido, transacional, reativo (`useLiveQuery`) |
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

## Pronto para sincronizar

Toda tabela segue regras que facilitam a fase com Firebase/Supabase:

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
