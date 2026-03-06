import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Brain, Code2, Cpu, Globe2, Lock, Scale, Shield, Users, Zap, ShieldCheck, Network } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Sobre",
    description: "Conheça a missão da InovaCortex: transformar a escala corporativa através de agentes de IA autônomos e seguros.",
};

export default function SobrePage() {
    const principles = [
        {
            icon: <Brain className="h-6 w-6 text-primary" />,
            title: "Agent-First (Agentes em 1º Lugar)",
            description: "Para cada problema complexo, projetamos um agente especialista antes de pensar em interfaces. Acreditamos que o software do futuro trabalha por você, não apenas para você."
        },
        {
            icon: <ShieldCheck className="h-6 w-6 text-primary" />,
            title: "Security by Design",
            description: "Proteção de dados não é uma feature, é o alicerce. Cada infraestrutura, LLM e pipeline de dados é arquitetado com os mais rigorosos padrões empresariais de conformidade."
        },
        {
            icon: <Zap className="h-6 w-6 text-primary" />,
            title: "Escala Desbloqueada",
            description: "Quebramos a relação entre crescimento e folha de pagamento. Nossas soluções permitem que empresas multipliquem suas operações 10x mantendo o mesmo tamanho de equipe."
        },
        {
            icon: <Network className="h-6 w-6 text-primary" />,
            title: "Ecossistema Integrado",
            description: "Não criamos ilhas de IA. Nossos workflows se conectam profundamente aos seus CRMs, ERPs e bancos de dados legados, orquestrando informações de ponta a ponta."
        }
    ];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-20 border-b border-border/40 overflow-hidden bg-muted/10">
                    <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl opacity-20" aria-hidden="true">
                        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-accent sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
                    </div>

                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10 text-center">
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            O Córtex
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                            Construindo a <span className="text-gradient">Força de Trabalho</span> do Futuro
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                            Nascemos de uma constatação simples: o software tradicional atingiu seu limite.
                            A InovaCortex existe para transicionar empresas da era do software passivo para a era da inteligência ativa.
                        </p>
                    </div>
                </section>
            </FadeIn>

            {/* Our Story / Manifesto */}
            <FadeIn delay={150}>
                <section className="py-24 relative">
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div className="relative aspect-square md:aspect-auto md:h-[600px] rounded-2xl overflow-hidden glass-panel border border-border/50 bg-background/50 flex flex-col justify-center items-center p-8 group">
                                {/* Abstract futuristic graphic */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 z-0" />
                                <div className="relative z-10 w-full h-full flex items-center justify-center">
                                    <div className="w-64 h-64 rounded-full border border-primary/20 animate-[spin_20s_linear_infinite] group-hover:border-primary/50 transition-colors duration-700 flex items-center justify-center">
                                        <div className="w-48 h-48 rounded-full border border-accent/20 animate-[spin_15s_linear_infinite_reverse] flex items-center justify-center">
                                            <div className="w-32 h-32 rounded-full border border-primary/30 animate-[pulse_4s_ease-in-out_infinite] bg-primary/5 flex items-center justify-center backdrop-blur-sm">
                                                <Brain className="w-12 h-12 text-primary/70" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h2 className="text-3xl font-bold mb-6">A Tese InovaCortex</h2>
                                <div className="space-y-6 text-muted-foreground text-lg leading-relaxed text-justify">
                                    <p>
                                        <strong className="text-foreground tracking-wide font-semibold text-xl">
                                            O software passivo está morrendo.
                                        </strong>
                                    </p>
                                    <p>
                                        Empresas continuarão usando ERPs, CRMs e sistemas legados.
                                        Mas acima deles surgirá uma nova camada:
                                    </p>
                                    <p className="text-2xl font-bold text-gradient py-2">
                                        Inteligência operacional coordenada.
                                    </p>
                                    <div className="space-y-2 text-foreground font-medium">
                                        <p>Agentes especializados trabalhando de forma integrada.</p>
                                        <p>Monitorados.</p>
                                        <p>Auditáveis.</p>
                                        <p>Governados.</p>
                                    </div>
                                    <p className="pt-4 border-t border-border/50">
                                        A InovaCortex projeta essa camada.
                                    </p>
                                    <p className="text-xl font-medium text-foreground">
                                        Somos uma boutique de engenharia aplicada à inteligência operacional.
                                    </p>
                                    <div className="mt-8 p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
                                        <ul className="space-y-2 text-red-100 font-medium">
                                            <li>Não vendemos automação.</li>
                                            <li>Não vendemos chatbots.</li>
                                            <li>Não implementamos ferramentas prontas.</li>
                                        </ul>
                                        <p className="mt-4 text-foreground font-bold">
                                            Arquitetamos sistemas autônomos coordenados.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </FadeIn>

            {/* Principles */}
            <FadeIn delay={150}>
                <section className="py-24 bg-muted/20 border-y border-border/50">
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossa Filosofia de Engenharia</h2>
                            <p className="text-muted-foreground text-lg">
                                Princípios inegociáveis que guiam cada linha de código que escrevemos
                                e cada agente que colocamos em produção.
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {principles.map((principle, idx) => (
                                <Card key={idx} className="bg-background/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors">
                                    <CardContent className="p-8">
                                        <div className="mb-6 p-4 rounded-xl bg-primary/10 inline-flex">
                                            {principle.icon}
                                        </div>
                                        <h3 className="text-xl font-bold mb-3">{principle.title}</h3>
                                        <p className="text-muted-foreground leading-relaxed">
                                            {principle.description}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>
            </FadeIn>

            {/* CTA */}
            <FadeIn delay={150}>
                <section className="py-32 relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">
                            Pronto para o futuro?
                        </h2>
                        <p className="text-xl text-muted-foreground mx-auto max-w-2xl mb-10">
                            Nossos especialistas estão prontos para analisar sua operação e mapear
                            oportunidades reais de implementação de IA. Sem compromisso, com transparência técnica.
                        </p>
                        <Link href="/contato" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                            Falar com Especialistas
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
