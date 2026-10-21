# Bot SDR de WhatsApp da ViajaON: instruções para o Claude Code

Este projeto é o atendente virtual da ViajaON no WhatsApp. Ele faz a triagem de quem chama, qualifica pelo perfil de viagem e de milhas, conduz até a conversa de 30 minutos com o Luís ou a cotação, e tem um painel de gestão no navegador.
Foi configurado pelo Cesar (consultor). Quem está usando agora é o **Luís**, dono da ViajaON, que está começando com IA: fale em português simples, explique o porquê de cada passo e faça **uma pergunta por vez**.

## Primeira coisa a fazer ao abrir este projeto

Verifique o estado da instalação **antes de qualquer outra tarefa**:

1. Existe o arquivo `.env`? Se não existir, a instalação nesta máquina ainda não foi feita: siga **Instalação** abaixo.
2. Rode `node cli.js validar`. Ele lista as **pendências** (o que ainda está vazio). Se houver alguma, mostre ao Luís o que falta, usando a tabela de Pendências abaixo, e combine de preencher agora.

Se `validar` não mostrar pendências, siga direto com o pedido do Luís.

## Instalação nesta máquina

1. Confirme o Node 22.13 ou mais novo: `node -v`. Se for mais antigo ou não existir, oriente a instalar a versão LTS em https://nodejs.org e reabrir o VS Code.
2. `npm install`
3. Crie o `.env` a partir do modelo e gere os segredos (não mostre o `WEBHOOK_SECRET` na conversa):
   ```bash
   node -e "const fs=require('fs'),c=require('crypto');let e=fs.readFileSync('.env.example','utf8');e=e.replace(/^WEBHOOK_SECRET=.*$/m,'WEBHOOK_SECRET='+c.randomBytes(24).toString('hex')).replace(/^PAINEL_SENHA=.*$/m,'PAINEL_SENHA='+c.randomBytes(9).toString('base64url'));fs.writeFileSync('.env',e);console.log('Senha do painel:',e.match(/^PAINEL_SENHA=(.*)$/m)[1])"
   ```
   Diga ao Luís a senha do painel e peça que guarde num lugar seguro.
4. **Instale a IA (OmniRoute)** seguindo `omniroute/README.md`, passo a passo com o Luís. É ali que entra a pendência 1 abaixo. Atenção: o OmniRoute deve ser iniciado a partir da pasta de usuário (`cd $HOME`), nunca de dentro desta pasta, senão ele lê o `.env` do bot e ocupa a porta 3100.
5. `node omniroute/testar.mjs`: pelo menos um modelo `gemini/...` com ✓.
6. `node cli.js validar`
7. `npm start` e abra http://localhost:3100 para mostrar o painel (vai estar vazio). Pare com Ctrl+C quando terminar.

## Pendências: peça estas informações ao Luís

Peça uma de cada vez, explicando para que serve. Depois de cada resposta, grave no arquivo indicado, rode `node cli.js validar` e marque o item como feito na sua resposta.

| # | O que pedir | Para que serve | Onde gravar |
|---|---|---|---|
| 1 | **Chave gratuita do Google Gemini** (https://aistudio.google.com/apikey → Create API key), para conectar no OmniRoute | É o "cérebro" que escreve as respostas, via OmniRoute | Painel do OmniRoute (http://localhost:20128 → Providers → Google Gemini), conforme `omniroute/README.md`. A chave fica só no OmniRoute: nunca a repita na conversa nem a grave em arquivo do bot |
| 2 | **WhatsApp do Luís** para receber os leads (com DDI e DDD, ex.: 5511999998888) e, se for outra pessoa, o WhatsApp de quem atende clientes em viagem | Quando o bot passa um lead, esse número recebe o aviso com o resumo | `config/funil.json` → `destinos[].whatsapp` (`luis_comercial` e `atendimento_viagem`; se for a mesma pessoa, repita o número) |
| 3 | **Link de agenda** da conversa de 30 minutos (Calendly, Google Agenda etc.) | O bot envia o link quando o lead aceita a conversa. Sem link, o bot transfere direto para o Luís | `config/bot.json` → `link_agendamento` |
| 4 | **Horário real de atendimento** (dias e horas) | Define quando saem os follow-ups e o que o bot diz sobre o retorno do time | `config/bot.json` → `horario` (dias: 0=dom … 6=sáb) |
| 5 | **Link público do eBook de milhas** (PDF acessível sem login) | O bot envia o eBook para quem quer aprender sobre milhas ou ainda não tem viagem marcada | `config/funil.json` → `materiais[0].url` (sem URL, o bot simplesmente não oferece) |
| 6 | **Nome do bot** (padrão: "Assistente ViajaON") | Como o atendente se apresenta. Ele sempre diz que é assistente virtual e nunca se passa pelo Luís | `config/bot.json` → `nome_bot` |
| 7 | **Textos aprovados** para: preço/honorários do serviço; como funciona o acesso às contas de milhas | Hoje o bot não responde esses assuntos e passa para o Luís. Com o texto aprovado, passa a responder | `conhecimento/04-limites-e-assuntos-sensiveis.md`: troque a regra de transferir pelo texto aprovado |
| 8 | **Canal de WhatsApp**: ver abaixo | Decide como o bot se conecta ao WhatsApp | `.env` → `WAAKG_*` |

Itens 1 a 6 são necessários para testar. O item 7 é opcional (o bot funciona transferindo). O item 8 só é necessário para colocar no ar.

### Item 8: decisão de canal (explique antes de configurar)

O bot se conecta ao WhatsApp pelo **WA-AKG**, um programa gratuito que usa o WhatsApp Web. Ele **não é oficial**: o WhatsApp pode banir o número, principalmente com envio em massa. O plano de automação da ViajaON prevê o **WhatsApp Business oficial** com n8n, que é o caminho sem esse risco, mas exige adaptar o conector (`lib/waakg.js`); chame o Cesar para isso.
Se o Luís quiser seguir com o WA-AKG como piloto, recomende um **número dedicado**, não o principal da ViajaON, e siga `docs/wa-akg.md`.

## Testar antes de ligar (depois dos itens 1 a 6)

Converse com o bot pelo terminal ou pelo painel (menu **Simulador**). Nada sai pelo WhatsApp.

```bash
node cli.js testar "oi, tenho bastante ponto no cartão e queria ir pra Europa de executiva" t1
node cli.js reset-teste t1
```

Rode estas 6 situações e mostre ao Luís trechos das respostas para ele aprovar o jeito de falar:

1. Executivo que viaja muito, tem cartão black e quer ir para a Europa de executiva → deve chegar a "Pronto para o diagnóstico" e receber o link ou ser passado ao Luís.
2. Pessoa sem viagem em vista, só curiosa sobre milhas → deve ir para Nutrição (e receber o eBook, se houver).
3. Fornecedor oferecendo serviço → deve ser encerrado com educação ("Fora do perfil").
4. "Quanto vocês cobram?" → não pode dar valor; deve passar para o Luís.
5. "Quero falar com o Luís" → deve passar para o Luís.
6. "parar" → deve sair da lista.

Se algo sair errado, ajuste o texto em `conhecimento/` ou `config/` (não o código) e teste de novo. Para ver tudo o que o bot recebe como instrução: `node cli.js prompt`.

## Colocar no ar

Siga `docs/wa-akg.md`: instalar o WA-AKG, conectar o número pelo QR code, preencher `WAAKG_URL`, `WAAKG_API_KEY` e `WAAKG_SESSION` no `.env`, rodar `npm start` e `npm run registrar-webhook`, e **desligar o auto-reply e a mensagem de boas-vindas do WA-AKG**. Para manter o bot e o OmniRoute ligados sem terminal aberto, use o pm2 (passo 7 de `omniroute/README.md`).

## Sobre a IA

O bot usa o **OmniRoute** (`config/bot.json` → `"provedor_ia": "omniroute"`), que roda nesta máquina e usa a conta gratuita do Gemini do Luís. `modelo` é uma lista em ordem de preferência; o bot tenta cada um até um responder e, se nenhum responder, passa o lead para o Luís com a mensagem de contingência (evento `erro_ia` na ficha).
O Gemini gratuito toma as decisões certas, mas às vezes escapa do tom da marca com um elogio leve. Se o Luís quiser o padrão mais alto, troque para o Claude (`"provedor_ia": "anthropic"`, `"modelo": "claude-opus-5-5"` e `ANTHROPIC_API_KEY` no `.env`), que é pago por uso. Detalhes em `omniroute/README.md`.

## Uso do dia a dia

| O Luís pede | Faça |
|---|---|
| "Como está o bot?" | `node cli.js resumo 7` |
| Leads quentes / esperando atendimento | `node cli.js leads quentes`, `node cli.js leads humano` |
| Ver a conversa de alguém | `node cli.js lead <id ou telefone>` |
| Perguntas que o bot não soube responder | `node cli.js lacunas`, depois escreva as respostas com ele no arquivo certo de `conhecimento/` |
| Mudar o jeito de falar, regras, funil | Edite `config/bot.json`, `config/funil.json` ou `conhecimento/*.md`; vale na próxima mensagem |

## Regras

- O bot sempre se apresenta como assistente virtual. Não remova isso.
- Preço do serviço, valores de passagem, acesso a contas e vistos: só com texto aprovado pelo Luís na base. Até lá, transfere.
- Nunca peça, mostre ou grave em outro lugar o conteúdo do `.env` (chaves e senhas). Ele não vai para o Git.
- O banco `data/sdr.db` tem nome, telefone e conversas de clientes (LGPD): não compartilhe, e apague o lead no painel se alguém pedir.
- Mudança de comportamento vai na configuração. Código (`lib/`) só muda com o Cesar.

Documentação completa: `omniroute/README.md` (a IA), `docs/arquitetura.md` (todos os campos de configuração), `docs/funil-e-qualificacao.md` (como pensar o funil) e `docs/wa-akg.md` (WhatsApp).
