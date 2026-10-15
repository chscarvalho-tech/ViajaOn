# Método: funil, qualificação e conhecimento

Use isto para configurar o bot de um negócio específico. O padrão do modelo é um funil B2C/B2B genérico.
Adapte ao ciclo de venda real do cliente; não copie sem pensar.

## 1. Comece pelo próximo passo de venda

Pergunte: "Quando um lead está pronto, o que acontece?" A resposta define o fim do funil do bot.

| Próximo passo | Configuração |
|---|---|
| Call ou demonstração com especialista | `link_agendamento` preenchido; regra de transferência para leads quentes que aceitaram |
| Orçamento ou proposta personalizada | Transferir para `comercial` quando os campos mínimos do orçamento estiverem coletados |
| Compra direta (link de checkout) | Material `tipo: link` com o checkout; transferir só em dúvidas ou objeções |
| Visita ou loja física | Coletar cidade e dia preferido; transferir para a unidade (um destino por unidade) |

O bot qualifica e prepara. Quem fecha é o time, exceto em vendas simples de checkout.

## 2. Campos: só o que muda a decisão

Cada campo deve mudar o que o time faz com o lead. Prefira de 5 a 8. Mais que isso vira interrogatório.

Ponto de partida (BANT adaptado):

- **Necessidade:** o problema, nas palavras do lead. É o campo mais importante.
- **Orçamento:** pergunte a faixa, não o número exato. Muita gente não sabe; o bot pode apresentar as faixas da base e perguntar qual se encaixa.
- **Prazo / momento:** "pra quando você precisa?"
- **Decisão:** "mais alguém participa da decisão?"
- **Contexto do segmento:** porte da empresa, número de pessoas, cidade, tipo de imóvel etc.

Na `descricao` de cada campo, diga o formato desejado ("faixa em reais", "mês/ano").

## 3. Critérios e pesos

- Escreva critérios verificáveis pela conversa, não opiniões ("orçamento a partir de R$ 5 mil", não "tem dinheiro").
- Some 100 nos pesos para leitura fácil. Necessidade aderente costuma pesar mais (25–35).
- Calibre as faixas pelo que o time considera um lead bom. Padrão: quente ≥ 70, morno ≥ 40.
- Critério de exclusão (ex.: "atende só SP") é melhor como **regra de desqualificação** do que como peso.

## 4. Regras de transferência

Transferir cedo demais desperdiça o time; tarde demais perde o lead. Boas regras:

- Sempre: pedido explícito por pessoa, reclamação, cliente atual com problema, assunto delicado.
- Lead quente que aceitou o próximo passo.
- Pergunta decisiva sem resposta na base (preço especial, condição fora do padrão).
- Negociação de desconto: o bot não negocia.

Um destino por fila real (comercial, suporte, unidade X). Com WhatsApp no destino, o vendedor recebe o resumo na hora.
Velocidade importa: leads contatados em minutos convertem muito mais do que em horas. Por isso o aviso é imediato.

## 5. Etapas

O padrão é `novo → triagem → qualificado → (encaminhado | nutricao | desqualificado)`, com ganho/perdido manuais.
Adicione etapas só se o time agir de forma diferente nelas (ex.: `agendado`, `proposta_enviada`). O `objetivo` de cada etapa
é instrução direta para o bot: escreva o que ele deve conseguir ali.

## 6. Follow-ups

- No máximo 3, espaçados (ex.: 3h, 24h, 72h). A última mensagem encerra com a porta aberta, sem pressão.
- Personalize com `{nome|}` e `{necessidade|o que você comentou}`.
- Só disparam dentro do horário configurado e só para quem parou de responder ao bot.
- Mais insistência aumenta o risco de denúncia e de banimento do número.

## 7. Base de conhecimento

Escreva como um manual para um vendedor novo:

- **Fatos e números**, não marketing ("instalação em 5 dias úteis", não "agilidade incomparável").
- **Preço:** se pode ser dito, coloque o valor ou a faixa. Se não pode, escreva a regra ("preço só após diagnóstico; diga que depende de X e Y e ofereça a conversa com especialista").
- **Para quem é e para quem não é:** isso alimenta a desqualificação educada.
- **FAQ** com as perguntas reais que o time recebe (peça ao usuário as 10 mais comuns).
- **Objeções:** a objeção, o argumento e a pergunta para seguir.
- Um arquivo por assunto, com nomes numerados (`01-`, `02-`) para a ordem ficar estável.
- Tamanho: até ~30 mil tokens funciona bem e fica em cache. Acima disso, corte o que o bot não precisa para vender.

## 8. Persona e tom

- Defina 2 ou 3 traços (consultiva, objetiva, calorosa) e um exemplo de como o time escreve.
- Formal ou informal deve seguir o público do cliente. Emojis com moderação.
- O nome do bot pode ser humano ("Ana"), mas ele sempre se apresenta como assistente virtual.

## 9. Checklist antes de ligar

- [ ] Conhecimento sem marcadores do modelo (`<!-- -->`, "Produto 1")
- [ ] Destinos com WhatsApp correto (DDI+DDD+número)
- [ ] Materiais com URL pública testada
- [ ] Horário e fuso certos
- [ ] `node cli.js validar` sem erros
- [ ] As 6 personas de teste rodadas no simulador e revisadas com o usuário
- [ ] Auto-reply e boas-vindas do WA-AKG desligados nessa sessão
