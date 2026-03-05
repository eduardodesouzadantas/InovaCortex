import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Bot, Database, ShieldCheck } from "lucide-react";

export function SolutionsSection() {
    const blocks = [
        {
            title: "Diagnóstico & Blueprint",
            description: "Mapeamento profundo de processos, riscos e gargalos operacionais.",
            delivery: "Documento técnico de arquitetura + plano de agentes.",
            icon: <Search className="h-6 w-6 text-primary" />,
        },
        {
            title: "Agentes Especializados",
            description: "Criamos agentes com função clara: Atendimento, Operações, Financeiro, Logística e Análise de Dados.",
            delivery: "Código versionado + definição de escopo + métricas iniciais.",
            icon: <Bot className="h-6 w-6 text-accent" />,
        },
        {
            title: "Integração Profunda",
            description: "Integração nativa com CRMs, ERPs, SAP, APIs internas e bancos de dados legados.",
            delivery: "Conectores documentados + fluxos auditáveis.",
            icon: <Database className="h-6 w-6 text-primary" />,
        },
        {
            title: "Mission Control",
            description: "Camada de monitoramento, governança, segurança e evolução contínua.",
            delivery: "Logs estruturados, dashboards, controle de acesso e aprovação em ações críticas.",
            icon: <ShieldCheck className="h-6 w-6 text-accent" />,
        },
    ];

    return (
        <section className="py-24 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-0 -z-10 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                    <div className="max-w-3xl">
                        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-6">
                            Arquitetura de Sistemas <span className="text-gradient">Autônomos</span>
                        </h2>
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                            A base do modelo InovaCortex. Projetamos e integramos infraestrutura de inteligência ponta a ponta.
                        </p>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    {blocks.map((block, idx) => (
                        <Card key={idx} className="group hover:border-primary/50 transition-colors bg-background/50 backdrop-blur-sm border-border/50 shadow-md">
                            <CardHeader className="pb-4">
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    {block.icon}
                                </div>
                                <CardTitle className="text-2xl">{block.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-8 text-lg text-muted-foreground leading-relaxed">
                                    {block.description}
                                </p>
                                <div className="p-5 rounded-lg bg-muted/40 border border-border/50 border-l-4 border-l-primary">
                                    <span className="block text-xs font-bold text-primary uppercase tracking-wider mb-2">Entrega</span>
                                    <span className="text-base font-medium text-foreground">{block.delivery}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
