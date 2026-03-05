import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LineChart } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Mission Control e Dados | InovaCortex",
    description: "Visualização centralizada das métricas de toda operação baseada em agentes autônomos.",
};

export default function DashboardsPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-32 border-b border-border/40 overflow-hidden bg-muted/10 flex-1 flex flex-col justify-center items-center h-[80vh]">
                    <div className="absolute inset-0 z-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
                        <div className="mb-8 p-4 rounded-xl bg-primary/10 inline-flex">
                            <LineChart className="h-10 w-10 text-accent" />
                        </div>
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Observabilidade Corporativa Total
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8">
                            Dashboards Inteligentes & <span className="text-gradient">Mission Control</span>
                        </h1>

                        <div className="max-w-3xl mx-auto space-y-6 text-left">
                            <p className="text-xl text-muted-foreground leading-relaxed text-center mb-12">
                                Uma operação autônoma não pode ser uma caixa preta. Transformamos todos os logs, ações e insights da sua empresa em painéis executivos acionáveis e transparentes.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-12 bg-background/50 p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Mission Control Customizado
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Criamos interfaces administrativas internas para sua equipe monitorar tudo. O C-Level vê métricas de saúde gerais, enquanto a base operacional acessa painéis interativos de tarefas não-estruturadas.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Human-in-the-Loop
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Decisões de alto risco (movimentações financeiras, aprovações de crédito) feitas por inteligência artificial podem ser configuradas para pausar e solicitar validação humana em 1-clique via dashboard.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Visualização de "Artefatos"
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Artefatos são os motivos matemáticos pelos quais uma IA escolheu um caminho e não outro. Construímos a visualização para tornar processos "blackbox" 100% auditáveis e inteligíveis por humanos.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-accent" />
                                        Dados Tempo-Real
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Integração através de WebSockets e streaming de dados com bancos analíticos (Clickhouse, Snowflake) para dashboards que reagem a cada segundo sem travar o navegador.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <Link href="/contato" className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-sm font-medium text-accent-foreground shadow transition-colors hover:bg-accent/90">
                                Agendar Diagnóstico
                            </Link>
                            <Link href="/" className="inline-flex h-12 items-center justify-center rounded-md border border-border/50 bg-background/50 backdrop-blur-sm px-8 text-sm font-medium hover:bg-muted transition-colors">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar
                            </Link>
                        </div>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
