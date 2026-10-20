# Importação de extratos e faturas: processo, aprendizados e automação

## 1. Objetivo e limites deste registro

Este documento registra o processo de uma consolidação financeira assistida, feita fora do app, e transforma os aprendizados em requisitos para um futuro importador do Orange Finance.

Objetivo do produto: o usuário fornece um extrato ou uma fatura, o sistema identifica o documento, extrai os movimentos, apresenta uma prévia conciliada e, após confirmação, grava lançamentos compreendidos pelo app no espaço escolhido.

**Este documento não contém dados financeiros reais, nomes de participantes, identificadores de usuários, números de contas/cartões, nomes de arquivos pessoais, hashes dos documentos ou transcrições de lançamentos.** Os números e as datas dos exemplos são exclusivamente fictícios. Os nomes das instituições e os rótulos dos seus produtos são mantidos porque são necessários para explicar os layouts.

Não é uma especificação oficial dos bancos nem uma certificação de suporte a todos os seus PDFs. As observações se referem às variantes efetivamente examinadas.

### Estado ao final do trabalho

- A consolidação foi feita com ferramentas locais e scripts auxiliares, sem implementar um importador no app.
- Foi produzida uma planilha compatível com o modelo compartilhado e, posteriormente, um backup JSON.
- O JSON recebeu os identificadores reais dos participantes, obtidos de uma planilha gerada pelo próprio espaço. Nenhum identificador é reproduzido aqui.
- Importação, integridade financeira e sincronização entre dois usuários foram testadas em bases isoladas, com nuvem simulada.
- A preparação do arquivo não fez uma gravação direta no Supabase. A importação no espaço real ficou a cargo do usuário; este registro não confirma que ela foi realizada.
- As correções feitas na planilha não alteraram os modelos XLSX originais nem implementaram as mesmas correções no código do app.

## 2. Processo realizado, em ordem lógica

1. **Inventariar documentos:** separar extratos de conta, faturas e documentos de investimento; identificar titular, instituição, conta, cartão, período e formato.
2. **Conferir o conteúdo:** não confiar no nome do arquivo para determinar mês, ano ou identidade do documento.
3. **Extrair localmente:** usar texto nativo do PDF; recorrer a coordenadas quando a ordem textual não representar as colunas; inspecionar imagens quando não houver texto suficiente.
4. **Construir registros intermediários:** manter valor assinado em centavos, data, descrição original, referência e posição no documento.
5. **Conciliar cada extrato:** verificar saldos e totais antes de misturar bancos ou classificar movimentos.
6. **Resolver contas e titulares:** associar cada fonte a uma conta financeira e ao participante correto.
7. **Conciliar transferências:** transformar o débito e o crédito correspondentes em uma única transferência.
8. **Tratar investimentos:** diferenciar uma posição financeira separada de movimentações automáticas internas da mesma posição.
9. **Normalizar descrições e categorias:** reduzir texto operacional, reconhecer marcas e manter dúvidas para revisão.
10. **Conferir saldos de referência:** distinguir o fechamento do extrato de uma posição informada em outra data; não inventar eventos para apagar diferenças.
11. **Integrar faturas:** importar compras, parcelas e encargos; cruzar pagamentos com os extratos; não duplicar os créditos de pagamento impressos na fatura.
12. **Corrigir competências:** reconhecer que a data original de uma compra parcelada não é a data de competência de todas as parcelas.
13. **Projetar parcelas restantes:** gerar apenas parcelas explicitamente identificadas, como pendentes, com origem e grau de certeza registrados.
14. **Gerar e recalcular o XLSX:** conferir fórmulas, filtros, tabelas, gráficos e campos técnicos.
15. **Gerar o JSON:** utilizar o contrato real do app, mapear titulares reais e excluir dados de exemplo.
16. **Validar de ponta a ponta:** testar os dados com as funções do aplicativo e simular importação/sincronização sem tocar na nuvem real.
17. **Publicar o resultado validado:** substituir o arquivo somente se a origem não tiver mudado durante o processamento.

### Decisões que exigiram confirmação

Foram tratados como decisões do usuário, não como inferências automáticas:

- contas e cartões que de fato existiam e quem era seu titular;
- natureza de uma receita cujo rótulo bancário não refletia sua finalidade;
- identificação de pagamentos sem fatura correspondente;
- inclusão de uma aplicação na mesma posição da conta ou em conta separada;
- saldo de referência e autorização para ajustes históricos;
- escolha de competência para parcelas sem nova data de lançamento;
- geração de parcelas futuras;
- agrupamento de pagamentos de uma mesma fatura.

Uma informação dada para explicar o contexto não autoriza, por si só, um lançamento novo. Exemplo: mencionar um estorno antigo já resolvido não significa que ele deva ser incluído novamente.

## 3. Ferramentas e separação de responsabilidades

No protótipo foram utilizados:

- **PyMuPDF:** extração de texto, posições e renderização de páginas.
- **openpyxl:** leitura/escrita do XLSX, estilos, validações, fórmulas e JSON técnico.
- **Decimal e centavos inteiros:** tratamento exato de valores monetários.
- **LibreOffice em modo headless:** recálculo de fórmulas e caches dos gráficos.
- **Módulos TypeScript do app:** validação do backup, faturas, saldos e sincronização.
- **Vite em execução local:** carregamento dos módulos reais do app para a validação.
- **fake-indexeddb:** teste de importação e sincronização em bases descartáveis.

Essas ferramentas demonstraram o processo, mas não obrigam a arquitetura futura a usar Python nem LibreOffice. A importação pelo app pode produzir o modelo interno diretamente; a planilha pode continuar como saída de auditoria.

Antes de incorporar bibliotecas ao produto, avaliar licença, distribuição, desempenho, suporte offline e tratamento de documentos não confiáveis.

## 4. Camada de extração: regras comuns

### 4.1 Identificação do documento

Identificar por evidências internas:

- instituição e tipo: extrato de conta, fatura, investimento ou outro;
- período inicial/final;
- data de emissão, fechamento e vencimento, quando aplicável;
- conta/cartão a associar;
- participante do espaço;
- moeda e convenção monetária.

Ocorreram nomes de arquivos com mês trocado e documentos de um ano diferente do esperado. A automação deve mostrar a divergência, não ajustar o ano silenciosamente.

O nome do arquivo é uma pista de interface, nunca a fonte contábil definitiva. Arquivos renomeados devem continuar identificáveis como o mesmo documento.

### 4.2 Texto, geometria e OCR

Fluxo recomendado:

1. Extrair texto com informação de página e posição.
2. Avaliar se há texto útil suficiente e se os campos obrigatórios estão presentes.
3. Quando as colunas se misturarem, reconstruir linhas por coordenadas.
4. Quando for uma digitalização, aplicar OCR ou solicitar revisão.
5. Conciliar a saída com os totais do documento.

OCR não foi automatizado neste trabalho: os extratos escaneados foram conferidos visualmente e transcritos. Isso é evidência de uma necessidade do produto, não de um parser OCR pronto.

Baixa confiança ou layout desconhecido deve resultar em revisão explícita. Não gravar uma interpretação parcial como sucesso.

### 4.3 Dinheiro e sinais

- Trabalhar em **centavos inteiros** no domínio e na integração.
- Converter valores brasileiros conforme o formato identificado: separador de milhar e vírgula decimal.
- Tratar `-`, sinal de menos Unicode, indicadores de crédito/débito e contexto da coluna.
- Extratos podem indicar sinal por bloco de entradas/saídas, não em cada item.
- Saldos podem ser negativos; o valor absoluto não substitui a leitura do sinal.
- Não reutilizar indiscriminadamente um conversor de texto brasileiro para um número já normalizado.
- Não usar ponto flutuante para igualdade de valores ou rateio financeiro.

Exemplo sintético: o texto `1.234,56` corresponde a `123456` centavos. No app, uma despesa tem `amount` positivo; o efeito negativo decorre de `type: "expense"`.

### 4.4 Datas e origem

Preservar separadamente, quando disponíveis:

- data original da compra;
- data de lançamento/contabilização bancária;
- competência da parcela;
- fechamento e vencimento da fatura;
- data efetiva de cada pagamento.

Quando só existir dia/mês, o ano deve ser derivado do período/ciclo documentado. Se houver mais de uma interpretação plausível, pedir confirmação. Não inferir automaticamente o ano de uma parcela pela ocorrência mais recente anterior ao vencimento: isso pode colocar todas as parcelas na data da compra original.

### 4.5 Rastreabilidade mínima

O registro intermediário deve permitir recuperar:

- documento de origem e versão do parser;
- página e linha, ou retângulo na página;
- descrição e valor originais;
- referência bancária, quando houver;
- campos inferidos e justificativa;
- correções confirmadas pelo usuário;
- correspondências de conciliação e seus critérios.

Rastreabilidade também contém dados sensíveis. No produto, a retenção do texto bruto precisa ser uma escolha explícita; não copiar tudo automaticamente para logs, telemetria e observações sincronizadas.

## 5. Aprendizados por instituição

### 5.1 Nubank — extratos de conta

**Observado:**

- Resumo com saldo inicial, saldo final, entradas, saídas e rendimento líquido.
- Detalhamento organizado em blocos de datas e totais de entradas/saídas.
- O sinal dos itens pode depender do bloco em que aparecem.
- Uma transação pode ocupar várias linhas; dados do recebedor e da instituição aparecem na continuação.
- Cabeçalhos e rodapés se repetem entre páginas.

**Estratégia:**

- Usar uma máquina de estados: data atual, direção atual e transação em construção.
- Interromper a leitura de rodapés sem descartar movimentos válidos de páginas seguintes.
- Anexar continuações ao item correto, não ao subtotal.
- Validar os totais diários por direção, os totais do período e o saldo final.
- Identificar cabeçalhos por estrutura, sem codificar nomes de pessoas.

**Rendimento apenas no resumo:** se não houver crédito individual datado, não inventar uma receita em um dia arbitrário. Registrar a diferença de conciliação e oferecer uma política explícita, como saldo de abertura adequado ou receita consolidada em data de referência confirmada. O rendimento precisa entrar na equação do resumo apenas uma vez.

### 5.2 Nubank — faturas de cartão

**Observado:**

- Compras, pagamentos, encargos e linhas de regularização de atraso aparecem no detalhamento.
- Alguns pares de regularização têm soma líquida zero: saldo/crédito de atraso ou encerramento de dívida/contrapartida.
- Multa, juros e IOF podem ser encargos reais mesmo quando outros itens se compensam.
- Houve diferença de um centavo entre a soma dos itens líquidos e o total cobrado.
- Um pagamento feito depois do vencimento pode aparecer em outra fatura.

**Estratégia:**

- Classificar cada linha por natureza antes de somar.
- Não tratar toda palavra “juros” como despesa nova: verificar a contrapartida e o contexto.
- Só excluir pares compensados quando a equivalência estiver demonstrada; palavra-chave sozinha não basta.
- Crédito de pagamento não é receita nova.
- Conciliar o total de compras/encargos líquidos com o total documentado e com o pagamento bancário.
- Diferença de centavos não autoriza arredondamento silencioso. Se aceita, criar ajuste explícito, com origem, valor e aprovação, mantendo a fatura pendente quando não houver pagamento.
- Não fixar o detalhamento em um número de página: procurar seções em todas as páginas relevantes.

### 5.3 Banco do Brasil — extratos

**Limite importante:** os extratos de conta examinados estavam em **XLSX**. Foi validada leitura estruturada de planilha, não um parser genérico de extrato PDF do BB.

**Observado:**

- Data, histórico, complemento, referência, valor e indicação de entrada/saída.
- Linhas de saldo de abertura e de saldo do dia não são transações.
- O complemento pode conter data efetiva diferente da data de contabilização.
- Aplicações e resgates automáticos podem zerar o saldo aparente da conta corrente sem eliminar o patrimônio disponível.

**Estratégia:**

- Mapear colunas pelos cabeçalhos e validar o sinal.
- Conferir cada saldo intermediário disponível.
- Preservar data contábil e efetiva; usar a segunda para sugerir correspondências sem apagar a primeira.
- Acrescentar suporte a BB PDF como adaptador próprio, com fixtures sintéticas e validação específica.

**BB Rende Fácil versus investimento separado:**

- Neste caso, o Rende Fácil foi confirmado como aplicação automática integrante da posição consolidada da conta.
- Aplicações/resgates internos ficaram no histórico de auditoria, não como despesas, receitas ou patrimônio duplicado.
- Um cofrinho efetivamente separado pode ser outra conta financeira, com transferências de aplicação/resgate.
- Não generalizar essa escolha para todos os usuários: depende de como o saldo informado já inclui o produto.
- Rendimentos efetivos são diferentes de principal aplicado/resgatado.

### 5.4 Banco do Brasil — faturas Elo e Visa

**Observado:**

- Resumo com saldo anterior, pagamentos/créditos e total.
- Seção de lançamentos com data, estabelecimento, localidade e valor.
- Parcelamento no padrão `PARC NN/TT`.
- A data impressa da compra pode ser repetida em várias faturas para parcelas diferentes.
- Fechamento e vencimento são dados próprios da fatura, não da compra.
- Cartões distintos podem compartilhar um limite.

**Estratégia:**

- Ler os campos pelos seus rótulos e localizar a seção de lançamentos.
- Extrair número da parcela e total sem removê-los ao simplificar o nome.
- Distinguir compras, pagamentos, estornos e demais créditos pela semântica; não classificar todo valor negativo como pagamento.
- Conferir a equação completa do resumo, sem assumir que saldo anterior e pagamentos sempre se anulam.
- Não somar limites compartilhados como se fossem independentes.
- Guardar o fechamento de cada documento: o dia pode variar entre meses.

### 5.5 Inter — extratos

**Observado:**

- Cabeçalhos por dia, com data por extenso e saldo do dia.
- Movimentos com descrição, valor e saldo após o movimento.
- Aplicações/resgates de produto separado misturados com Pix e outras operações.
- Um mesmo documento pode cobrir mais meses que o intervalo solicitado.

**Estratégia:**

- Extrair a data do cabeçalho e associar os movimentos seguintes.
- Validar saldo após cada item e fechamento diário.
- Ao recortar um período, obter o saldo imediatamente anterior ao início.
- Não importar novamente as movimentações que já compõem o saldo inicial.
- Aplicação/resgate de cofrinho separado é transferência entre posições próprias, não consumo/receita.

**Cobertura:** foram examinados extratos, não faturas Inter. A automação de faturas Inter permanece uma extensão futura.

### 5.6 Caixa — extratos

**Observado:**

- PDFs de extratos digitalizados como imagem.
- Linhas com data/hora, histórico, valor e saldo.
- Correção monetária e juros separados.
- O rótulo operacional de uma receita não determinava, por si só, sua categoria financeira real.

**Estratégia:**

- Tratar como fluxo OCR com revisão de valores, sinais e alinhamento de colunas.
- Usar os saldos acumulados como forte critério de verificação, sem considerá-los prova única de que a descrição está correta.
- Manter a ordem de movimentos no mesmo dia.
- Separar correção monetária, juros e transferências.
- Permitir regra de categoria confirmada pelo usuário; não inferir salário, pensão ou benefício apenas pelo nome do pagador.

**Cobertura:** não foi desenvolvido OCR automático nem analisado layout de fatura de cartão Caixa.

### 5.7 Mercado Pago — extratos

**Observado:**

- Data, descrição, identificador da operação, valor e saldo distribuídos em colunas.
- A ordem do texto extraído não reproduzia de forma confiável a ordem visual.
- Descrições quebradas em várias linhas.
- Foi necessário reconstruir itens por posições na página.

**Estratégia:**

- Identificar linhas de transação por âncoras de data e referência.
- Associar descrição e valores pelas faixas de coluna e proximidade vertical.
- Distinguir valor da operação de saldo da conta.
- Validar toda a sequência de saldos e os totais do resumo.
- Usar coordenadas relativas/âncoras de layout, não limites absolutos copiados de um único PDF.
- Detectar descrição incompleta e encaminhar para revisão. As correções pontuais feitas no protótipo não devem virar exceções codificadas por identificador real.

### 5.8 Mercado Pago — faturas

**Observado:**

- Resumo com total, vencimento e limite.
- Fechamento informado em outra seção.
- Lançamentos agrupados por cartão físico/virtual.
- Parcelamento descrito como `Parcela N de T`.
- Pagamento/débito automático pode aparecer como linha repetida na fatura.

**Estratégia:**

- Ler todas as seções relevantes, sem presumir uma página fixa.
- Associar cartões físicos/virtuais à mesma conta de crédito quando pertencerem à mesma fatura; final de cartão é pista, não autorização para criar nova conta.
- Não vincular automaticamente uma conta Mercado Pago a um cartão de outra instituição.
- Extrair parcelas antes de normalizar a descrição.
- Conciliar pagamentos parciais e integralizações sem duplicar as compras.

## 6. Conciliação de contas, transferências e saldos

### 6.1 Equações fundamentais

Para um extrato:

```text
saldo final = saldo inicial + entradas - saídas
```

Quando houver saldo após cada movimento:

```text
saldo do item = saldo anterior + valor assinado do item
```

Conferir ambas as equações e os totais declarados pelo banco. Um saldo final correto, sozinho, não detecta necessariamente duas omissões que se anulam.

Para o patrimônio do app:

- receita/despesa afeta a conta do lançamento;
- transferência debita a origem e credita o destino uma única vez;
- compras no cartão afetam a posição do cartão, não diretamente a conta bancária;
- pagamento da fatura reduz o dinheiro da conta e reduz a dívida do cartão;
- contas de crédito não entram no total de dinheiro disponível.

### 6.2 Correspondência de transferências próprias

Uma candidata forte combina:

- mesmo valor absoluto e sinais opostos;
- contas diferentes;
- titulares pertencentes ao espaço;
- evidência de contraparte/instituição;
- referência de operação, quando disponível;
- datas compatíveis com a efetiva movimentação.

Regras:

- Transferência entre dois participantes do mesmo espaço também é transferência interna.
- O titular do lançamento é o da conta de origem.
- Um par confirmado consome as duas evidências, mas gera um único lançamento.
- Não unir apenas por valor e data; valores repetidos são comuns.
- Mais de uma candidata plausível exige revisão.
- Movimentos entre bancos podem ter datas contábeis diferentes; usar janela limitada e evidência adicional, não uma tolerância indiscriminada.
- Sem a outra ponta, não inventar uma conta destino nem converter automaticamente em receita/despesa: apresentar o movimento não conciliado.

### 6.3 Saldo inicial, referência atual e empréstimos

- Saldo inicial é a posição no começo da cobertura, não uma receita daquele mês.
- O saldo informado pelo usuário pode ser de data posterior ao último extrato.
- Diferença pode representar lacuna de cobertura, rendimento não detalhado, aplicação automática, erro de sinal ou evento ainda não recebido.
- Investigar essas causas antes de propor ajuste.
- Ajuste autorizado deve ter origem manual, data de referência identificada e justificativa; não deve se disfarçar de transação bancária comprovada.
- Não lançar novamente um empréstimo já incorporado no saldo inicial.
- Não derivar valor contratado, saldo devedor, juros ou cronograma de empréstimo a partir do dinheiro que sobrou na conta.
- A política particular de ajuste usada na consolidação não é comportamento padrão do futuro importador.

## 7. Faturas: compras, pagamentos e quitação

### 7.1 Evitar dupla despesa

Exemplo sintético:

```text
Fatura: compra de 70,00 + compra de 30,00
Extrato: pagamento da fatura de 100,00

Resultado:
- duas despesas no cartão, total de 100,00;
- uma transferência de 100,00 da conta bancária ao cartão.

Não registrar 200,00 de despesas.
```

A linha de pagamento impressa na própria fatura é evidência da quitação, não uma segunda transferência nem uma receita.

Se só houver pagamento no extrato, sem o detalhamento da fatura, pode existir uma despesa provisória genérica. Ao receber a fatura depois, reconciliar/substituir esse registro com confirmação e histórico; não simplesmente acrescentar as compras.

Ausência de pagamento na documentação significa **pagamento não identificado**, não prova de que a pessoa deixou de pagar.

### 7.2 Contrato atual de faturas no app

Em [invoices.ts](src/lib/invoices.ts):

- Compra vinculada: `invoiceKey` e `invoiceDueDate`.
- Chave: `<id-do-cartao>:<mes-do-fechamento-YYYY-MM>`.
- O mês da chave é o do **fechamento**, não necessariamente o mês do vencimento.
- Pagamento: transferência com `invoicePaymentKey`, origem não crédito, destino no cartão e `paid: true`.
- Identificador obrigatório do pagamento: `invoice-payment:<invoiceKey>`.
- O valor do pagamento deve ser exatamente a soma das despesas vinculadas àquela chave.
- Só é permitido um pagamento com vínculo por fatura.
- `effectiveTransactions` deriva a quitação das compras pela existência do pagamento correspondente. Alterar apenas `paid` nas compras não substitui esse vínculo.

`cardCycle` calcula um ciclo para compras novas e avança quando a data é igual ou posterior ao fechamento. Na importação histórica, preservar o fechamento/vencimento do documento e a chave explícita, em vez de recalcular tudo pelo dia atualmente configurado no cartão.

### 7.3 Pagamentos parciais: limitação real

O modelo atual não representa vários pagamentos vinculados à mesma fatura: a validação exige um único pagamento integral.

No processo assistido, um agrupamento foi autorizado e preservou as evidências dos débitos originais. Isso conservou o saldo final e mensal, mas alterou a representação do saldo diário.

**Não reproduzir esse agrupamento silenciosamente na automação.**

Caminhos:

1. No MVP, bloquear a conclusão automática desses casos e pedir revisão.
2. No produto completo, estender o domínio para vários pagamentos e saldo pendente por fatura.

A segunda opção exige atualizar quitação, validações, sincronização, telas e testes; não basta criar identificadores diferentes para contornar a regra atual. Também é preciso representar pagamentos divididos entre contas ou titulares sem perder a origem de cada débito.

## 8. Parcelas: decisão final e correção do primeiro modelo

### 8.1 O erro a evitar

Algumas faturas repetem a data original da compra em todas as parcelas. Registrar cada parcela nessa mesma data concentra despesas em um único mês e pode até criar despesas em um ano anterior.

Parcelas diferentes não são duplicatas só porque têm a mesma data original, estabelecimento e valor.

### 8.2 Política adotada para parcelas faturadas

- Cada parcela pertence à competência da fatura em que foi cobrada.
- Preservar a data original impressa como evidência da compra, não como competência de todas as parcelas.
- Manter número da parcela, total, grupo da compra, chave da fatura, vencimento e situação de pagamento.
- Quando o documento não fornecer uma nova data de lançamento, usar o **dia 1 do mês faturado como referência de competência**, com essa natureza explícita.
- Dia 1 não é data real de compra nem pagamento. Foi uma convenção de compatibilidade com o modelo atual, não uma afirmação sobre padrão universal do mercado.
- Não usar automaticamente fechamento/vencimento como data da despesa: além de misturar conceitos, a passagem pelo calculador de ciclos pode deslocar o vínculo.
- A política se aplica às parcelas; compras à vista com datas válidas continuam nas datas registradas.

Exemplo sintético:

| Parcela | Referência de competência | Fatura | Situação |
|---|---|---|---|
| 2/6 | 01/02/2032 | fevereiro/2032 | Quitada quando houver pagamento conciliado |
| 3/6 | 01/03/2032 | março/2032 | Pendente se não houver pagamento identificado |

Para o produto, é preferível ter campos próprios como `purchaseDate`, `competenceMonth`, `postedDate`, `invoiceDueDate` e pagamentos separados. Esses nomes são uma proposta de domínio, não campos já implementados no app.

### 8.3 Parcelas futuras

Gerar somente quando houver parcelamento explícito e autorização do usuário:

1. Identificar a compra pela série, conta, descrição original e evidências, não apenas pelo nome simplificado.
2. Reunir as parcelas já encontradas em todos os documentos do lote e na base.
3. Usar a última parcela conhecida para projetar apenas as restantes.
4. Manter número/total e vínculo de grupo.
5. Marcar como pendente e identificar como projeção, não fatura recebida.
6. Projetar vencimentos pelos dias do cartão, ajustando dias inexistentes no mês.
7. Informar que vencimentos e valores finais serão confirmados por faturas futuras.
8. Não gerar parcelas depois da última nem recriar séries já encerradas.

Não inventar compras recorrentes de serviços só porque a marca aparece em vários meses. Recorrência e parcelamento são conceitos diferentes.

Se o total original da compra não estiver disponível, repetir o valor observado das parcelas é uma projeção; não presumir um ajuste exato da última parcela. Se o total for conhecido, distribuir os centavos preservando o total e as parcelas já cobradas.

**Importações posteriores devem reconciliar a projeção com a cobrança real**, preservando uma única parcela. A fatura real pode corrigir vencimento, valor e descrição. Não inserir novamente a parcela já prevista nem alterar pagamento confirmado sem revisão.

### 8.4 Efeito nos saldos atuais do app

Em [finance.ts](src/lib/finance.ts), uma despesa com `invoiceKey` entra no saldo da conta de crédito mesmo quando pendente. Portanto, projetar parcelas futuras com vínculo de fatura faz com que elas entrem nos compromissos totais do cartão.

A interface deve separar:

- dinheiro disponível nas contas;
- total de faturas recebidas ainda não quitadas;
- parcelas futuras projetadas;
- compromissos totais no cartão;
- valor a pagar no mês selecionado.

Não chamar toda a projeção de “fatura fechada” ou de “valor devido hoje”.

### 8.5 Estornos e cancelamentos

- Cancelamento não implica interrupção das parcelas.
- Um crédito de estorno pode abater uma fatura anterior enquanto as parcelas seguem sendo cobradas.
- Não cancelar parcelas nem criar crédito a partir de um comentário sobre reembolso.
- Lançar somente o evento efetivamente coberto pela documentação/escopo confirmado.
- Estorno já resolvido fora do período não deve reaparecer como pendência, receita ou observação enganosa.
- Um estorno real dentro da cobertura precisa de tratamento próprio; o contrato atual de compras vinculadas aceita despesas, e não se deve forçar um crédito negativo nesse contrato sem definir e testar o efeito em saldo e total da fatura.

## 9. Descrições e categorização

Separar três camadas:

1. **Texto original:** evidência protegida.
2. **Contraparte normalizada:** identificação para conciliação.
3. **Descrição de exibição:** curta e legível.

Regras úteis:

- Remover apenas prefixos operacionais reconhecidos, como “Compra no débito” ou “No estabelecimento”.
- Tratar versões com/sem acento e variações de espaços/pontuação.
- Reconhecer marcas: por exemplo, `IFD*IFOOD CLUB` pode ser exibido como `iFood`; `EBW*Canva`, como `Canva`.
- Não perder número de parcela, contraparte ou referência antes da conciliação.
- Reduzir nomes extensos para exibição sem transformar nomes curtos iguais em uma única identidade.
- Preservar intermediários relevantes quando não for possível identificar o lojista.
- Pix para pessoa física não determina categoria.
- Intermediário de pagamento ou marketplace não significa automaticamente “Mercado”.
- Correções do usuário devem virar regras do seu espaço, não classificações universais para todas as pessoas.
- Quando não houver evidência suficiente, usar “Outros” e oferecer revisão.

Sugestões automáticas devem mostrar confiança e permitir alteração. Não usar categoria para decidir se um evento é transferência ou pagamento: primeiro resolver a natureza financeira.

## 10. Modelo intermediário recomendado

Não fazer “texto do PDF → lançamento definitivo” em uma única etapa.

Separar:

- **Documento:** instituição, tipo, período, identidade, integridade e versão de parser.
- **Evidência de movimento:** conteúdo extraído, posição, sinal, valor, datas e confiança.
- **Decisão de conciliação:** natureza, conta, titular, pares, fatura, aprovação e justificativa.
- **Lançamento de domínio:** objeto final aceito pelo Orange Finance.
- **Projeção:** parcela futura com vínculo à evidência que permitiu gerá-la.
- **Lote de importação:** destino, estado, resultados e reversão.

Campos sugeridos para a camada de importação, ainda não implementados:

```text
documentId, parserVersion, sourceLocator, sourceReference
rawDescription, normalizedCounterparty, signedAmountCents
purchaseDate, postedDate, competenceMonth
closingDate, dueDate, installmentNumber, installmentCount
accountCandidate, holderCandidate, confidence, warnings
reconciliationLinks, decisionOrigin, importBatchId, projected
```

Evitar um único indicador de confiança que esconda incerteza crítica: valor, sinal, data, titular e conciliação precisam de avaliações próprias.

## 11. Contrato de integração com o Orange Finance

### 11.1 Fontes de verdade no código

| Referência | Responsabilidade |
|---|---|
| [backup-schema.ts](src/lib/backup-schema.ts) | Estrutura e tipos do backup |
| [repo.ts](src/lib/repo.ts) | `parseBackup`, `importBackup`, `exportBackup` |
| [invoices.ts](src/lib/invoices.ts) | Ciclos, vínculos, quitação e validação de faturas |
| [finance.ts](src/lib/finance.ts) | Saldos, total de dinheiro e resumos por mês |
| [sync-data.ts](src/lib/sync-data.ts) | Normalização, referências e mesclagem |
| [sync.ts](src/lib/sync.ts) | Sincronização e controle de revisão |
| [workspaces.ts](src/lib/workspaces.ts) | Espaços e participantes reais |
| [sheets-template-model.ts](src/lib/sheets-template-model.ts) | Cabeçalhos e representação da planilha |
| [Settings.tsx](src/pages/Settings.tsx) | Interface atual de importação de backup |

Validar novamente esses contratos ao implementar: este documento é um registro do estado examinado, não uma cópia que substitui o código.

### 11.2 Backup JSON

Estrutura de topo:

```json
{
  "app": "orange-finance",
  "version": 2,
  "exportedAt": "<data-hora-ISO>",
  "accounts": [],
  "categories": [],
  "transactions": [],
  "budgets": [],
  "settings": []
}
```

É um esqueleto ilustrativo, não um backup financeiro pronto.

Principais regras:

- Dinheiro em centavos inteiros.
- Tipos: `income`, `expense`, `transfer`.
- Contas: `checking`, `savings`, `wallet`, `credit`, `investment`.
- Datas financeiras em `YYYY-MM-DD`; timestamps de criação/atualização em milissegundos.
- `holderId` referencia o usuário real; nome de exibição não basta.
- Transferência usa `toAccountId`; não tem categoria de receita/despesa.
- Categorias de receita e despesa têm identidades/tipos próprios.
- Parcelas usam `groupId`, `installment`, `installments`, `repeatMode`, `repeatCount` e frequência compatível.
- IDs, vínculos e estado de exclusão devem ser coerentes em todas as tabelas.
- Não preencher configurações pessoais com valores de exemplo.

O schema valida forma e tipos; também são necessárias validação de referências, equações financeiras e regras de faturas.

### 11.3 Importar backup não é importar movimentações

A implementação atual de `importBackup` **substitui** contas, categorias, lançamentos, orçamentos e configurações locais dentro de uma transação.

Isso foi adequado para uma carga inicial em espaço dedicado, não para importar PDFs mensalmente em um espaço já utilizado.

O importador futuro precisa:

- adicionar/reconciliar registros, não chamar indiscriminadamente a restauração integral;
- reutilizar contas e categorias existentes;
- manter lançamentos manuais e alterações não relacionadas;
- tratar conflitos por registro;
- registrar o lote;
- sincronizar pela infraestrutura existente.

### 11.4 Espaço compartilhado e titulares

- Selecionar explicitamente o espaço de destino.
- Obter seus participantes autenticados.
- Mapear as contas e lançamentos aos usuários reais.
- Na consolidação, a aba `Pessoas` de uma planilha gerada pelo próprio espaço forneceu esse mapeamento.
- Importar somente a identidade necessária de uma planilha de exemplo; descartar seus movimentos fictícios.
- Não criar usuários Supabase nem inventar UUIDs de pessoas para resolver nomes.
- Não reutilizar o mapeamento de um espaço em outro sem validação.
- Backup JSON não escolhe automaticamente o espaço no app.
- Importar uma vez e sincronizar; não pedir que cada participante importe a mesma carga.

### 11.5 Persistência e Supabase

Preferir:

```text
prévia validada → confirmação → transação local → sincronização existente
```

O sistema atual mantém revisão e base de sincronização. Uma escrita manual direta no banco pode desalinhar as cópias locais e a nuvem.

Não usar chave administrativa no navegador, não contornar permissões e não tratar restauração de backup como upload livre para uma tabela.

## 12. Planilha como saída de auditoria

O XLSX foi útil para conferência humana, mas não deve ser um intermediário obrigatório para importar PDF.

Abas úteis:

- `Lançamentos`, `Contas`, `Categorias`, `Orçamentos`, `Pessoas`;
- conciliação de extratos e saldos;
- conciliação de faturas;
- pagamentos conciliados;
- histórico das linhas não convertidas em novos eventos;
- parcelas faturadas e projetadas;
- metadados e instruções.

Lições técnicas:

- A coluna de JSON técnico precisa concordar com valor, data, titular, situação e vínculos visíveis.
- Cabeçalhos devem seguir `TEMPLATE_HEADERS`, não uma cópia manual divergente.
- O modelo examinado tinha cobertura fixa de contas; a consolidação excedeu essa cobertura.
- Ao ampliar, conferir fórmulas, listas ocultas, seletores, validações e filtros, não apenas acrescentar linhas de contas.
- Tradução de fórmula não altera referências absolutas automaticamente. Copiar uma linha pode repetir a conta anterior sem gerar erro de Excel.
- Comparar o conjunto e a quantidade de contas calculadas com as contas reais, além de conferir valores.
- openpyxl escreve fórmulas, mas não calcula os resultados.
- Recalcular externamente quando for necessário entregar caches e gráficos prontos.
- No Windows, o executável de console `soffice.com` permitiu aguardar a conversão.
- Usar perfil isolado; não encerrar processos do usuário.
- Não salvar novamente por openpyxl depois do recálculo se isso apagar os caches necessários.
- Verificar filtros de conta, titular, mês e ano, inclusive um ano futuro e a última conta.
- Não sobrescrever planilha aberta/bloqueada nem arquivo alterado durante a validação.

## 13. Idempotência e duplicidades

Há problemas diferentes:

1. Mesmo arquivo importado novamente.
2. Mesmo documento exportado com outro nome/diagramação.
3. Períodos sobrepostos de extratos.
4. Duas evidências do mesmo evento: débito/crédito entre contas.
5. Pagamento presente no extrato e na fatura.
6. Parcela futura projetada que depois aparece em fatura real.
7. Duas compras legítimas iguais no mesmo dia.

Requisitos:

- Hash do arquivo ajuda no primeiro caso, mas não resolve todos os outros.
- Identificador estável não deve depender apenas do índice global do lote, nome do arquivo ou ordem de upload.
- Preferir referência bancária confiável dentro do contexto de instituição, conta e espaço.
- Quando não houver referência, combinar atributos, multiplicidade e evidências; não eliminar todas as linhas iguais.
- UUID determinístico pode ser útil, mas depende da qualidade da identidade do evento.
- Manter relação entre evidências e lançamento final.
- Registrar substituição de projeções e conversão de pagamentos provisórios.
- Reimportar deve produzir “já importado”, reconciliação ou conflito explicado, nunca duplicidade silenciosa.
- Checksums de integridade não são anonimização nem autorização para divulgar documentos.

## 14. Fluxo proposto para o usuário

1. **Selecionar espaço** e enviar um ou mais documentos.
2. **Detectar tipo/instituição/período**, exibindo divergências.
3. **Associar conta/cartão e titular**, reutilizando os existentes.
4. **Extrair e validar**, sem persistir lançamentos ainda.
5. **Exibir prévia**, com:
   - receitas, despesas, transferências e compras de cartão;
   - pagamentos encontrados/não encontrados;
   - totais e diferenças;
   - duplicatas e possíveis correspondências;
   - parcelas faturadas versus futuras;
   - datas comprovadas versus referências/projeções;
   - categorias sugeridas e motivos de baixa confiança.
6. **Resolver pendências**, com acesso local ao trecho correspondente.
7. **Confirmar o lote**, incluindo a política de parcelas futuras.
8. **Gravar atomicamente** e sincronizar.
9. **Mostrar resultado** e disponibilizar relatório anonimizado quando solicitado.
10. **Permitir reversão do lote**, sem apagar dados anteriores nem alterações posteriores de terceiros.

Reversão exige controle de versões e dependências: um simples “apagar tudo que tem esse lote” pode remover registros já editados ou usados por outros.

### MVP sugerido

Começar com documentos textuais dos layouts já observados e BB XLSX. Deixar OCR Caixa e layouts novos claramente identificados como revisão assistida.

Ordem de implementação:

1. Modelo intermediário, lotes e prévia.
2. Extratos textuais com conciliação de saldos.
3. Correspondência de transferências e idempotência.
4. Faturas com pagamento integral e competência de parcelas.
5. Projeções reconciliáveis de parcelas restantes.
6. OCR e revisão visual.
7. Evolução do domínio para pagamentos parciais.

A ordem não autoriza importar uma fatura parcial como se fosse integral. Nos casos não suportados, bloquear a gravação automática e explicar o motivo.

## 15. Validação e testes de aceitação

### Extração

- PDF textual, digitalizado, híbrido e com texto insuficiente.
- Arquivo com senha, corrompido ou fora dos limites aceitos.
- Documento renomeado, mês trocado e ano inesperado.
- Descrição multilinha e continuação entre páginas.
- Ordem textual diferente da visual.
- Sinais Unicode, centavos, milhares e saldo negativo.
- Cabeçalhos/rodapés repetidos sem lançamentos falsos.

### Integridade financeira

- Saldo inicial + movimentos = saldo final.
- Totais de entrada/saída e saldos intermediários conferidos.
- Rendimentos do resumo não somados duas vezes.
- Aplicação automática sem patrimônio duplicado.
- Cofrinho separado com transferência, não consumo.
- Ajuste manual somente após aprovação.
- Todos os saldos de contas verificados, não só o total agregado.

### Transferências e faturas

- Transferência entre contas do mesmo titular e entre participantes.
- Valores repetidos e correspondência ambígua.
- Datas contábeis diferentes com evidência compatível.
- Pagamento no extrato e crédito na fatura sem duplicidade.
- Pagamento posterior ao vencimento ligado à fatura correta.
- Pagamentos parciais explicitamente bloqueados ou suportados pelo novo domínio.
- Créditos/estornos distinguíveis de pagamentos.
- Reclassificações de soma zero não viram consumo.
- Divergência de um centavo apresentada, não ocultada.
- Nenhuma quitação criada só porque o vencimento já passou.

### Parcelas

- Mesma data original em vários documentos não concentra despesas.
- Parcela no mês faturado, com origem e vencimento preservados.
- Estado pago derivado da quitação da fatura correta.
- Última parcela não gera continuação.
- Série já completa não ganha projeções.
- Fatura futura real substitui/reconcilia previsão sem duplicar.
- Duas compras da mesma marca não compartilham grupo indevidamente.
- Fechamento anterior ao mês do vencimento.
- Mês curto e mudança de ano.
- Cancelamento/estorno antigo não remove cobranças ainda documentadas.

### App, sincronização e saída

- Validar com `parseBackup`, `validateInvoices`, `parseSyncData` e `validateReferences`.
- Conferir `effectiveTransactions`, `accountBalances`, `totalBalance`, `cardInvoices` e resumos mensais.
- Testar importação/exportação em IndexedDB isolado.
- Comparar registros por ID; o banco pode retornar ordem diferente da ordem do JSON.
- Simular sincronização e leitura pelo outro participante.
- Repetir sincronização sem novas escritas nem duplicidade.
- Confirmar que o espaço e seus participantes não foram trocados.
- Para XLSX, conferir erros de fórmula, caches, gráficos e filtros.

Os testes do processo cobriram essas funções reais do app em dados isolados. Isso não substitui uma suíte de parsers com fixtures sintéticas nem garante todos os cenários acima: a lista também inclui requisitos futuros.

## 16. Privacidade, retenção e descarte

### Para a futura automação

- Preferir processamento local quando viável.
- Caso haja servidor, informar finalidade, retenção e acesso; proteger transmissão e armazenamento.
- Não enviar documentos a OCR/IA externos sem autorização e política apropriada.
- Definir limites de tamanho, páginas, tempo e recursos; tratar PDFs como entrada não confiável.
- Não registrar texto bruto, documentos, tokens ou dados financeiros em logs de erro/telemetria.
- Separar evidência sensível de relatório técnico anonimizado.
- Não incluir dados reais em testes, commits, issues, screenshots ou documentação.
- Produzir fixtures inteiramente sintéticas; mascarar apenas nomes não remove valores, datas, referências e padrões identificáveis.
- Oferecer retenção mínima e descarte dos originais e derivados.
- Permissões do espaço e confidencialidade dos arquivos são controles diferentes.

### Antes de descartar os arquivos deste projeto paralelo

Excluir a pasta de documentos de entrada não remove necessariamente:

- planilhas e JSON gerados em outra pasta;
- cópias anteriores e snapshots;
- texto extraído, imagens renderizadas e arquivos OCR;
- scripts auxiliares com caminhos pessoais, valores ou exceções específicas;
- arquivos persistidos no diretório de trabalho da sessão da ferramenta;
- saídas de ferramentas, logs e histórico da conversa;
- downloads, lixeira, histórico de versões e backups do sistema;
- dados eventualmente importados no navegador ou sincronizados para a nuvem.

Este registro não copia os scripts particulares justamente porque eles continham decisões e informações específicas. Para implementação, reescrever adaptadores generalizados e testes sintéticos a partir das regras acima.

**Nenhuma exclusão foi realizada como parte da criação deste documento.** O descarte deve ser direcionado, após identificar os arquivos e confirmar o escopo. Não é possível prometer apagamento seguro de todas as cópias por remover uma única pasta.

## 17. Checklist para retomar a implementação

- [ ] Revalidar o contrato atual de dados e faturas no código.
- [ ] Definir o modelo de documento, evidência, projeção e lote.
- [ ] Especificar quais layouts são suportados e como identificar suas versões.
- [ ] Implementar parsing monetário/datas independente de um ano ou usuário específico.
- [ ] Criar fixtures sintéticas para cada instituição e variante.
- [ ] Implementar conciliação antes da categorização final.
- [ ] Resolver contas e participantes no espaço selecionado.
- [ ] Definir idempotência entre documentos, sobreposições e projeções.
- [ ] Separar competência, compra, vencimento e pagamento.
- [ ] Apresentar incertezas, diferenças e inferências antes da confirmação.
- [ ] Não usar restauração integral de backup para importação incremental.
- [ ] Definir reversão segura e sincronização de lotes.
- [ ] Testar limites, privacidade, retenção e descarte.
- [ ] Só persistir quando as validações obrigatórias passarem.

**Princípio central:** extrair texto é apenas a primeira etapa. O resultado confiável depende de identidade, conciliação, competência, quitação, idempotência e confirmação explícita do que o documento não permite concluir.
