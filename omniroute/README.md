# OmniRoute: a IA do atendente virtual

O bot não fala direto com uma empresa de IA. Ele pede as respostas ao **OmniRoute**, um programa gratuito que roda no seu computador e distribui os pedidos entre provedores de IA com camada gratuita. Se um provedor estiver sobrecarregado, o bot tenta o próximo modelo da lista (`config/bot.json` → `modelo`).

O mesmo arranjo já roda nos projetos do Cesar.

## O que você precisa

- **Uma chave gratuita do Google Gemini.** Ela é o provedor principal do bot. Os provedores "sem conta" do OmniRoute (OpenCode, DuckDuckGo, Felo) não estão aceitando chamadas de programas como este, então não dá para depender só deles.
- Uns 15 minutos.

## Passo a passo

O Claude Code faz os comandos com você; o que exige o navegador está indicado.

1. **Instalar o OmniRoute**
   ```bash
   npm install -g omniroute
   ```
   Avisos amarelos de `npm warn` durante a instalação são normais.

2. **Iniciar o OmniRoute a partir da sua pasta de usuário**, nunca de dentro da pasta do bot. O OmniRoute lê o `.env` da pasta onde é iniciado: dentro da pasta do bot ele pegaria a porta do bot (3100) e os dois brigariam.
   ```powershell
   cd $HOME
   omniroute serve --no-open
   ```
   Ele fica em http://localhost:20128. Deixe esse terminal aberto (ou use o passo 6).

3. **Abrir o painel do OmniRoute** (navegador): http://localhost:20128. No primeiro acesso, crie a senha de administrador e guarde-a.

4. **Criar a chave do Gemini** (navegador): entre em https://aistudio.google.com/apikey com uma conta Google, clique em **Create API key** e copie a chave. O plano gratuito basta para começar.

5. **Conectar o Gemini ao OmniRoute**: no painel, **Providers** → **Google Gemini** → cole a chave → salve e teste.
   Pelo terminal, a alternativa é:
   ```bash
   omniroute setup --non-interactive --add-provider --provider gemini --api-key SUA_CHAVE --test-provider
   ```
   (Se o comando reclamar do id do provedor, liste os ids com `omniroute providers available`.)

6. **Testar** (na pasta do bot):
   ```bash
   node omniroute/testar.mjs
   ```
   Pelo menos um modelo `gemini/...` precisa aparecer com ✓. Depois disso o bot já responde: teste com `node cli.js testar "oi" t1` ou pelo Simulador do painel.

7. **Deixar ligado sem terminal aberto** (opcional, recomendado quando o bot for para o WhatsApp):
   ```powershell
   npm install -g pm2
   cd $HOME
   pm2 start "$(npm root -g)\omniroute\bin\omniroute.mjs" --name omniroute -- serve --no-open
   cd "<pasta do bot>"
   pm2 start server.js --name viajaon-sdr
   pm2 save
   ```
   Para religar tudo depois de reiniciar o Windows: `pm2 resurrect`. Para iniciar sozinho no boot, crie uma tarefa no Agendador de Tarefas que rode `pm2 resurrect` ao fazer logon.

## Configuração no bot

No `.env` do bot:

```
OMNIROUTE_URL=http://localhost:20128/v1
OMNIROUTE_API_KEY=            # vazio, a menos que você ative "exigir chave" no OmniRoute (Dashboard → Endpoints)
```

Em `config/bot.json`:

- `"provedor_ia": "omniroute"`
- `"modelo"`: lista em ordem de preferência. O bot tenta cada um até um responder:
  `gemini/gemini-3-flash-preview` → `gemini/gemini-3.5-flash` → `gemini/gemini-3.1-flash-lite` → `auto/best-free`

Para ver os modelos que o seu OmniRoute oferece: `curl http://localhost:20128/v1/models`.

## O que esperar da qualidade

Testado em 21/10/2026 com o Gemini gratuito:

- As decisões estão certas: qualificação, transferência para o Luís, desqualificação de fornecedor, preço sempre com o Luís, saída da lista.
- No texto, ele às vezes escapa do tom da marca com um elogio leve ("ótimo plano"), apesar das regras.
- Cada resposta leva de 5 a 30 segundos.

Se quiser o padrão de escrita mais alto, troque para o Claude: `"provedor_ia": "anthropic"`, `"modelo": "claude-opus-5-5"` e `ANTHROPIC_API_KEY` no `.env`. Isso é pago por uso.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `testar.mjs` diz "fora do ar" | Inicie o OmniRoute (passo 2) a partir da pasta de usuário |
| O painel do bot ou o OmniRoute não abre / porta ocupada | O OmniRoute foi iniciado dentro da pasta do bot. Feche-o e inicie de novo a partir de `$HOME` |
| Todos os modelos com ✗ "cooling down" ou 503 "high demand" | Limite gratuito do Gemini atingido ou sobrecarga momentânea. Espere alguns minutos; para mais folga, conecte uma segunda chave Gemini (outra conta Google) no OmniRoute |
| "OpenCode's free tier can only be used from within OpenCode" | Normal: o bot caiu num provedor sem conta. Garanta que o Gemini está conectado |
| 401/403 no `testar.mjs` | O OmniRoute está exigindo chave: copie em Dashboard → Endpoints para `OMNIROUTE_API_KEY` |
| Lead recebeu "Essa eu prefiro passar para o Luís..." sem motivo | Nenhum modelo respondeu naquele momento: o bot passou o lead para você em vez de deixá-lo sem resposta. Veja o evento `erro_ia` na ficha do lead |
