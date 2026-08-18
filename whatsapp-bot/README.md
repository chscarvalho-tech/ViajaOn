# viajaon-whatsapp-bot

Automação de prospecção (LinkedIn + WhatsApp) e bot de suporte para a **ViajaON** (concierge
de milhas e pontos). Adaptado do projeto `xama-outreach` (Xamã Studio) — mesma infraestrutura
de envio, rate limit e cadência, conteúdo (scripts de abordagem, objeções, isca de entrada)
todo reescrito para o Método ROTA e o público da ViajaON. Ver `Knowledge/brand_identity.md`
e `Knowledge/product_campaign.md` (pasta `Equipe ViajaOn` do outro projeto) para a fonte de
cada afirmação usada nos textos.

## Diferença mais importante em relação ao projeto original

O bot da Xamã abria com uma isca de teste gratuito (IPD). A ViajaON não tem um teste
equivalente hoje, então, por decisão do usuário, **a abordagem vai direto para o convite de
call de 30 minutos** — sem etapa de diagnóstico automatizado no meio. Quem demonstra
interesse recebe direto o `AGENDA_LINK`. A cadência de nutrição (D+1/D+3/D+10) começa a
contar a partir do primeiro contato, não de um resultado de teste.

## Antes de rodar qualquer coisa — leia isto

- **LinkedIn (Playwright) não é integração oficial.** Automatizar navegador no LinkedIn viola
  os Termos de Uso da plataforma. O risco real é a conta usada ser restringida ou banida —
  por isso os tetos diários e a rampa de aquecimento (`src/config.js`) não são opcionais. Use
  uma conta de LinkedIn **dedicada**, não a principal da ViajaON.
- **Canal de WhatsApp escolhido: Baileys** (`src/whatsapp/`, comandos `whatsapp:*`) — fala
  direto com o protocolo do WhatsApp, sem navegador. **Atenção:** esta foi a mesma abordagem
  testada primeiro no projeto da Xamã, e lá o login ficou falhando repetidamente ("não foi
  possível conectar"), provável rate-limit do WhatsApp contra a lib não-oficial — por isso a
  Xamã migrou para WhatsApp Web via Playwright (`src/whatsapp-web/`, comandos
  `whatsapp-web:*`), que continua neste repo como alternativa pronta pra usar se o Baileys
  não conectar de novo aqui. Antes de depender do Baileys em produção: teste
  `npm run whatsapp:login` cedo, com um número de WhatsApp **dedicado** (não o principal da
  ViajaON), e tenha o plano B (`whatsapp-web:login`) já validado como saída se o problema se
  repetir — não é garantido que vá funcionar só por trocar de conta/número.
- **A base de objeções (`content/objections.json`) deixa de propósito duas perguntas sem
  resposta automática: preço/modelo de cobrança e acesso a contas/senhas.** Nenhum documento
  da ViajaON hoje descreve esse processo, e o bot não deve inventar. Essas perguntas caem em
  escalonamento para humano até o Luís aprovar o texto certo — ver `objections.json` para os
  detalhes e completar antes de rodar em produção.
- **Não existe lista de contatos real da ViajaON neste repo.** Ao contrário do projeto da
  Xamã (que já vinha com 44 contatos de semente do Google My Maps), aqui `data/contacts/`
  está vazio de propósito — evita misturar dados de um cliente com o de outro. Ver "1.
  Importar contatos" abaixo.
- **Os seletores do Playwright para o LinkedIn e o WhatsApp Web não foram validados contra a
  UI ao vivo** (não há acesso a uma conta logada nesta sessão). Rode primeiro com `--dry-run`
  e supervisione a primeira leva com o navegador visível (`headless: false`, já é o padrão)
  antes de deixar rodando sem olhar.

## Instalação

```
npm install
npx playwright install chromium
cp .env.example .env              # preencha AGENDA_LINK, que é obrigatório
```

## 1. Importar contatos

Coloque os arquivos em `data/contacts/` (pasta vazia por padrão — ver acima):

- Export do Apollo → CSV com "apollo" no nome do arquivo (ver `content/apollo-template.csv`
  para as colunas esperadas). Vira contatos de LinkedIn, executivos/donos de empresa via
  perfil e título no LinkedIn.
- Export do Google My Maps → `.kml` (Menu do mapa → Baixar KML) ou `.csv` com "my-maps" no
  nome. Vira contatos de WhatsApp — donos de negócio encontrados pelo Google, mesmo perfil de
  público (renda alta, viagem a trabalho recorrente).

```
npm run import
npm run status
```

## 2. LinkedIn

```
npm run linkedin:login          # uma vez: loga manualmente na janela que abre
npm run linkedin:send -- --dry-run   # confere o que seria feito, sem clicar em nada
npm run linkedin:send           # roda de verdade, respeitando o teto diário
```

## 3. WhatsApp (Baileys — canal escolhido)

```
npm run whatsapp:login          # QR ou --phone=55DDDNUMERO pra código de pareamento
npm run whatsapp:send -- --dry-run   # confere o que seria feito, sem mandar nada
npm run whatsapp:send           # abordagem inicial (My Maps), respeitando o teto diário
npm run whatsapp:cadence        # dispara os passos de cadência D+1/D+3/D+10 vencidos
npm run whatsapp:bot            # modo "sempre ligado": escuta e responde (suporte + opt-out)
```

Bot de suporte (`whatsapp:bot`) — prioridade de resposta:

1. Palavra de opt-out ("parar", "sair" etc.) → remove da fila e confirma.
2. Contato já abordado dizendo que quer agendar ("sim", "manda", "link" etc.) → manda o
   `AGENDA_LINK`.
3. Qualquer outra coisa → casa contra `content/objections.json` (7 objeções, todas ancoradas
   em `Knowledge/brand_identity.md` e `Knowledge/product_campaign.md`). Sem match → resposta
   de escalonamento + aviso no console pra um humano assumir. O bot nunca inventa resposta
   fora dessa base — inclusive preço e processo de acesso a contas, deixados fora de
   propósito (ver acima).

### WhatsApp via WhatsApp Web / Playwright (alternativa, se o Baileys não conectar)

```
npm run whatsapp-web:login      # uma vez: escaneia o QR da página oficial do WhatsApp Web
npm run whatsapp-web:run -- --dry-run
npm run whatsapp-web:run        # uma passada: checa inbox, responde, aborda, dispara cadência
```

Mesma lógica de negócio do Baileys (reusa `src/whatsapp/inbound.js`), só troca de onde a
mensagem vem: navegador real controlando o WhatsApp Web oficial, em vez de falar direto com o
protocolo. Mais lento e depende da máquina com o navegador aberto, mas não sofreu o problema
de conexão que o Baileys teve no projeto da Xamã.

**Rodar sozinho via Agendador de Tarefas do Windows** (mesmo padrão usado no projeto da
Xamã): crie uma tarefa que dispara `node src/cli.js whatsapp:bot` (ou `whatsapp-web:run`, se
for esse o canal em uso) de hora em hora, no horário comercial, dias úteis. A tarefa precisa
rodar como o usuário logado, com a sessão do Windows aberta.

## Estrutura

```
content/            textos aprovados (scripts.json, objections.json) — edite aqui, não no código
src/pipeline/        importação e normalização de contatos
src/content/          renderização de mensagem (variáveis + variação de redação)
src/scheduler/        rate limiter (tetos/rampa) e cadência D+1/D+3/D+10
src/linkedin/          sessão, convite, checagem de aceite, envio (Playwright)
src/whatsapp/           sessão, abordagem, cadência, bot de suporte via Baileys — canal escolhido
src/whatsapp-web/      sessão, envio e leitura de inbox via WhatsApp Web oficial (Playwright) — alternativa
src/store/db.js        store local em JSON (data/db.json) — contatos, mensagens, opt-outs
```

## O que falta pra rodar em produção

- **`AGENDA_LINK` no `.env`** — sem isso a maioria dos scripts de mensagem falha ao renderizar.
- **Contatos reais** — nenhum contato de LinkedIn/WhatsApp vem com este repo (ver seção 1).
- **Número de WhatsApp dedicado**, não o principal da ViajaON.
- **Validar se o Baileys realmente conecta desta vez** — testar `whatsapp:login` cedo; se
  repetir o erro que aconteceu no projeto da Xamã, o plano B (`whatsapp-web:login`) já está
  pronto no repo, só trocar de comando.
- **Validar os seletores do Playwright** contra a UI atual do LinkedIn e do WhatsApp Web
  (`src/whatsapp-web/*.js`) com `--dry-run` e depois em pequeno volume supervisionado.
- **Aprovar com o Luís as respostas de preço/cobrança e de acesso a contas/senhas** e incluir
  em `content/objections.json` — hoje essas duas perguntas caem em escalonamento de propósito.
- Decidir se o script `whatsapp_grupo` (broadcast pra grupo) é usado — hoje é só um texto
  pronto pra colar manualmente num grupo do WhatsApp, não está automatizado no código.
