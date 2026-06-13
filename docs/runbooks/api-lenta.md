# Runbook: API Lenta

## Diagnóstico

- Abra `/api/health` e verifique `metrics.summary.averageResponseMs` e os roteamentos mais acionados.
- Consulte os logs estruturados com `route`, `method`, `requestId` e `latencyMs`.
- Verifique se os erros estão concentrados em uma rota específica.
- Confira o status de `db` e `engines` no health.

## Causa provável

- Banco com latência alta ou conexões degradadas.
- Rota específica com query pesada ou bloqueio.
- Dependência externa lenta.
- Volume inesperado em uma operação pública ou interna.

## Ação

- Identifique a rota com maior `averageResponseMs` e `errorCount`.
- Se o problema for DB, confirme conexão e saúde operacional antes de otimizar código.
- Se a lentidão for isolada, reduza o volume da operação ou desative o gatilho temporariamente.
- Para incidentes públicos, preserve `requestId` para rastreamento ponta a ponta.

## Rollback

- Desative a funcionalidade recém-alterada se a regressão estiver concentrada em uma rota nova.
- Reative a versão anterior do fluxo se houver rollout parcial.
- Se o problema for infra, reverte-se a mudança de app não resolve; acione operação de banco/infra primeiro.
