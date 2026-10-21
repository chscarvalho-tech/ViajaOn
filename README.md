# Atendente virtual da ViajaON no WhatsApp

Atende quem chama a ViajaON no WhatsApp: entende a viagem e o perfil de milhas da pessoa, responde dúvidas com base no Método ROTA e leva para a conversa de 30 minutos com o Luís ou para a cotação. Quando precisa de uma pessoa, passa o atendimento para o Luís e avisa no WhatsApp dele com o resumo do cliente.

Tem um painel no navegador para acompanhar tudo: clientes em cada etapa, conversas, quem está esperando atendimento e perguntas que o bot ainda não sabe responder.

## Como instalar

1. Instale o [Node.js](https://nodejs.org) (versão LTS) e o [VS Code](https://code.visualstudio.com) com a extensão do Claude Code.
2. No VS Code: `Ctrl+Shift+P` → **Git: Clone** → cole `https://github.com/chscarvalho-tech/ViajaOn` → escolha uma pasta e abra o projeto.
3. No Claude Code, escreva: **instalar o bot**.

O Claude conduz o resto passo a passo, incluindo a instalação do **OmniRoute** (a IA gratuita que escreve as respostas, ver `omniroute/README.md`), e vai pedir algumas informações: uma chave gratuita do Google Gemini, seu WhatsApp, o link da sua agenda, o horário de atendimento, entre outras.

## Documentação

- `CLAUDE.md`: roteiro de instalação e uso (o Claude Code lê sozinho)
- `omniroute/README.md`: instalar e configurar a IA (OmniRoute + Gemini)
- `docs/arquitetura.md`: como o bot funciona e todos os campos de configuração
- `docs/funil-e-qualificacao.md`: como pensar o funil e a qualificação
- `docs/wa-akg.md`: conexão com o WhatsApp
