# Executive Surface Access

## Fluxo anterior

- O tenant ja tinha autenticacao JWT canonica em `/api/auth/login`.
- O front tinha login operacional em `/org/[slug]/admin/login`.
- Existia uma pagina executiva antiga em `/org/[slug]/admin/executive`, mas sem um caminho proprio e explicito de acesso.
- A API executiva de tenant ja existia, mas a superficie front ainda nao era um modo executivo canonicamente navegavel.

## Fluxo final adotado

- Login operacional: `/org/[slug]/admin/login`
- Login executivo: `/org/[slug]/executive/login`
- Superficie executiva protegida: `/org/[slug]/executive`

### Regras de acesso

- A sessao continua sendo a mesma sessao JWT tenant existente.
- Apenas perfis `admin` e `owner` entram no modo executivo.
- Perfis `closer` e `viewer` continuam autenticando normalmente, mas recebem resposta explicita de acesso negado para a superficie executiva.
- Sessao `agency` nunca entra na superficie executiva do tenant; o redirect canonico volta para `/agency`.
- Tenant mismatch redireciona para a superficie correta do tenant autenticado.

### Fonte de dados

- O dashboard executivo v1 usa apenas backend real:
  - `revenue-brain`
  - `leak-detector`
  - `action-engine`
  - `performance/stats-engine`
  - contagens reais de `Deal`, `Proposal`, `Activity`, `ActionQueue`, `ProfitLeak` e `SystemEvent`
  - war room executivo (receita aberta x risco aberto, momentum, estagio travado, temas imediatos)
- Quando o tenant ainda nao tem volume suficiente, a UI mostra estado vazio honesto em vez de dados simulados.

## Expansao prevista

Esta superficie ja deixa trilho pronto para:

- war room executivo
- revenue intelligence mais denso
- centro de alertas executivo
- comparativos temporais
- recomendacoes de IA

Sem criar auth paralela ou misturar navegacao executiva com o console operacional.
