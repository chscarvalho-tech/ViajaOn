# **📦 Product & Campaign Knowledge: ViajaON**

**Propósito:** Este documento fornece ao Video Agent e Image Agent todos os detalhes de produto, selling points, referências de visual assets e direção criativa de campanha necessários para geração de ads e conteúdo.

---

## **1. Visão Geral do Produto**

| Atributo | Detalhes |
| ----- | ----- |
| **Nome do Produto** | ViajaON — Concierge de Viagens (gestão de milhas e pontos) |
| **Formato** | Serviço de concierge: diagnóstico, otimização de resgate e montagem de roteiro completo |
| **Público-Alvo** | Executivos e donos de empresa de alta renda, viagens internacionais recorrentes (3+/ano) |
| **Posicionamento** | Agência que compete por resultado em cima de um ativo que o cliente já tem (milhas/pontos), não por preço de pacote fechado |

---

## **2. Produto e Método — Serviço ROTA**

*Estes são os core product truths. Todo conteúdo gerado deve ser fundamentado em pelo menos um destes.*

O Método ROTA organiza o processo comercial e operacional da ViajaON em quatro etapas — é o argumento central da apresentação comercial e a estrutura que justifica o valor cobrado frente a uma agência de pacote fechado.

| Etapa | Nome | Descrição |
| ----- | ----- | ----- |
| **R** | Reconhecimento | Mapeamento completo do perfil de milhas do cliente: cartões ativos, programas de fidelidade, saldo disponível em cada um, parcerias bancárias já contratadas e histórico de viagens. Revela quanto valor já está parado e sem uso. |
| **O** | Otimização | Estratégia de resgate desenhada em cima do diagnóstico: transferências bonificadas, combinação entre programas, emissão via parceiros quando o saldo não é suficiente sozinho. Define o preço final da viagem. |
| **T** | Trajetória | Roteiro completo montado — voos, hotéis, cruzeiros, locação de carro — sem o cliente negociar com nenhum fornecedor diretamente. Toda decisão de padrão é validada com o cliente antes da emissão. |
| **A** | Acompanhamento | Suporte durante a viagem para qualquer imprevisto (remarcação, cancelamento, alteração de voo) e reavaliação do perfil de milhas ao final, já preparando a próxima viagem. |

**Dica de escrita para agents:** Lidere com a prova e o número, não com a feature.

* ✅ "Cliente economizou 70% numa passagem executiva usando pontos que já tinha e não sabia."
* ❌ "Nosso serviço foi desenvolvido para maximizar sua experiência de viagem."

---

## **3. Key Selling Points**

*Use estes como hooks emocionais e funcionais em ad copy, voiceovers e visual storytelling.*

| Selling Point | Ângulo |
| ----- | ----- |
| **Ativo parado vira viagem** | Milha/ponto que já é do cliente e ele não sabe usar — não é economia nova, é resgate do que já é dele |
| **Redução de até 70%** | Comparado ao preço de balcão, sempre ancorado em caso real |
| **Autoridade técnica comprovada** | Palestra ministrada para carteira de clientes do Sicredi sobre acúmulo de milhas |
| **Sem exigir saldo prévio** | Emissão viabilizada via parceiros/terceiros quando o cliente não tem milhas suficientes sozinho |
| **Zero fricção operacional** | Cliente não negocia com companhia aérea, hotel ou locadora — tudo validado com uma pessoa de confiança |

**Ordem de prioridade para campanhas:**

1. Prova com número real (até 70% de redução, caso Sicredi)
2. Ativo parado vs ativo aproveitado (pontos vencendo sem uso vs viagem paga)
3. Autoridade técnica (regras de programa, parcerias bonificadas, janelas de transferência)
4. Resultado sem exigir conhecimento prévio do cliente (a ViajaON resolve do zero ao embarque)

---

## **4. Visual Assets**

### **Assets Reais Disponíveis** (em `Equipe ViajaOn/Assets/`)

| Filename | Descrição | Melhor Uso |
| ----- | ----- | ----- |
| `viajaon_logo.png` | Logo ViajaON — wordmark com globo estilizado no "O" central. **⚠️ Fundo branco opaco embutido no arquivo, não é transparente** — só usar sobre fundo branco sólido | End cards, watermarks, avatar de rede social, qualquer peça com fundo branco |
| `viajaon_logo_transparent.png` | **(Novo, 12/08/2026)** Mesmo logo com o fundo removido de verdade | Usar como padrão sempre que o logo for sobre foto ou fundo colorido — substitui `viajaon_logo.png` nesses casos |
| `viajaon_logo_normal.pdf` | Logo em alta resolução, versão vetorial/impressão | Material impresso, assinatura de e-mail |
| `viajaon_cores_logo.jpeg` | Referência visual da paleta oficial extraída do logo | Conferência de cor antes de aprovar peça |
| `luis_porta_voz_sem_fundo.png` | **(Novo, 12/08/2026)** Foto do Luís (blazer cinza), fundo removido via IA local (`@imgly/background-removal-node`) | Peças formato "porta-voz"/consultor pessoal — ex: "fala direto com quem organiza suas milhas" |

### **Assets Pendentes de Produção**

⚠️ Fotos de clientes reais em viagens já realizadas (com autorização de uso) ainda não existem no acervo — a foto do Luís acima é a primeira foto real de pessoa disponível, mas é da equipe, não de cliente. Antes de produzir campanhas com foto de cliente (ver Direção de Arte em `brand_identity.md`), solicitar ao Luís:

* Fotos de clientes reais em viagens já realizadas (com autorização de uso)
* Screenshots reais de resgates/transferências bonificadas (para peças de prova, equivalente ao "screenshot de workflow" do modelo anterior)
* Depoimento ou caso documentado do episódio Sicredi, se disponível em vídeo ou texto

**Nota (12/08/2026):** na prática, os posts reais da ViajaON usam fotografia de banco de imagem de destinos (Torre Eiffel, praias, etc.), não só tipografia/ícones — ver addendum em `brand_identity.md` sobre o conflito entre este documento e o Reels real. Até a marca decidir formalmente qual direção seguir, campanhas de performance (Stories, Reels, carrossel) usaram foto de banco de imagem com moderação; peças mais institucionais podem seguir a regra original de "só tipografia + paleta + ícones" quando fizer sentido.

---

## **5. Video Production Constraints (Remotion)**

*Todos os video ads são gerados programaticamente usando **Remotion**. O Video Agent deve trabalhar dentro destas hard constraints:*

| Constraint | Regra |
| ----- | ----- |
| **Rendering engine** | React components + SVG only |
| **Sem video footage genérico** | Sem `.mp4` de stock/live-action — só material real autorizado do cliente, quando disponível |
| **Sem CSS animations externas** | Toda animação via `useCurrentFrame()` + `interpolate()` |
| **Imagens** | Permitidas via `staticFile()` — usar com parcimônia como accent ou background layers |
| **Tipografia** | Load fonts via `@remotion/google-fonts`: Fraunces (display), Inter (body) |
| **Áudio** | Voiceover ou música opcional via component `<Audio>` do Remotion |
| **Composition sizes** | 1080×1350 (feed 4:5), 1080×1920 (Story/Reel) ou 1920×1080 (YouTube) — match com plataforma alvo |

---

## **6. Motion Style: Editorial Premium (Brand Adapted)**

*Todos os video ads seguem um **estilo editorial premium e discreto**, adaptado à identidade visual da ViajaON. Composições tipográficas elegantes, transições suaves, atmosfera de concierge de alto padrão — fundamentado em resultado, discrição e autoridade técnica.*

### **Core Style Principles**

| Elemento | Direção |
| ----- | ----- |
| **Estilo de ilustração** | Tipografia como protagonista; SVG shapes mínimas (globo, avião, mala); sem ilustrações cartoon |
| **Paleta de cores** | Verde-água, laranja, branco, cinza-chumbo (ver tabela abaixo) |
| **Personagens** | Evitar personagens ilustrados — priorizar foto real de cliente quando disponível |
| **Animation feel** | Smooth ease-in-out; texto aparece word-by-word com spring sutil; nunca abrupto |
| **Transições** | Fade, slide ou wipe — nunca hard cuts entre scenes |
| **Typography motion** | Texto anima per-word ou per-letter; nunca aparece estaticamente |
| **Pacing** | Cada scene beat é 2–4 segundos; total ad 15–30 segundos |

### **Brand Color Palette para Vídeo**

| Cor | Hex | Uso |
| ----- | ----- | ----- |
| Verde-água | `#189898` | Backgrounds de contraste, títulos, ícones principais |
| Laranja | `#FF943E` | Accent — CTA, número de economia. Máximo 20% da composição |
| Branco | `#FFFFFF` | Background dominante, mínimo 60% da composição |
| Cinza-chumbo | `#2B2B2B` | Texto corrido e informação de apoio |

---

## **7. Video Campaign Concepts**

*Cada conceito é um **Remotion scene brief** — estruturado para o Video Agent traduzir diretamente em React components e SVG compositions.*

---

### **Conceito 1 — "Milha Parada Não É Economia"**

**Logline:** A dor do ponto que vence sem virar viagem se resolve quando a ViajaON entra em cena. **Duração:** 20 segundos | **Formato:** 1080×1350 (Feed 4:5)

| Scene | Frames (@ 30fps) | Descrição |
| ----- | ----- | ----- |
| **Hook** | 0–60 | Background branco; texto Fraunces anima word-by-word: "Suas milhas estão vencendo." em cinza-chumbo |
| **A Dor** | 60–120 | Ícone SVG de calendário/relógio contando; cor dessaturada, tom frio |
| **A Virada** | 120–170 | Ícone congela; globo/avião SVG faz slide-in com spring "pop"; verde-água e laranja inundam a scene |
| **Prova** | 170–220 | Texto Inter anima sequencialmente: "ATÉ 70% MAIS BARATO · CLASSE EXECUTIVA" |
| **CTA** | 220–270 | Background verde-água; Fraunces italic anima: "Você já pagou por essa viagem." Logo fade in |

* **CTA sugerido:** `Você já pagou por essa viagem. Falta só ir.`
* **SVGs necessários:** ícone de calendário/relógio, globo estilizado, avião, accent dot, logo ViajaON

---

### **Conceito 2 — "70% Mais Barato"**

**Logline:** Fast-paced — comparação direta entre preço de balcão e preço via ViajaON. **Duração:** 15 segundos | **Formato:** 1080×1920 (Story/Reel)

| Scene | Frames (@ 30fps) | Descrição |
| ----- | ----- | ----- |
| **Preço cheio** | 0–45 | Valor de balcão em cinza-chumbo, riscado gradualmente |
| **Corte** | 45–75 | Linha diagonal risca o valor; novo valor aparece em laranja com spring bounce (redução de até 70%) |
| **Reveal** | 75–110 | Ícone de passagem/classe executiva faz slide-up; texto Inter: "MÉTODO ROTA · VIAJAON" |
| **CTA** | 110–150 | Fraunces bold anima word-by-word: "Sem precisar entender de milhas." |

* **CTA sugerido:** `Sem precisar entender de milhas.`
* **SVGs necessários:** ícone de passagem/boarding pass, linha diagonal de corte, avião, arrow

---

### **Conceito 3 — "Autoridade Técnica" (Explainer Style)**

**Logline:** Mini explainer editorial sobre como a ViajaON transforma pontos parados em viagem — apoiado no caso Sicredi como prova de autoridade. **Duração:** 30 segundos | **Formato:** 1080×1350 (Feed 4:5)

| Scene | Frames (@ 30fps) | Descrição |
| ----- | ----- | ----- |
| **Hook** | 0–40 | Texto Fraunces anima: "A maioria dos pontos vence sem virar viagem." Background branco, texto cinza-chumbo |
| **Método** | 40–140 | 4 labels Inter aparecem staggered com slide-in: RECONHECIMENTO · OTIMIZAÇÃO · TRAJETÓRIA · ACOMPANHAMENTO |
| **Prova** | 140–210 | Texto Inter: "Palestra ministrada para clientes do Sicredi sobre acúmulo de milhas." Número pulsa em laranja |
| **CTA** | 210–270 | Background verde-água; Fraunces italic: "Sua próxima viagem já está paga em milhas." Logo fade in |

* **CTA sugerido:** `Sua próxima viagem já está paga em milhas.`
* **SVGs necessários:** 4 ícones do Método ROTA, accent rule, logo ViajaON

---

## **8. Campaign Do's & Don'ts**

| ✅ Faça | ❌ Não Faça |
| ----- | ----- |
| Construa scenes de SVG shapes e React components | Use raw video footage genérico ou stock live-action |
| Use smooth spring/ease-in-out animation curves | Use linear animation — parece robótico |
| Anime toda tipografia — sem texto estático na tela | Solte texto sem motion de entrada |
| Mantenha cada scene beat em 2–4 segundos | Deixe scenes paradas — pacing é tudo |
| Use a paleta oficial estritamente (verde-água, laranja, branco, cinza-chumbo) | Introduza cores off-brand pra "variar" |
| Lidere com número real ou caso concreto antes de qualquer promessa | Abra com claim vago tipo "a melhor agência" |
| Termine todo vídeo com CTA animado em tom consultivo | Fade to black sem próximo passo claro |
| Use Fraunces pra headlines, Inter pro corpo | Misture typefaces ou use fontes genéricas |
| Tom direto e consultivo — discrição sobre luxo ostentado | Tom institucional vazio ou espetáculo de riqueza |

---

## **9. Estrutura de Persuasão para Ads**

*Baseado no tom de voz da ViajaON — use como template para qualquer ad copy ou voiceover:*

```
1. Hook → dor concreta (pontos vencendo, viagem adiada) ou prova com número
2. Validação técnica → como o programa de milhas realmente funciona
3. Apresentação do método → ROTA: Reconhecimento, Otimização, Trajetória, Acompanhamento
4. Prova com número → até 70% de redução, caso Sicredi
5. Diferenciadores → sem exigir saldo prévio, sem negociação com fornecedor, tudo validado com o cliente
6. CTA consultivo → convite direto para diagnóstico, nunca ordem ou urgência artificial
```

---

## **10. Agent Reference Summary**

| Agent | Seções-Chave a Referenciar |
| ----- | ----- |
| **Video Agent (Remotion)** | Production Constraints · Motion Style · Video Campaign Concepts · Do's & Don'ts |
| **Image Agent** | Visual Assets · Método ROTA · Brand Color Palette · Estrutura de Persuasão |
| **Copy Agent** | Key Selling Points · Estrutura de Persuasão · Voice & Tone (`brand_identity.md`) |
| **Brand Creatives Skill** | `brand_identity.md` · `platform_guidelines.md` |

---

---

## Addendum — 12/08/2026 · Pipeline de produção que funcionou de verdade

A campanha "Alinhamento de Milhas" (12/08/2026) tentou primeiro gerar os criativos via IA generativa do Canva (`generate-design`). **Resultado: não confiável** — texto embaralhado/duplicado, nomes de fonte vazando como texto visível na peça ("Fraunces Intra"), placeholders de template não substituídos ("reallygreatsite.com", datas em inglês), logo recolorido errado. Isso aconteceu de forma consistente em múltiplas tentativas, mesmo com prompts detalhados.

**O que funcionou, e deve ser o caminho padrão daqui pra frente** (também documentado em `Skills dos Agentes Detalhado.md`):

1. Gerar HTML/CSS determinístico (mesma lógica da skill Ad Creative Designer) com o texto, cores e logo exatos — zero dependência de IA generativa pra texto
2. Renderizar cada peça com **Chrome headless** (`chrome.exe --headless --screenshot=... --window-size=W,H`) — grátis, local, pixel-perfect, sem gerar texto errado
3. Montar o vídeo com **ffmpeg** (`xfade` entre cenas estáticas) — também local, sem custo
4. Remoção de fundo de foto de pessoa: pacote npm `@imgly/background-removal-node` roda 100% local (baixa um modelo ONNX na primeira execução), sem precisar de Python nem API paga

Essa combinação (HTML/CSS + Chrome headless + ffmpeg + imgly) reproduz exatamente o que `Skills dos Agentes Detalhado.md` descreve como abordagem ideal pra Ad Creative Designer/Video Ad Specialist, só que sem precisar montar o frontend React/Next.js descrito lá — um script Node + Chrome já resolve.

*Última atualização: Agosto 2026 · Mantido por: Luís · ViajaON*
