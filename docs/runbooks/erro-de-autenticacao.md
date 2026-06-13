# Runbook: Erro de Autenticação

## Diagnóstico

- Verifique o status e a mensagem da resposta.
- Confirme se o usuário está logado na superfície correta.
- Em API pública, valide se o header `Authorization: Bearer <API_KEY>` está presente.
- Em webhooks ou integrações, confirme se os segredos e chaves ainda estão válidos.

## Causa provável

- Sessão expirada ou inexistente.
- API key revogada, ausente ou inválida.
- Tenant incorreto na URL ou no contexto autenticado.
- Permissão insuficiente para a ação solicitada.

## Ação

- Refaça o login ou recarregue a sessão do usuário.
- Em API pública, gere uma nova API key se a atual estiver revogada.
- Confirme se a chamada está sendo feita no tenant correto.
- Para integrações, valide headers e credenciais antes de repetir a operação.

## Rollback

- Revogue a chave ou a sessão apenas se houver evidência de uso indevido.
- Se o erro começou após mudança recente, reverta a alteração de auth da rota afetada.
- Registre `requestId`, `organizationId` e o código do erro antes da ação corretiva.
