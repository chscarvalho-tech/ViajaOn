# Arquitetura e referência de configuração

## Estrutura de uma instância

```
server.js                 HTTP: webhook, API do painel, follow-ups a cada 5 min
cli.js                    operação pelo terminal (resumo, leads, lead, lacunas, testar, validar, prompt)
lib/app.js                monta as peças (repo, config, wa, cérebro, motor); simulador; custo estimado
lib/motor.js              regras: entrada, agrupamento, gates, aplicação da decisão, envio, transferência, follow-up
lib/cerebro.js            prompt de sistema, schema JSON da resposta, chamada ao Claude, score
lib/config.js             lê e valida config/*.json e conhecimento/*.md (relidos a cada mensagem)
lib/db.js                 SQLite nativo do Node (data/sdr.db)
lib/waakg.js              cliente REST do WA-AKG
painel/index.html         painel web (HTML + JS puro, sem build)
scripts/registrar-webhook.js
config/bot.json, config/funil.json
conhecimento/*.md
data/sdr.db               criado na primeira execução
```

## Ciclo de uma mensagem

1. O WA-AKG faz `POST /webhook` com `X-Webhook-Signature: sha256=<hmac>`. O servidor valida o HMAC com `WEBHOOK_SECRET` e responde 200 na hora.
2. `message.received`: ignora grupos, status, números em `numeros_ignorados` e números dos `destinos`. Cria o lead se for novo, grava a mensagem (deduplicada pelo id do WhatsApp) e zera o contador de follow-ups.
3. **Agrupamento:** espera `aguardar_segundos` sem novas mensagens daquele lead antes de processar.
4. **Gates:** opt-out, bot desligado, modo humano (retoma se a pausa venceu) e etapa ganho/perdido encerram aqui. Palavra exata de opt-out marca a saída sem chamar a IA.
5. **Claude:** prompt de sistema (persona, regras, funil e conhecimento, em cache) + histórico (até `historico_max_mensagens`) + `<contexto_interno>` (data e hora, horário do time, etapa, dados, critérios, score e notas) no último turno. A saída segue um JSON Schema com enums reais.
6. **Aplicação:** mescla os dados, recalcula o score pelos pesos, muda a etapa (registrando o evento com o motivo), cria a lacuna, envia os balões com "digitando..." e executa a ação.
7. `message.sent` (o que sai do número): se não foi o bot (comparando id e texto), é alguém do time. Grava como `humano`, muda para modo humano e pausa por `pausa_humano_horas`.

Ações possíveis da IA: `continuar`, `transferir` (etapa encaminhado, modo humano sem retorno automático e aviso ao destino), `enviar_material`, `enviar_agendamento`, `desqualificar` e `optout`.

## bot.json

| Campo | Efeito |
|---|---|
| `nome_bot`, `empresa` | Como o bot se apresenta |
| `persona`, `tom`, `idioma` | Estilo de escrita |
| `modelo` | Modelo do Claude (padrão `claude-opus-5-5`; alternativas mais baratas: `claude-sonnet-5-5`, `claude-haiku-5-5`) |
| `esforco` | `low` (padrão, rápido para chat), `medium` ou `high`. Mais esforço deixa a resposta mais lenta e cara |
| `fallback_recusa` | Se o classificador de segurança recusar, o servidor da Anthropic refaz em outro modelo (só nos modelos que suportam) |
| `ativo` | Liga ou desliga o bot para todos (também pelo botão do painel) |
| `aguardar_segundos` | Tempo de espera para agrupar mensagens seguidas (padrão 8) |
| `max_baloes` | Máximo de balões por resposta |
| `simular_digitacao` | Mostra "digitando..." com pausa proporcional ao texto |
| `historico_max_mensagens` | Quantas mensagens recentes a IA vê |
| `pausa_humano_horas` | Quanto tempo o bot fica calado depois que alguém do time responde. Com `0`, só volta se devolverem |
| `horario` | `{ fuso, dias: [0=dom..6=sáb], inicio, fim }`. Define quando há follow-up e o que o bot diz sobre o time estar disponível |
| `link_agendamento` | Calendly, Google Agenda etc. Vazio significa transferir em vez de agendar |
| `palavras_optout`, `mensagem_optout` | Saída da lista sem chamar a IA |
| `mensagem_erro` | Enviada se a IA falhar ou recusar; depois disso o lead vai para o time |
| `numeros_ignorados` | Números (ou finais) que nunca viram lead (família, fornecedores) |

## funil.json

| Campo | Efeito |
|---|---|
| `etapas[]` | `{ id, nome, tipo: ativa\|humano\|final, objetivo, manual? }`. `novo`, `encaminhado` e `desqualificado` são obrigatórias. `manual: true` = só o time move (ex.: ganho/perdido). O `objetivo` orienta o bot em cada etapa |
| `campos[]` | `{ id, rotulo, descricao }`: dados que o bot coleta. Viram colunas do CSV e campos editáveis na ficha |
| `criterios[]` | `{ id, peso, descricao }`. Score = soma dos pesos atendidos ÷ soma total × 100 |
| `faixas` | `{ quente, morno }` para a temperatura |
| `regras_transferencia[]` | Quando passar para uma pessoa |
| `regras_desqualificacao[]` | Quando encerrar |
| `destinos[]` | `{ id, nome, whatsapp, quando }`. O bot escolhe o destino na transferência e o número recebe o aviso. Sem número, o lead só aparece no painel |
| `materiais[]` | `{ id, nome, tipo: link\|imagem\|documento\|video, url, nome_arquivo?, legenda?, quando }`. A URL precisa ser pública. Sem URL, o material fica fora do prompt |
| `followups[]` | `{ apos_horas, etapas[], mensagem }`, em sequência. Cada um conta a partir da última mensagem do bot e só dispara se o lead estiver numa das etapas. Placeholders: `{nome}`, `{campo}`, `{campo\|texto se vazio}` |

IDs: minúsculas, números e `_`. Renomear um id de etapa não migra os leads que já estão nela: mova-os pelo painel.

## API do painel

Todas as rotas exigem o cookie de login, exceto `/webhook`, `/saude` e `/api/login`.

`GET /api/status` · `GET /api/resumo?dias=N` · `GET /api/leads?etapa&temperatura&modo&q` · `GET|PATCH|DELETE /api/leads/:id` ·
`POST /api/leads/:id/mensagem {texto}` · `POST /api/leads/:id/devolver` · `GET /api/exportar.csv` ·
`GET /api/conhecimento` · `PUT|DELETE /api/conhecimento/:nome` · `GET /api/lacunas?status` ·
`POST /api/lacunas/:id/resolver {resposta, incorporar}` · `POST /api/lacunas/:id/ignorar` ·
`GET|PUT /api/config/bot|funil` · `POST /api/bot/ativo {ativo}` · `POST /api/simulador {sessao, texto}` · `GET|DELETE /api/simulador/:sessao`

## Banco (data/sdr.db)

- `leads`: identidade, etapa, score, temperatura, dados/critérios/tags (JSON), resumo, destino, responsável, notas, modo (`bot`/`humano`), `pausado_ate`, optout, contadores e marcos de tempo.
- `mensagens`: `direcao` in/out; `autor` lead, bot, humano ou sistema; `wa_id` único para deduplicar.
- `eventos`: lead_criado, etapa, transferido, humano_assumiu, bot_retomou, followup, material_enviado, agendamento_enviado, optout, desqualificado, erro_ia, recusa_ia, erro_envio.
- `lacunas`: aberta, resolvida ou ignorada.
- `uso_ia`: tokens por chamada, usados no custo estimado.

Leads de simulação usam o jid `sim:<sessao>` e ficam fora das listas e métricas.
Backup: copie `data/sdr.db` com o servidor parado, ou use `sqlite3 .backup`.
