# ViajaOn

Repositório com dois projetos independentes para a ViajaON (agência de concierge de milhas e
pontos), cada um com seu próprio README detalhado:

## [`whatsapp-bot/`](./whatsapp-bot)

Automação de prospecção (LinkedIn + WhatsApp) e bot de suporte, adaptado de um projeto
equivalente feito para outro cliente (Xamã Studio) — todo o conteúdo (scripts de abordagem,
base de objeções, fluxo de conversão) foi reescrito do zero para o Método ROTA e o público da
ViajaON. Código Node.js real, testado localmente.

## [`equipe-marketing/`](./equipe-marketing)

Pipeline de automação de conteúdo (research → ad creative → video → copy → distribution),
empacotado como plugin de skills do Claude Code. Substitui uma pasta que continha só
documentação/especificação (sem código funcionando) por uma implementação local real —
testada nesta máquina, sem depender de infraestrutura paga pra rodar.

---

Cada pasta tem seu próprio `README.md` com instalação, uso e a lista do que falta pra
produção — comece por lá.
