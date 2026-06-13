# InovaCortex Roadmap Macro v2 — ROI-Driven Execution

**Versão:** 2.0  
**Data:** Março 2026  
**Foco:** Menos prompts macro, melhor sequência de execução, valor operacional prático antes de cosmética.

---

## Estratégia

A partir de uma **arquitetura produtiva consolidada** (Agency, Operator, CEO, CRM Workspace, Revenue Engine, Loss Recovery, Success Playbooks), o roadmap v2 reduz fragmentação e agrupa iniciativas em 3 fases coerentes:

1. **Fase 1 — Valor Operacional e Executivo Imediato** (T0-T4 semanas)
   - Foco em loops de valor comunicáveis ao usuário final
   - Impacto direto em operação diária e decisão executiva
   - Menor risco de retrabalho arquitetural

2. **Fase 2 — Fechamento Comercial e Escala** (T4-T12 semanas)
   - Aumenta vendabilidade e velocidade de onboarding
   - Completa fluxos de negócio críticos
   - Prepara para escala sem deficiências operacionais

3. **Fase 3 — Plataforma Premium** (T12+ semanas)
   - Diferenciação e ecossistema aberto
   - Reduz limitações de integração e extensibilidade
   - Eleva percepção de produto enterprise

---

## Fase 1 — Valor Operacional e Executivo Imediato

### OPT-1 Unified Inbox

**Objetivo:**  
Centralizar todas as conversas, propostas, seguimentos e ações pendentes em uma única visualização, reduzindo o tempo de context-switching e aumentando a visibilidade sobre o que está vencendo.

**Escopo:**
- Visualização unificada de mensagens WhatsApp no CRM Workspace
- Fila de propostas enviadas sem resposta (com SLA visual)
- Action queue pendente mapeada por prioridade e dono
- Integração leve com email (se houver integração disponível)
- Notificação de SLA vencido

**Por que agora:**
- Reduz fricção operacional diária
- Aumenta confiança na plataforma como centro de verdade
- Base para automação de elegibilidade (v3)

**Dependências:** CRM Workspace já consolidado, WhatsApp Pipeline já conectado.

**Risco:** Média. Trata-se de agregação óptica, não lógica complexa.

**Tempo estimado:** 2 semanas.

---

### CEO-1 Strategic Growth Simulator

**Objetivo:**  
Permitir ao CEO modular cenários de crescimento (entrada adicional de propostas, aumento de conversion %, redução de ciclo) e ver impacto projetado em receita de 90/180/365 dias.

**Escopo:**
- Simulador interativo com 3-4 levers principais
- Projeção de receita fechada sob diferentes cenários
- Comparação lado-a-lado com histórico real
- Exportação de cenário para comunicação com time
- Integração com dados reais do Revenue Engine

**Por que agora:**
- Aumenta percepção de produto premium e estratégico
- Suporta narrativa de planning executivo
- Baixa complexidade técnica (cálculo determinístico)

**Dependências:** Revenue Engine v2, KPI Engine já consolidado.

**Risco:** Baixa. Cálculos simples, sem transações ou mudanças de estado.

**Tempo estimado:** 1,5 semanas.

---

### CEO-2 Executive Pulse & Alerts

**Objetivo:**  
Consolidar alertas executivos críticos (propostas paradas, deals travados, vazamentos de receita iminentes, anomalias de momentum) em um dashboard de pulse de 20 segundos.

**Escopo:**
- Resumo visual de saúde operacional em 5-7 KPIs críticos
- Top 3 alertas que exigem ação hoje
- Trends das últimas 2 semanas em cada dimensão
- Integração com Loss Recovery, Revenue Intelligence, War Room
- Notificação via email diária ou sob demanda

**Por que agora:**
- Loop natural de CEO Growth Simulator — exécuta dados para planejar
- Reduz tempo de triagem de 20min para 2min
- Suporta narrativa de comando e visibilidade

**Dependências:** Loss Recovery v1, War Room v2, Revenue Intelligence já maduros.

**Risco:** Baixa. Agrega dados já modelados, não introduz complexidade nova.

**Tempo estimado:** 1 semana.

---

## Fase 2 — Fechamento Comercial e Escala

### CRM-1 Interactive Client Proposal View

**Objetivo:**  
Permitir que o gestor comercial envie um link para o cliente ver proposta interativamente (não apenas PDF), com visualização de termos, timeline, pricing e assinatura eletrônica integrada.

**Escopo:**
- Página web responsiva para proposta enviada (token-autenticada)
- Visualização clara de itemization, prazos, condições de pagamento
- Campo de assinatura eletrônica (via DocuSign ou similar)
- Integração de feedback: "cliente visualizou em X", "cliente assinou em Y"
- Auto-trigger de ação na CRM quando assinada

**Por que agora:**
- Aumenta taxa de assinatura (reduz fricção de PDF + reply)
- Fornece feedback de engajamento (_opened at_, _signed at_)
- Diferencia em pitch de vendas (feature visível, premium)

**Dependências:** Proposal Workspace já consolidado, CRM schema já maduro.

**Risco:** Média. Exige integração com serviço de assinatura e webhook de retorno.

**Tempo estimado:** 2 semanas.

---

### CRM-2 Contract Execution Layer

**Objetivo:**  
Agregar templates de contrato parametrizados, gerar versões baseadas em tipo de cliente, e integrar assinatura eletrônica pós-proposta.

**Escopo:**
- Biblioteca de templates personalizáveis por segmento
- Auto-população com dados do cliente e proposta
- Rastreamento de versões e assinantes
- Integração com CRM-1 ou fluxo pós-proposta assinada
- Audit trail de quem assinou quando

**Por que agora:**
- Reduz overhead legal e administrativo pré-onboarding
- Suporta crescimento sem inflar overhead operacional
- Parte natural de "proposta à ativação"

**Dependências:** CRM-1, Proposal Workspace, esquema de cliente consolidado.

**Risco:** Média-Alta. Exige cuidado legal e integração com sistema de assinatura.

**Tempo estimado:** 2,5 semanas.

---

### AGC-1 Scalable Provisioning Flow

**Objetivo:**  
Automatizar o fluxo de criação de workspace para novo cliente (ou tenant para nova campaign) via workflow pré-definido, reduzindo tempo de go-live de 3 dias para 4 horas.

**Escopo:**
- Checklist automático pré-onboarding (permissões, dados básicos, integrações)
- Criação automatizada de workspace, roles, inicial data sync
- Validação de readiness com passo a passo para operação
- Dashboard de onboarding em tempo real
- Auto-trigger de playbook de ramp-up post go-live

**Por que agora:**
- Remove maior gargalo de escala (onboarding manual)
- Suporta narrativa de "go-live em horas, não dias"
- Reduz overhead de operação interna

**Dependências:** CRM-2, Workspace architecture já estável, Playbook execution já maduro.

**Risco:** Alta. Exige orquestração complexa e testes exaustivos.

**Tempo estimado:** 3 semanas.

---

## Fase 3 — Plataforma Premium

### PLT-1 Webhooks & Public API v1

**Objetivo:**  
Expor API pública estável para integração por terceiros (consultores, agências parceiras, ferramentas de BI), habilitando extensão do produto sem refatoração.

**Escopo:**
- REST API com autenticação OAuth2
- Endpoints críticos: assessments, proposals, activities, revenue signals, war room snapshot
- Rate limiting e quotas por plano
- Documentação OpenAPI
- Webhooks para eventos principais (proposal_sent, deal_closed, risk_alert)
- Sandbox environment

**Por que agora:**
- Abre ecossistema de integrações
- Reduz blocker "software customizado"
- Base para marketplace eventualmente

**Dependências:** Todas as anteriores consolidadas, schema público congelado.

**Risco:** Média. Exige versionamento cuidadoso e política de breaking changes.

**Tempo estimado:** 3 semanas.

---

### PLT-2 Unified Audit Log

**Objetivo:**  
Centralizar logs de auditoria (quem, o quê, quando, por quê) para compliance, forensics e forensics operacional.

**Escopo:**
- Captura automática de mudanças em assessment, proposal, revenue signals, alerts
- Armazenamento imutável com assinatura
- Dashboard de auditoria searchable e filterable
- Integração com SIEM se necessário
- Retenção conforme política de compliance

**Por que agora:**
- Suporta narrativa de "enterprise-ready"
- Reduz fricção em vendas para grandes clientes/setor regulado
- Base para AI de detecção de anomalias futura

**Dependências:** Schema estável, infraestrutura de logging já em lugar.

**Risco:** Baixa. Padrão bem conhecido, bloqueador mais quanto a storage e performance.

**Tempo estimado:** 1,5 semanas.

---

### UX-1 Micro-interaction Hardening

**Objetivo:**  
Revisar e refinir micro-interactions em CRM, CEO e Agency surfaces para reduzir tempo de tarefa, aumentar satisfação e profissionalizar polimento visual.

**Escopo:**
- Revisão de transições e animações (abertura de modais, carregamento)
- Aperfeiçoamento de feedback tátil (hover states, active states)
- Redução de jank e stutters em operações comuns
- Testes de acessibilidade (a11y) e keyboard navigation
- Performance de rendering em browsers antigos (suporte IE11 se necessário)

**Por que agora:**
- Aumenta percepção de product quality
- Prepara UX para venda e demos
- Risco baixo de retrabalho arquitetural

**Dependências:** Todas as anteriores, design system já consolidado.

**Risco:** Baixa. Trabalho de refinamento iterativo, não mudança estrutural.

**Tempo estimado:** 2 semanas.

---

## Roadmap Opcional (Nice-to-Have)

Estas frentes adicionam valor mas podem ser adiadas se recursos forem escassos:

### OPT-2 Smart Follow-up Engine v3
- Auto-sugestão de follow-up baseado em inatividade
- Sequências de re-engagement para propostas paradas
- AI-driven subject lines e timing
- **Tempo:** 2 semanas, **Risco:** Média (ML/timing), **ROI:** Médio (impacto operacional).

### AGC-2 Bulk Control Center
- Interface para gerenciar n clientes simultaneamente
- Bulk actions (envio de mensagem, update de stage, escalação)
- Relatório de conformidade/health em massa
- **Tempo:** 1,5 semanas, **Risco:** Média (UX complexity), **ROI:** Médio (impacto operacional).

### UX-2 Theme Engine Consolidation
- Consolidar tema dark/light e esquemas corporativos em um sistema único
- Suporte a branding customizado por tenant
- **Tempo:** 1 semana, **Risco:** Baixa (CSS/config), **ROI:** Baixo (cosmética).

---

## Linha do Tempo

```
T0 (Início)
  ├─ Fase 1 (T0-T4)
  │  ├─ OPT-1: T0 + 2 semanas
  │  ├─ CEO-1: T1 + 1,5 semanas
  │  └─ CEO-2: T2 + 1 semana
  │
  ├─ Fase 2 (T4-T12)
  │  ├─ CRM-1: T4 + 2 semanas
  │  ├─ CRM-2: T6 + 2,5 semanas
  │  └─ AGC-1: T8 + 3 semanas
  │
  └─ Fase 3 (T12+)
     ├─ PLT-1: T12 + 3 semanas
     ├─ PLT-2: T12 + 1,5 semanas (paralelo)
     └─ UX-1: T13 + 2 semanas
```

**Total estimado:** 12-14 semanas de engenharia (com possibilidade de paralelismo em Fase 3).

---

## Critérios de Sucesso por Fase

### Fase 1
- ✅ Unified Inbox reduz tempo de triagem executiva de 15min para 3min
- ✅ Growth Simulator testado com 3+ cenários reais e comunicável
- ✅ Executive Pulse alertas entregues antes de 8:30 toda manhã

### Fase 2
- ✅ Taxa de proposta assinada eletronicamente > 80%
- ✅ Onboarding de novo customer concluído em 4 horas
- ✅ Tempo de go-live reduzido em 75%

### Fase 3
- ✅ 3+ integrações de terceiros usando Public API
- ✅ Compliance audit executado com sucesso
- ✅ Feedback de UX polimento incorporado (NPS improvement 5-8 pontos)

---

## Princípios de Execução

1. **Menor refatoração arquitetural:** Todas as frentes usam componentes já consolidados.
2. **Valor vendável por fase:** Cada fase tem narrativa clara ao cliente.
3. **Teste real antes de fechamento:** Validar com 1-3 customers antes de marcar "Done".
4. **Priorizar operação sobre cosmética:** Inbox antes de theme, Growth Simulator antes de animations.
5. **Reduzir fragmentação em prompts:** Agrupa OPT-1, CEO-1, CEO-2 em um único "macro prompt de valor executivo".

---

## Próximos Passos

1. Validar sequência com stakeholders (product, sales, ops)
2. Identificar parallelismos e dependências críticas
3. Alocar recursos e definir DRI por frente
4. Abrir prompts macro para Fase 1 (OPT-1, CEO-1, CEO-2)
5. Revisar ao final de Fase 1 antes de avançar à Fase 2
