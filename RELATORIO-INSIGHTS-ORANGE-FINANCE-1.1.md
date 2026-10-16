# Orange Finance 1.1 — diagnóstico de produto e oportunidades

> **Data de referência:** 15/10/2026, horário de Brasília.  
> **Base analisada:** versão 1.1.0, commit `0287311637dccd852ce38abc29ebee14ea0f7673`.  
> **Natureza:** análise documental do produto, leitura do código e benchmark de fontes públicas oficiais.  
> **Entrega:** somente este documento. Não autoriza nem implementa nenhuma recomendação.

## Índice

1. [Resumo executivo](#1-resumo-executivo)
2. [Escopo, método e limites](#2-escopo-método-e-limites)
3. [O que já funciona bem](#3-o-que-já-funciona-bem)
4. [Benchmark com aplicativos e planilhas](#4-benchmark-com-aplicativos-e-planilhas)
5. [Problemas e riscos atuais](#5-problemas-e-riscos-atuais)
6. [Vocabulário financeiro e consistência dos números](#6-vocabulário-financeiro-e-consistência-dos-números)
7. [Histórico após desvinculação e ciclo de vida dos espaços](#7-histórico-após-desvinculação-e-ciclo-de-vida-dos-espaços)
8. [Exportação Excel e interoperabilidade](#8-exportação-excel-e-interoperabilidade)
9. [Backlog de oportunidades](#9-backlog-de-oportunidades)
10. [Roadmap sugerido](#10-roadmap-sugerido)
11. [Cenários de validação](#11-cenários-de-validação)
12. [Métricas e pesquisa com usuários](#12-métricas-e-pesquisa-com-usuários)
13. [Decisões pendentes e limites de escopo](#13-decisões-pendentes-e-limites-de-escopo)
14. [Fontes](#14-fontes)

## 1. Resumo executivo

O Orange Finance tem uma base coerente para **finanças pessoais e de pequenos grupos**, com uma vantagem importante: registro manual simples, uso offline e separação entre espaço pessoal e compartilhado.

O próximo salto de qualidade não depende de acumular telas. Depende de tornar três promessas mais claras:

1. **“Eu entendo os números.”** Saldo atual, resultado mensal, valores pendentes, dívida de cartão e saldo por pessoa não são a mesma coisa.
2. **“Eu consigo recuperar e levar meus dados.”** Sincronização não substitui backup; backup técnico não substitui uma planilha utilizável; acesso revogado não resolve sozinho o destino do histórico.
3. **“Eu sei o que acontece quando colaboramos.”** É necessário distinguir titular, autor, pagador, beneficiário e responsável pelo espaço.

### Cinco prioridades recomendadas

| Ordem | Prioridade de produto | Motivo |
|---|---|---|
| 1 | Explicar e alinhar saldos, filtros e valores realizados/previstos | Reduz decisões tomadas a partir de uma leitura equivocada |
| 2 | Melhorar recuperação: lixeira, prévia de importação e cópia antes de substituir | Reduz impacto de enganos individuais e compartilhados |
| 3 | Exportar Excel/CSV com escopo explícito | Entrega autonomia e análise sem exigir uma nova infraestrutura |
| 4 | Definir política de saída, remoção, histórico e responsabilidade | Resolve separações, saída de moradores e continuidade familiar |
| 5 | Evoluir cartão e recorrência para refletir a vida real | Aproxima o app de extratos, faturas e compromissos continuados |

**Recomendação estratégica:** competir por clareza, confiança e colaboração, não por quantidade de integrações. Open Finance, inteligência artificial e investimentos avançados podem esperar.

## 2. Escopo, método e limites

- Foram lidos os modelos, cálculos, filtros, formulários, backup, sincronização, compartilhamento, testes e fluxo de publicação existentes.
- A configuração SQL foi consultada como documentação do comportamento e das relações atuais. **Não houve conexão administrativa, consulta de dados reais, migração ou alteração no Supabase.**
- Nenhuma conta, lançamento, sessão de usuário ou configuração do aplicativo foi alterada para elaborar o relatório.
- Não foram repetidos builds ou testes: a entrega é exclusivamente documental. A versão anterior foi publicada com 72 testes aprovados; esse histórico não equivale a executar novamente os testes nesta análise.
- O benchmark é uma leitura de documentação pública, **não um teste prático de assinaturas ou de todos os recursos dos concorrentes**.
- Fontes oficiais sustentam as comparações. Resultados de busca sem confirmação na página de origem foram descartados.
- Não foram comparados preços, notas de lojas, números de usuários ou promessas de rentabilidade.
- Não é uma auditoria de vulnerabilidades, certificação de acessibilidade, avaliação jurídica ou aconselhamento financeiro.

### Como interpretar os achados

| Marca | Significado |
|---|---|
| **C — confirmado** | O comportamento ou a limitação é observável na implementação lida; não significa necessariamente defeito |
| **R — risco inferido** | Consequência plausível do modelo; depende de ocorrer o cenário descrito |
| **H — hipótese** | Precisa de medição ou teste com usuários/dispositivos antes de ser tratada como problema comprovado |

**Prioridades:** P1 = tratar primeiro; P2 = evolução seguinte; P3 = oportunidade posterior. Não foi estabelecida uma emergência operacional P0 por esta análise.

**Esforço:** baixo, médio ou alto são comparações relativas, não estimativas de horas ou tokens. Regras de negócio, testes e migração pesam mais que o tamanho visual de um botão.

## 3. O que já funciona bem

- **Offline primeiro:** o usuário consegue registrar informações sem depender de uma conexão imediata.
- **Valores em centavos inteiros:** evita erros comuns de arredondamento com números decimais.
- **Parcelamento preserva o total:** os centavos restantes são distribuídos entre parcelas.
- **Pagamento de cartão como transferência:** evita tratar novamente como despesa o simples pagamento de uma compra já registrada.
- **Separação pessoal/compartilhado:** criar um grupo não copia automaticamente as finanças pessoais.
- **Titular de conta independente do titular do lançamento:** atribuir um cartão a alguém não reescreve seu histórico.
- **Conflitos de sincronização são reconhecidos:** existe comparação entre base, dados locais e nuvem, em vez de escolher cegamente o relógio mais recente.
- **Compatibilidade com registros antigos:** campos novos opcionais e preservação de campos desconhecidos nos registros.
- **UX evoluída na 1.1:** labels nos filtros, seleção de período, atalhos por pessoa/categoria e retornos com área maior.
- **Testes de domínio e migração:** já há proteção importante contra regressões; a lacuna maior é de cenários de interface e situações de uso prolongado.

Esses pontos devem ser preservados. Corrigir a ambiguidade dos números não exige abandonar o modelo offline nem transformar o app em uma planilha complexa.

## 4. Benchmark com aplicativos e planilhas

### 4.1 Comparação baseada em recursos confirmados

| Referência | O que a fonte oficial confirma | Situação no Orange Finance | Insight aproveitável |
|---|---|---|---|
| **Wallet, BudgetBakers** [S1] | Orçamentos, pagamentos planejados, fluxo de caixa, importação CSV/XLS/OFX, múltiplas moedas e compartilhamento com escolha de contas | Já possui orçamento, previsão, contas e espaços separados; não foi encontrado fluxo de importação de extratos ou múltiplas moedas | Facilitar migração de planilhas e análise do futuro antes de integrar bancos |
| **YNAB Together** [S2] | Logins individuais, grupos, compartilhamento de orçamentos, gestor do grupo, transferência de propriedade e regras explícitas para saída | Há logins individuais e responsável; não foi encontrado fluxo de transferência de responsabilidade | Publicar regras de colaboração e preparar continuidade do grupo |
| **Splitwise** [S3–S4] | Exportação de despesas por grupo/amigo; simplificação de dívidas sem alterar o saldo total de cada pessoa | Titular identifica pertencimento, mas não modela rateio, pagador e acerto entre pessoas | Não chamar resultado por titular de “quem deve a quem”; criar rateio como domínio separado |
| **Mobills, conteúdo oficial de planilhas** [S5] | Apresenta contas, cartões, registro de despesas, receitas, objetivos e modelos para situações como orçamento familiar e viagem | Boa base de registro; não foi encontrado modelo de objetivo com valor-alvo e prazo | Oferecer metas e modelos orientados a problemas concretos, não só mais categorias |
| **Excel, Microsoft** [S6–S7] | Modelos de orçamento e relatórios por tabela dinâmica; valores devem manter tipos consistentes para somar corretamente | Há backup JSON, mas não saída tabular analítica | Gerar dados limpos, com uma linha por lançamento e valores numéricos |
| **Google Sheets** [S8–S9] | Filtros e visualizações de filtro; histórico de versões e histórico de edição de célula, com limitações documentadas | Há filtros básicos e desfazer temporário; não foi encontrada trilha persistente de alterações | Aprender com visões salvas e rastreabilidade, sem copiar a complexidade das células |

**Cuidados na interpretação:**

- “Não encontrado no Orange” refere-se à versão e aos fluxos lidos, não a uma impossibilidade técnica.
- Recursos dos concorrentes podem variar por plano, plataforma e país. A tabela não garante disponibilidade para qualquer assinatura.
- O YNAB Together **não é um exemplo de isolamento idêntico ao Orange**: seus termos dão ao gestor acesso aos orçamentos indicados no documento. O espaço pessoal privado do Orange é um diferencial a preservar.
- Os termos do YNAB descrevem a perda de compartilhamento dos orçamentos recebidos após a saída. Portanto, **um arquivo pessoal congelado após desvinculação é uma proposta para o Orange, não um padrão universal comprovado do mercado**.
- O artigo da Mobills é material editorial do próprio fornecedor, com referência a 2025 no conteúdo consultado. Não foi usado para comprovar exportação atual do app, permissões ou integrações.
- Organizze foi considerado na pesquisa, mas não entrou na matriz de recursos: a extração consultada da página oficial não sustentou uma comparação funcional detalhada. Não se conclui ausência de recursos por isso.

### 4.2 O que aprender das planilhas sem virar uma planilha

| Força da planilha | Limitação típica, não inevitável | Aplicação no Orange |
|---|---|---|
| Liberdade de filtrar e agrupar | Exige conhecimento e organização | Relatórios salvos: “meu cartão”, “despesas da casa”, “ano atual” |
| Fórmulas e tabelas dinâmicas | Fórmulas podem ser alteradas ou configuradas incorretamente | Cálculos consistentes no app, exportação com números tipados |
| Colunas personalizadas | Estruturas variam e dificultam importação | Tags opcionais e importação com mapeamento de colunas |
| Cenários futuros | Pode misturar previsão com fatos | Área de simulação explicitamente separada dos lançamentos reais |
| Histórico de versões em serviços colaborativos | Não é uma auditoria contábil imutável; há limites de acesso e granularidade | Histórico por registro e ação, com política de retenção |
| Cópia independente do arquivo | Pode circular desatualizada ou com dados sensíveis | Exportação identificada por espaço, período e momento de geração |

## 5. Problemas e riscos atuais

### 5.1 Matriz priorizada

| ID | Achado e consequência | Evidência local | Classe / prioridade / confiança |
|---|---|---|---|
| A01 | **Saldo não é uma fotografia do mês selecionado.** Movimentos pagos não têm corte por data no cálculo, inclusive quando a previsão recebe um limite. Quem volta a um mês antigo pode interpretar como saldo daquele fechamento | [Cálculo de saldos](./src/lib/finance.ts#L16), [uso no painel](./src/pages/Dashboard.tsx#L43) | C / P1 / alta |
| A02 | **Resumo e lista podem representar conjuntos diferentes.** O resumo considera mês/pessoa; conta, categoria, busca e tipo restringem a lista depois | [Resumo](./src/pages/Transactions.tsx#L73), [lista filtrada](./src/pages/Transactions.tsx#L84) | C / P1 / alta |
| A03 | **“Fatura atual” representa dívida agregada, não uma fatura por ciclo.** Não há fechamento, vencimento ou entidade de fatura no modelo de conta | [Modelo](./src/lib/db.ts#L17), [cálculo da tela](./src/pages/Accounts.tsx#L17) | C / P1 / alta |
| A04 | **Falhas de perfil podem não chegar ao fluxo de salvamento.** O dado é salvo localmente, mas a tentativa de atualização remota tem erros absorvidos; o aviso pode ser apenas “Perfil salvo” | [Salvamento](./src/sync-context.tsx#L265), [mensagem](./src/pages/Settings.tsx) | C / P1 / alta |
| A05 | **A troca de espaço pode não propagar a falha ao chamador.** O helper de ação captura o erro globalmente; quem aguarda a troca pode continuar um fluxo de sucesso sem a troca ter ocorrido | [Ação e troca](./src/sync-context.tsx), [entrada em espaço](./src/components/SharedSpaces.tsx) | R / P1 / média-alta |
| A06 | **Remoção não entrega um histórico arquivado utilizável.** A participação é excluída e o app retorna ao Pessoal; cache preservado não é um arquivo formal nem uma cópia exata garantida na data da saída | [Remoção](./supabase/migrations/202610150002_workspaces.sql#L219), [retorno ao Pessoal](./src/sync-context.tsx#L250) | C / P1 / alta |
| A07 | **Colaboração sem autoria e revisão persistentes.** Titular não é autor; o modelo guarda estado e timestamps, mas não registra quem alterou cada campo nem suas versões | [Registros](./src/lib/db.ts#L9), [gravação do espaço](./supabase/migrations/202610160001_v1.sql#L198) | C / P1 / alta |
| A08 | **Restauração é substituição, não mesclagem.** O aviso existe, mas um engano pode ser sincronizado. O backup cobre o espaço aberto e inclui todos os ajustes locais, inclusive perfil quando presente | [Exportar/importar](./src/lib/repo.ts#L245), [confirmação](./src/pages/Settings.tsx) | C / P1 / alta |
| A09 | **Continuidade depende do responsável.** Ele não pode sair do próprio espaço; não foi encontrado fluxo de transferência. A exclusão administrativa de sua conta de autenticação tem relações em cascata | [Saída](./supabase/migrations/202610150002_workspaces.sql#L229), [relações](./supabase/migrations/202610150002_workspaces.sql#L3) | R / P1 / alta |
| A10 | **Recuperação de exclusão é pouco descobrível e temporária.** Item avulso pode ser excluído diretamente na lista; existe desfazer, mas não uma lixeira navegável, apesar do soft delete | [Ação direta](./src/components/TransactionRow.tsx#L73), [soft delete](./src/lib/repo.ts#L145), [aviso temporário](./src/App.tsx) | C / P1 / alta |
| A11 | **Modais gerais não contêm a navegação por Tab.** Há foco inicial e Escape, mas não tratamento de Tab/Shift+Tab nem isolamento explícito do fundo. O seletor de mês possui tratamento próprio | [Modal geral](./src/components/Modal.tsx), [seletor](./src/components/MonthPicker.tsx), [padrão WAI-ARIA S11](#14-fontes) | C / P1 / alta |
| A12 | **Mensal recorrente é uma sequência finita de registros.** O usuário escolhe quantidade, limitada a 120; não há regra indefinida, pausa, término ou gerador continuado | [Criação](./src/lib/repo.ts#L66), [formulário](./src/components/TransactionForm.tsx) | C / P2 / alta |
| A13 | **Resumo de ex-participantes perde identidade na apresentação.** O ID permanece, mas o painel agrupa titulares fora da lista de membros em “Sem titular” | [Por pessoa](./src/pages/Dashboard.tsx#L60), [cache de membros](./src/lib/hooks.ts) | C / P2 / alta |
| A14 | **Backup valida formato, mas não toda a coerência financeira.** Data tem regex, não validação de calendário; importação não faz a mesma checagem de referências usada pela sincronização | [Schema](./src/lib/backup-schema.ts), [importação](./src/lib/repo.ts#L286), [referências](./src/lib/sync-data.ts) | C / P1 / alta |
| A15 | **Crescimento do histórico pode pressionar o modelo.** Há leitura integral dos registros e snapshot com limite de 5 MB; excluídos continuam no histórico técnico | [Leitura](./src/lib/hooks.ts), [sincronização](./src/lib/sync.ts), [limite](./supabase/migrations/202610150002_workspaces.sql#L40) | R / P2 / alta para o limite; H para lentidão |
| A16 | **Gesto e hover podem ser menos previsíveis em dispositivos híbridos.** A gaveta depende de ponteiro de toque, e sua visibilidade depende de capacidade de hover | [Gaveta e ponteiros](./src/components/TransactionRow.tsx#L75) | H / P2 / média |

### 5.2 O que esses achados não significam

- A01 não demonstra perda de dinheiro ou dados: demonstra uma diferença entre saldo agregado e saldo histórico.
- A02 pode ser uma decisão de produto legítima. O problema é não deixar explícito se o card resume “o mês” ou “esta seleção”.
- A03 não invalida o saldo devedor do cartão; falta o ciclo que permite chamá-lo de fatura de um período.
- A04 não significa que o perfil local se perdeu. O risco é a pessoa acreditar que outro aparelho já recebeu a mudança.
- A05 não afirma ausência de aviso global: o contexto registra o erro. A hipótese é a coexistência de erro com continuação de um fluxo pelo chamador.
- A09 diz respeito à **exclusão da conta de autenticação pelo administrador**, não à simples remoção de um participante nem a um botão de exclusão de conta já existente no app.
- A11 é uma constatação estática sobre o controle de foco, não uma certificação de falha em todos os leitores de tela.
- A15 não demonstra lentidão atual. Não houve benchmark de desempenho ou medição em celular físico nesta análise.
- A16 não deixa o usuário totalmente sem saída: ainda existe o formulário de edição. Precisa ser testado em tablet/híbrido real.

### 5.3 Recomendações práticas

1. Mostrar **“Saldo atual”**, **“Resultado do mês”** e **“Resultado da seleção”** como conceitos distintos.
2. Preservar alterações históricas antes de oferecer automação que as reescreva.
3. Exibir estados separados: “salvo neste aparelho”, “aguardando envio”, “sincronizado” e “falha ao enviar”.
4. Adotar lixeira e prévia de restauração antes de criar edição em massa.
5. Manter backup anterior automático ou exigir download antes de uma substituição destrutiva.
6. Validar datas reais, IDs duplicados e vínculos antes de importar; exibir erros sem substituir parcialmente o espaço.
7. Tratar “participante atual”, “ex-participante” e “sem titular” como situações diferentes.
8. Acrescentar alternativa explícita às ações por gesto e padronizar a navegação de foco dos diálogos.

## 6. Vocabulário financeiro e consistência dos números

### 6.1 Separações que evitam confusão

| Conceito | Pergunta que responde | Não confundir com |
|---|---|---|
| Saldo atual em contas | Quanto há nas contas consideradas pelo app? | Resultado de um único mês |
| Saldo em uma data | Quanto havia até o corte escolhido? | Saldo atual mostrado ao voltar no calendário |
| Resultado previsto do mês | Receitas menos despesas registradas para aquele mês, incluindo pendências | Dinheiro já disponível |
| Resultado realizado | Recebimentos menos pagamentos efetivados, segundo uma regra explícita | Despesas contratadas e ainda não pagas |
| Dívida total do cartão | Quanto o cartão ainda representa de dívida no modelo? | Fatura que vence em uma data específica |
| Resultado por titular | Receitas menos despesas atribuídas à pessoa | Patrimônio pessoal ou valor de acerto entre membros |
| Acerto entre pessoas | Quem pagou por quem e quanto falta reembolsar? | Apenas o titular do gasto |

Hoje `monthSummary` inclui pendências nos totais e as identifica também em campos separados. Isso é válido como previsão, mas precisa ser comunicado.

### 6.2 Exemplos ilustrativos, não executados em contas reais

- **Mês passado:** em outubro o saldo atual é R$ 3.000. Selecionar agosto não transforma o cálculo atual em saldo de fechamento de agosto. Uma futura visão histórica precisa de data de corte e de definição para saldo inicial.
- **Filtro:** duas despesas de R$ 100 e R$ 900 em categorias diferentes. Filtrar a primeira pode deixar a lista com R$ 100 e o resumo com R$ 1.000. As duas leituras são possíveis; o rótulo deve informar qual está sendo mostrada.
- **Pendente:** salário de R$ 5.000 ainda não recebido e despesas de R$ 3.000. Resultado previsto de R$ 2.000 não significa que há R$ 2.000 para gastar hoje.
- **Cartão:** compra de R$ 1.200 em 12 parcelas. Compromisso total, parcela mensal, dívida e fatura do ciclo devem ser apresentados separadamente. Pagamento da fatura não pode gerar uma segunda despesa.
- **Casal:** Alice paga R$ 200 de mercado para as duas pessoas. Marcar Alice como titular não informa automaticamente que Bob deve R$ 100.

Antes de implementar um botão “realizado/previsto”, decidir se serão necessárias datas distintas de compra, competência, vencimento e pagamento. Um booleano pago/pendente não registra sozinho todas essas informações.

## 7. Histórico após desvinculação e ciclo de vida dos espaços

### 7.1 Proposta de experiência

Criar uma área **“Espaços arquivados”**, separada dos espaços ativos:

- Somente leitura, com nome, motivo e data de arquivamento.
- Sem novas atualizações, inclusive de lançamentos antigos alterados depois.
- Permite busca, relatórios e exportação.
- Informa se o conteúdo representa o servidor na desvinculação ou apenas a última sincronização local.
- Arquivo independente: não é manter autorização de leitura no espaço original.

### 7.2 Opções e consequências

| Opção | Benefício | Limitação / decisão necessária |
|---|---|---|
| Arquivar última cópia local | Menor esforço e utilidade offline | Pode estar desatualizada e não existir em outro dispositivo |
| Preservar cópia do servidor na desvinculação | Corte consistente e possibilidade de acesso em outro aparelho | Exige retenção, autorização própria, armazenamento e fluxo confiável de captura |
| Exportar antes de sair | Entrega independência sem arquivo interno | Pode não ocorrer em uma remoção inesperada; não resolve a experiência de consulta no app |

**Preferência de produto:** cópia consistente no corte, disponível à pessoa desvinculada. **Não é uma mudança pequena de interface.**

### 7.3 Regras que precisam existir antes da implementação

1. Remoção pelo responsável e saída voluntária geram o mesmo arquivo?
2. Toda pessoa poderá preservar todo o histórico compartilhado ou apenas parte dele? Essa regra deve ser conhecida antes da entrada no grupo.
3. O corte inclui lançamentos futuros já cadastrados? Proposta: incluir tudo que já foi sincronizado até o corte, preservando a data financeira de cada item.
4. Alterações que ficaram somente no aparelho não fazem parte da cópia exata do servidor. Oferecer exportação separada das pendências; não descartá-las silenciosamente.
5. Qual nome e quais dados de ex-participantes permanecem? Preservar identificação útil sem incluir dados de perfil que não eram necessários ao grupo.
6. O que acontece se a pessoa entrar novamente? Proposta: não mesclar silenciosamente o arquivo antigo com o espaço ativo.
7. Arquivo apagado pelo usuário pode ser recuperado? Qual o prazo de retenção?
8. Remoção também deve invalidar o convite conhecido ou bloquear reentrada específica? Hoje trocar código e remover participante são ações diferentes.
9. A pessoa deve receber confirmação do que foi preservado e de quando o envio/recebimento de mudanças terminou.
10. Definir política de privacidade e retenção com orientação apropriada antes de prometer conservação indefinida. Não se pode apagar remotamente capturas e backups já obtidos.

### 7.4 Continuidade e encerramento

- **Transferir responsabilidade** deve ser um fluxo explícito, com aceite do novo responsável, antes de saída ou exclusão de conta.
- **Encerrar espaço** deve ser diferente de apagar seus dados: interromper colaboração, oferecer conferência e exportação, e só depois seguir a política de retenção escolhida.
- **Convidado somente leitura** é útil para consulta, mas não substitui arquivo congelado. Enquanto participa, esse convidado ainda recebe atualizações.
- **Fechar um mês** pode reduzir alterações acidentais, mas exige regra para correções posteriores, responsáveis e registro da reabertura.

## 8. Exportação Excel e interoperabilidade

### 8.1 Problemas que resolve

- Conferir despesas em uma ferramenta conhecida.
- Preparar orçamento anual e análises específicas.
- Entregar dados a outra pessoa sem conceder acesso ao espaço ativo.
- Guardar uma fotografia independente do período.
- Facilitar saída do aplicativo sem aprisionar o histórico.

**Exportar para análise, restaurar backup e sincronizar são operações distintas.** O botão de Excel não deve substituir o backup JSON.

### 8.2 MVP recomendado

- Botão **“Exportar planilha”** em Lançamentos ou Relatórios.
- Escolher **seleção atual** ou **período completo**, com indicação do espaço e dos filtros.
- Arquivo `.xlsx`, sem macros, com tabela de lançamentos e folha de contexto.
- Uma linha por parcela efetivamente cadastrada, sem acrescentar outra linha que duplique o total da compra.
- Excluir registros apagados por padrão; eventual exportação de auditoria deve ser uma opção identificada.
- Datas como datas e valores como números; formatação em reais, não texto com “R$” embutido.
- Descrições, notas e nomes devem ser gravados como texto literal, nunca fórmulas executáveis.

**Colunas propostas:** ID do lançamento, data financeira, descrição, tipo, categoria, conta de origem, conta de destino, titular, valor, status, grupo da série, número da parcela, quantidade de parcelas e observações.

**Folha de contexto:** nome/ID do espaço, período, filtros, data/hora de geração, versão do app e aviso sobre cópia local pendente. Não exportar sexo, nascimento, sessão ou configurações de autenticação.

Transferências precisam ser reconhecíveis: não somá-las como receitas/despesas nos resumos. Valor assinado ou colunas separadas devem ter regra documentada e não inverter silenciosamente um movimento.

### 8.3 Excel, CSV e backup

| Formato | Uso principal | Esforço relativo | Cuidado |
|---|---|---|---|
| CSV | Dados tabulares simples e interoperáveis | Baixo a médio | Separador, acentos, decimais, datas e interpretação de texto como fórmula |
| XLSX | Consulta amigável, tipos, múltiplas folhas e formatação | Médio | Biblioteca, tamanho do bundle, compatibilidade e tipos corretos |
| JSON do app | Restauração técnica | Já existe; melhorias de restauração têm esforço próprio | Escopo, identidade do espaço, privacidade dos ajustes e substituição |
| Relatório PDF | Compartilhar um resumo fechado | Médio | Não serve para análise tabular nem restauração |

Para evitar pesar a abertura do app, avaliar carregamento da biblioteca de Excel apenas quando houver exportação. Essa é uma proposta futura, não uma dependência adicionada.

### 8.4 Web versus celular

O app é web/PWA nos dois ambientes. Uma exportação por download não exige, por natureza, ser exclusiva do computador. Caso se escolha um MVP somente desktop, tratar isso como **decisão de experiência**, não como incapacidade técnica universal do celular.

### 8.5 Critérios de aceitação

- O arquivo abre em Excel e Google Sheets com acentos e valores corretos.
- Somatórios dos lançamentos e dos resumos coincidem para o mesmo escopo.
- O escopo e a geração ficam identificados no próprio arquivo.
- Não aparecem dados de outros espaços ou campos privados desnecessários.
- Um texto que comece com `=` permanece texto, sem criar fórmula.
- Parcela não é somada junto com um lançamento extra do total.
- Falha no download não muda registros ou status de sincronização.
- Exportação com dados locais pendentes não é apresentada como “última posição confirmada na nuvem”.

**Sobre tokens:** não há estimativa confiável antes de fechar o escopo. Um exportador simples tende a exigir menos trabalho que arquivamento multidevice. A validação de tipos, escopo e somas não deve ser cortada para economizar implementação.

## 9. Backlog de oportunidades

| ID | Funcionalidade | Problema resolvido / cenário | Prioridade | Esforço | Dependência principal |
|---|---|---|---|---|---|
| O01 | Resumo do mês versus resumo da seleção | Entender exatamente o que os filtros estão somando | P1 | Baixo–médio | Vocabulário e decisão de escopo |
| O02 | Excel/CSV com contexto | Analisar, compartilhar e levar o histórico | P1 | Médio | Contrato de dados exportados |
| O03 | Lixeira e restauração por item/série | Recuperar exclusões sem restaurar um espaço inteiro | P1 | Médio | Retenção e conflitos de restauração |
| O04 | Prévia de importação e cópia anterior | Evitar substituir o grupo errado e detectar arquivos incoerentes | P1 | Médio | Validação semântica e identificação do espaço |
| O05 | Arquivo após desvinculação | Consultar o período de convivência sem acompanhar o futuro | P1 | Alto na opção multidevice | Política e captura consistente |
| O06 | Papéis de acesso e histórico de alterações | Saber quem mudou e permitir consulta sem edição | P1 | Alto | Autoria confiável e autorização por operação |
| O07 | Transferir responsável / encerrar espaço | Separação, falecimento, mudança de morador ou troca de organizador | P1 | Alto | Aceite e política de continuidade |
| O08 | Cartão por ciclo, fechamento e vencimento | Conferir faturas, parcelas futuras e pagamentos parciais | P1 | Alto | Modelo financeiro e migração |
| O09 | Conciliação de contas | Comparar saldo registrado com extrato e encontrar diferença | P2 | Médio | Saldo de corte e ajustes rastreáveis |
| O10 | Recorrência contínua, pausa e encerramento | Aluguel, salário e assinatura que não acabam após duas ocorrências | P2 | Médio–alto | Regra geradora e prevenção de duplicatas |
| O11 | Rateio e reembolso entre pessoas | Um paga por todos; divisão 50/50, percentual ou valor fixo | P2 | Alto | Pagador/beneficiário separados do titular |
| O12 | Metas com valor e prazo | Reserva, viagem, reforma e compra planejada | P2 | Médio | Regra de contribuição sem contar despesa duas vezes |
| O13 | Importar CSV/OFX com prévia | Migrar de planilha/extrato sem recadastrar meses | P2 | Médio–alto | Mapeamento e deduplicação |
| O14 | Calendário de compromissos e lembretes | Evitar vencimentos esquecidos | P2 | Médio–alto | Datas confiáveis e limites de execução da PWA |
| O15 | Tags, busca por intervalo e visões salvas | Viagem, projeto, dependente ou “tudo do meu cartão” | P2 | Médio | Filtros consistentes |
| O16 | Fechamento mensal e relatório comparativo | Conferir orçamento versus realizado e mudanças de hábitos | P2 | Médio–alto | Regras de período e correção posterior |
| O17 | Edição em lote e duplicação | Corrigir categorias ou cadastrar itens semelhantes com menos esforço | P3 | Médio | Prévia, desfazer e proteção de séries |
| O18 | Acessibilidade e modo de apresentação simplificado | Teclado, leitor de tela, baixa visão e menor carga cognitiva | P1 para barreiras; evolução contínua | Médio | Testes com pessoas e dispositivos diversos |
| O19 | Parcelas restantes e compromissos futuros | Saber quanto da renda dos próximos meses já está comprometido | P2 | Médio | Diferenciar dívida, parcela e fatura |
| O20 | Planejamento de cenários | “Se a renda cair ou o aluguel subir, quanto sobra?” | P3 | Médio–alto | Simulação sem modificar dados reais |

### Casos de uso que orientam melhor que uma lista de telas

- **Casal:** despesas comuns, gastos individuais, rateios e histórico de convivência.
- **República:** entrada/saída de moradores, divisão desigual e reembolsos.
- **Família com dependentes:** titular não é necessariamente usuário com login; avaliar entidade de pessoa dependente sem conta própria.
- **Renda variável:** projeção conservadora, receitas previstas versus recebidas e reserva para meses fracos.
- **Uso individual prolongado:** importação de extrato, conciliação, busca anual e compromisso de parcelas.

## 10. Roadmap sugerido

As ondas abaixo são propostas de sequência, **não versões prometidas nem um calendário contratado**.

### Onda A — clareza e recuperação

- Tratar A01/A02/A04/A05/A10/A11/A14.
- Entregar Excel/CSV e prévia de importação.
- Melhorar explicações de fatura e resultado por pessoa sem mudar silenciosamente o modelo financeiro.
- **Saída esperada:** números explicáveis, enganos recuperáveis e dados portáveis.

### Onda B — confiança na colaboração

- Fechar regras de desvinculação e retenção.
- Histórico de alterações, papéis de acesso e preservação de ex-participantes.
- Transferência de responsabilidade e arquivamento.
- **Saída esperada:** grupo continua compreensível mesmo quando pessoas entram, saem ou discordam de uma alteração.

### Onda C — rotina financeira real

- Cartões por ciclo, recorrência contínua, conciliação e importação de extratos.
- Metas, relatórios anuais e compromissos futuros.
- **Saída esperada:** menos recadastro e mais correspondência com a vida bancária.

### Onda D — automação e escala, somente após medir demanda

- Integrações bancárias, notificações mais sofisticadas, anexos e sugestões automáticas.
- Evolução da sincronização por registros e do armazenamento, caso os limites sejam atingidos.
- **Saída esperada:** reduzir trabalho sem aumentar a opacidade do app.

**Regra transversal:** qualquer evolução preserva IDs, datas e valores existentes, explicita alterações de interpretação e tem caminho de recuperação. Uma tag do Git preserva código; não é backup das finanças.

## 11. Cenários de validação

Estes são testes propostos para futuras implementações. **Não foram executados nesta entrega.**

| Cenário | Verificação / resultado esperado a definir ou preservar |
|---|---|
| Trocar para mês passado com pagamentos posteriores | Interface distingue saldo atual de saldo no corte |
| Receita futura marcada como recebida | Regra de data e efeito na previsão ficam explícitos |
| Filtrar conta, categoria, titular e busca juntos | Total da seleção coincide com a lista, ou o resumo é rotulado como mensal |
| Compra parcelada e pagamento da fatura | Não duplica despesa; ciclo e dívida conferem |
| Salvar perfil com rede disponível, mas servidor falhando | Mantém dado local e comunica pendência/erro remoto |
| Falha durante troca de espaço | Nenhuma mensagem contraditória; espaço ativo permanece identificável |
| Excluir e restaurar série em dois dispositivos | IDs e valores preservados; conflitos explicados |
| Backup com data inexistente ou conta ausente | Erro antes de substituir qualquer registro |
| Importação de espaço pessoal dentro de compartilhado | Escopo, prévia e consequência ficam inequívocos |
| Remover alguém que estava offline | Não apaga pendências silenciosamente nem promete corte exato a partir do cache |
| Entrar novamente após remoção | Arquivo antigo e espaço ativo não são mesclados automaticamente |
| Excluir administrativamente a conta do responsável | Processo de continuidade/exportação é verificado previamente |
| Novo membro em grupo antigo | Explica quais dados históricos poderá ver e alterar |
| Teclado em todos os modais | Foco contido, fechamento e retorno previsíveis |
| Tablet com toque e mouse, leitor de tela e zoom | Ações acessíveis sem depender só de gesto/hover/cor |
| 10 mil, 50 mil e 100 mil registros sintéticos | Medir abertura, filtros, memória e tamanho do snapshot, sem usar dados reais |
| Exportar textos especiais, acentos e centavos | Arquivo válido, sem execução de fórmulas e sem arredondamento indevido |
| Atualização de PWA antiga para nova | Offline e dados preservados; versão identificável sem pedir limpeza do site |

## 12. Métricas e pesquisa com usuários

### Métricas propostas

| Dimensão | Sinal a acompanhar |
|---|---|
| Compreensão | Pessoa explica a diferença entre saldo, resultado do mês e dívida de cartão |
| Recuperação | Tempo e sucesso para recuperar uma exclusão ou sair de uma importação incorreta |
| Sincronização | Taxa de falhas visíveis, tempo de pendência e conflitos resolvidos sem perda |
| Autonomia | Exportações concluídas e arquivos que abrem corretamente |
| Colaboração | Entendimento do titular, das permissões e das consequências de saída |
| Acessibilidade | Conclusão de tarefas com teclado, leitor de tela e zoom |
| Desempenho | Percentis de abertura, filtro e exportação por volume e dispositivo |

Não atribuir números-alvo arbitrários sem uma linha de base. Medir primeiro, escolher metas depois.

Começar com sessões moderadas com usuários reais, inclusive pessoas com necessidades de acessibilidade que desejem participar. Perguntas úteis:

- “O valor mostrado é quanto você tem ou quanto espera receber?”
- “Ao filtrar uma categoria, qual total você espera que apareça?”
- “Se você sair deste grupo, o que acha que vai continuar vendo?”
- “Você está registrando quem pagou, de quem é a despesa ou quem deve reembolsar?”
- “Que análise você faz numa planilha que ainda não consegue fazer aqui?”

Se houver telemetria futura, exigir consentimento quando aplicável e minimizar dados: não coletar descrições, valores, nomes de titulares ou arquivos financeiros como eventos analíticos.

## 13. Decisões pendentes e limites de escopo

Antes de desenvolver, responder:

1. O Orange quer ser registro de fluxo de caixa, orçamento por competência ou ambos com modos explícitos?
2. O grupo compartilha tudo ou existem contas visíveis apenas a parte dos participantes?
3. Quem pode corrigir mês encerrado, excluir dados e restaurar backup?
4. Um titular precisa ter login ou pode ser um dependente?
5. O ex-participante tem direito de produto a uma cópia de todo o histórico? Qual corte e retenção?
6. A planilha exporta o que aparece na tela ou todo o período escolhido? As duas opções precisam de nomes diferentes.
7. “Recorrente” significa repetir N vezes ou continuar até cancelamento?
8. Qual é a política para responsável inativo, falecimento, perda de conta e encerramento de grupo?

### O que não priorizar agora

- Chat de IA com acesso amplo às finanças.
- Integração bancária antes de conciliação, deduplicação e tratamento de falhas.
- Investimentos avançados ou multimoeda sem demanda demonstrada.
- Gamificação punitiva ou notificações que exponham valores na tela bloqueada.
- Uma tela inicial com todas as métricas e todas as opções.
- Prometer histórico imutável, backup completo ou revogação de cópias locais sem mecanismo que realmente os sustente.

**Conclusão:** a oportunidade mais forte é um app que mantenha a simplicidade de registrar, a liberdade de analisar numa planilha e a previsibilidade necessária para compartilhar finanças. Recuperação, explicação dos números e regras de convivência trazem mais confiança que uma grande quantidade de funcionalidades isoladas.

## 14. Fontes

### Produto e implementação local

- [Funcionalidades da versão 1.1](./funcionalidades-do-app.md).
- [Modelo de dados](./src/lib/db.ts), [cálculos financeiros](./src/lib/finance.ts), [operações e backup](./src/lib/repo.ts).
- [Filtros](./src/pages/Transactions.tsx), [painel](./src/pages/Dashboard.tsx), [contas](./src/pages/Accounts.tsx), [ajustes](./src/pages/Settings.tsx).
- [Sincronização](./src/lib/sync.ts), [mesclagem e validação](./src/lib/sync-data.ts), [contexto de sincronização](./src/sync-context.tsx), [perfil](./src/lib/profile.ts).
- [Compartilhamento](./src/components/SharedSpaces.tsx), [ações dos lançamentos](./src/components/TransactionRow.tsx), [modais](./src/components/Modal.tsx).
- [Migração de espaços](./supabase/migrations/202610150002_workspaces.sql), [migração 1.0](./supabase/migrations/202610160001_v1.sql), [migração 1.1](./supabase/migrations/202610160002_v1_1.sql).
- [Workflow de publicação](./.github/workflows/deploy-pages.yml): envio à `main` dispara publicação; uma branch documental separada evita esse efeito sem alterar o workflow.

### Benchmark externo — consultado nesta análise

| ID | Fonte oficial | Uso no relatório |
|---|---|---|
| S1 | [BudgetBakers — Wallet](https://budgetbakers.com/en/products/wallet/) | Recursos declarados, importação e compartilhamento; não valida disponibilidade de banco brasileiro específico |
| S2 | [YNAB Together — termos suplementares](https://www.ynab.com/terms/ynab-together) | Papéis, responsabilidade, compartilhamento e consequências da saída; documento informa atualização em 11/12/2024 |
| S3 | [Splitwise — exportação dos dados](https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data) | Exportação por grupo/amigo e distinção entre planilha e backup JSON |
| S4 | [Splitwise — Simplify Debts](https://kb.splitwise.com/balances-and-expenses/what-is-simplify-debts) | Acerto entre pessoas e preservação do saldo total |
| S5 | [Mobills — modelos de controle financeiro](https://www.mobills.com.br/blog/planilhas/planilha-de-controle-financeiro/) | Modelos por objetivo e descrição básica do produto; conteúdo editorial, não matriz de recursos atual por plano |
| S6 | [Microsoft — modelos de orçamento Excel](https://excel.cloud.microsoft/create/en/budget-templates/) | Planilhas de orçamento e planejamento |
| S7 | [Microsoft — tabelas dinâmicas](https://support.microsoft.com/en-us/excel/get-started/create-a-pivottable-to-analyze-worksheet-data) | Organização tabular, tipos e análise |
| S8 | [Google Sheets — filtros e visualizações](https://support.google.com/docs/answer/3540681?hl=en) | Visões de análise independentes e filtros salvos |
| S9 | [Google — histórico de versões e edição](https://support.google.com/docs/answer/190843?hl=en) | Rastreabilidade com limitações; não equivale a auditoria imutável |
| S10 | [Nielsen Norman Group — placeholders e labels](https://www.nngroup.com/articles/form-design-placeholders/) | Clareza de formulários e carga de memória; reforça a melhoria já feita na 1.1 |
| S11 | [W3C WAI-ARIA — modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Contenção e restauração de foco |

As referências externas foram sintetizadas, não copiadas integralmente. Páginas e políticas podem mudar; revalidar as afirmações relevantes antes de transformá-las em requisitos de implementação.
