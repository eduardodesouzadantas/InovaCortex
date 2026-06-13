# Runbook: Webhook Falhando

## Diagnóstico

- Abra `/api/health` e verifique `subsystems.webhooks.status`.
- Consulte os logs com `operation=webhook_emit` e `webhook_event_dispatched`.
- Verifique em `WebhookEndpoint` a última entrega, último status e último erro.
- Confirme se o endpoint está `isActive` e com eventos inscritos corretos.

## Causa provável

- URL de destino inválida ou indisponível.
- Segredo corrompido ou inexistente.
- Endpoint remoto retornando 4xx/5xx.
- Evento não inscrito no endpoint.

## Ação

- Confirme a URL cadastrada e se usa `https` em produção.
- Refaça a rotação do segredo se houver dúvida sobre integridade.
- Verifique se o evento em questão está inscrito no endpoint.
- Se a falha for transitória, aguarde a próxima tentativa automática.

## Rollback

- Desative o endpoint afetado para parar novas tentativas.
- Remova o endpoint se ele estiver apontando para um destino incorreto.
- Se o problema estiver no integrador, avise o cliente com o `eventId` e o `requestId`.
