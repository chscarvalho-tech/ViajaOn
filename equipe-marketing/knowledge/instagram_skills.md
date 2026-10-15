# Skills de Instagram — ViajaON

**Atualizado:** 08/10/2026

## Onde estão as skills

As 9 skills do bundle [sergebulaev/instagram-skills](https://github.com/sergebulaev/instagram-skills) (MIT, v1.0.27) estão instaladas globalmente no Claude Code:

- Skills: `C:\Users\Pc\.claude\skills\ig-*\SKILL.md`
- Referências compartilhadas (fórmulas de gancho, algoritmo, hashtags, mídia): `C:\Users\Pc\.claude\instagram-skills\references\`
- Integrações opcionais (Python): `C:\Users\Pc\.claude\instagram-skills\lib\` — chaves em `C:\Users\Pc\.claude\instagram-skills\.env`

Elas ativam sozinhas quando o pedido é de Instagram. Este arquivo diz como cada uma se encaixa nesta equipe e o que prevalece quando a skill e a marca discordam.

## As 9 skills

| Skill | Faz | Precisa de chave? |
|---|---|---|
| `ig-caption-writer` | Legenda com gancho nos primeiros 125 caracteres, corpo escaneável, 1 CTA | Não |
| `ig-carousel-planner` | Carrossel slide a slide (capa que abre loop, valor, payoff que gera salvamento) + legenda | Não |
| `ig-content-planner` | Plano semanal: mix de Reels, carrosséis, estáticos e stories, com fórmula, ângulo, horário e meta | Não |
| `ig-hashtag-strategist` | Conjunto de 3–5 hashtags dimensionadas (nicho / médio / amplo) | Não |
| `ig-hook-extractor` | Engenharia reversa do gancho de um post viral → template para o nosso tema | Só para ler por URL (Apify) |
| `ig-humanizer` | Tira marcas de texto de IA; `--mode audit` faz o checklist pré-publicação | Não |
| `ig-profile-optimizer` | Auditoria de perfil: nome pesquisável, bio, link, destaques, grade das 9 primeiras, fixados | Não |
| `ig-repurposer` | Converte LinkedIn, blog, roteiro de YouTube ou thread de X em post nativo de Instagram | Não |
| `ig-audience-insights` | Lê hashtag do nicho e estatísticas de perfis (nosso ou concorrente) com dado real | Sim (`APIFY_TOKEN`) |

## Regras de Instagram que passam a valer (substituem as antigas desta equipe)

1. **Gancho nos primeiros 125 caracteres.** É o que aparece antes do "mais". A primeira linha precisa parar o dedo sozinha.
2. **Tamanho da legenda por formato**, não mais "1 a 3 frases" fixo:
   - Carrossel: legenda curta, os slides carregam o conteúdo.
   - Estático ou Reels: entre 150 e 1.500 caracteres na maioria dos casos (limite do Instagram: 2.200).
3. **Um CTA claro por post**, escolhido pela meta do post (salvar, compartilhar, comentar, seguir).
4. **Hashtags: 3–5, dimensionadas** — 2–3 de nicho (menos de 50 mil posts), 1–2 médias (50 mil a 500 mil), 0–1 ampla (mais de 500 mil). No fim da legenda, depois do CTA, ou no primeiro comentário. Nunca no meio de frase. Rodar o conjunto entre posts para não virar padrão de spam.
5. **Carrossel: 6–10 slides** para conteúdo de ensino ou lista (o bundle trabalha com até 10).
6. **Meta da semana em salvamentos e compartilhamentos**, que é o que o algoritmo de 2026 mais pesa (ver `references/algorithm-heuristics.md`).
7. **Toda peça passa por `ig-humanizer --mode audit` antes de ir para aprovação.**

## O que a marca mantém acima da skill

- **Regras de linguagem da marca são mais rígidas e prevalecem.** O `ig-humanizer` tolera cerca de 1 travessão a cada 100 palavras. Se a marca proíbe travessão, vale zero. O mesmo para emoji, vocabulário proibido e tom.
- **Perfil de voz:** não preencher nem usar `C:\Users\Pc\.claude\instagram-skills\references\voice-profile.md`. É um arquivo único, global, e misturaria as marcas do Cesar. Não rodar `ig-humanizer --mode profile` para gravar lá. Nesta equipe, o perfil de voz é o indicado na seção da marca abaixo. Ao chamar qualquer skill `ig-*`, carregar esses arquivos no lugar do voice-profile.
- **Fórmulas de gancho do bundle (IG1–IG10)** complementam o banco de ganchos da marca, quando existir. O ângulo editorial da marca vem primeiro; a fórmula é a forma.
- **Claims:** a regra da marca de número real/caso concreto continua valendo. A skill não autoriza inventar resultado para encaixar a fórmula "Number-First".

## Ordem de trabalho para uma peça de Instagram

1. Pesquisa (opcional): `ig-audience-insights` ou `ig-hook-extractor` em posts de referência.
2. Rascunho: `ig-caption-writer`, `ig-carousel-planner` ou `ig-repurposer`, já lendo os arquivos de marca desta equipe.
3. Hashtags: `ig-hashtag-strategist`.
4. Voz da marca: revisão pela skill/arquivo de voz da marca (seção abaixo).
5. Auditoria: `ig-humanizer --mode audit`.
6. Checklist final da marca. Se algo conflitar com a auditoria do bundle, vence a marca.
7. Aprovação humana. Publicação conforme a regra da seção abaixo.

## Publicação (Publora)

As skills do bundle oferecem publicar via Publora depois da aprovação. **Nenhuma chave da Publora está configurada**, então o bundle cai no modo manual (entrega o rascunho pronto para copiar). Publicação automática só com chave configurada **e** aprovação explícita da pessoa responsável pela marca naquela peça. A regra específica desta equipe está abaixo.

## Quem usa o quê nesta equipe

| Agente | Skills `ig-*` |
|---|---|
| Orchestrator | `ig-content-planner` para montar a semana antes de abrir tarefas |
| Marketing Research | `ig-audience-insights`, `ig-hook-extractor` |
| Ad Creative Designer | `ig-carousel-planner` (texto e arquitetura dos slides; o visual segue `brand_identity.md` e `platform_guidelines.md`) |
| Video Ad Specialist | Fórmulas de Reels IG9–IG10 de `references/hook-formulas.md` para o gancho dos primeiros segundos |
| Copywriter | `ig-caption-writer`, `ig-repurposer`, `ig-hashtag-strategist`, `ig-humanizer` |
| Distribution | `ig-humanizer --mode audit` como checagem final da legenda no Publish MD; `ig-profile-optimizer` sob demanda |

## Regras da marca ViajaON

- **Perfil de voz:** skill `clone-luis-viajaon` (voz do Luís Fernando, dono da marca) + `brand_identity.md`. Ela substitui o voice-profile do bundle.
- **Travessão:** zero, regra do `clone-luis-viajaon`. Prevalece sobre a tolerância do `ig-humanizer`.
- **Claims:** sempre com número, programa nomeado ou caso concreto (Regra 5 do `copywriter-agent`). Dado de pesquisa em modo demo nunca entra em legenda.
- **Publicação:** nenhuma peça sai sem aprovação do Luís. O `distribution-agent` continua só gerando o Publish MD; Publora só com chave configurada e aprovação explícita do Luís para aquela peça.
