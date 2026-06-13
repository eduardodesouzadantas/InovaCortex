# Runbook: Email Sync Falhando

## Diagnóstico

- Abra `/api/health` e verifique `subsystems.emailSync.status`.
- Consulte os logs com `operation=email_sync`, `operation=email_sync_runner` e o `requestId` mais recente.
- Verifique se a integração de email está `connected` e se `lastSyncStatus` está `failed`, `running` ou `skipped`.
- Confirme se o tenant tem `EmailIntegration` configurada para o provider esperado.

## Causa provável

- Credenciais OAuth expiradas ou revogadas.
- Provider sem configuração ativa.
- Sync já em execução ou travado em estado `running`.
- Falha de banco ou indisponibilidade temporária do provider.

## Ação

- Tente o refresh manual no admin de email apenas uma vez.
- Se o problema for de credencial, reconecte a integração.
- Se houver `running` preso, aguarde o limite de stale do runner e verifique novamente.
- Se for erro de provider, confirme as variáveis de ambiente e a configuração do provedor.

## Rollback

- Desative temporariamente o cron de email-sync se houver falha repetida.
- Marque a integração como desconectada se houver sinal claro de credencial inválida.
- Registre o `requestId`, `organizationId` e o `lastError` antes de qualquer alteração.
