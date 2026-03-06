import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Database } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Desenvolvimento SaaS | InovaCortex",
    description: "Sistemas escaláveis projetados para operar em escala absurda.",
};

export default function SaasPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-32 border-b border-border/40 overflow-hidden bg-muted/10 flex-1 flex flex-col justify-center items-center h-[80vh]">
                    <div className="absolute inset-0 z-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
                        <div className="mb-8 p-4 rounded-xl bg-primary/10 inline-flex">
                            <Database className="h-10 w-10 text-primary" />
                        </div>
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Engenharia de Software Nativa
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-8">
                            Arquitetura de Sistemas <span className="text-gradient">SaaS</span>
                        </h1>

                        <div className="max-w-3xl mx-auto space-y-6 text-left">
                            <p className="text-xl text-muted-foreground leading-relaxed text-center mb-12">
                                Construímos sistemas projetados para operar em escala extrema. De ERPs internos a aplicações B2B completas voltadas ao mercado.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mt-12 bg-background/50 p-8 rounded-2xl border border-border/50 backdrop-blur-sm">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Next-Gen Stack
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Nossos sistemas são construídos utilizando o estado da arte do ecossistema React, Next.js, Node.js e bancos de dados gerenciados, garantindo performance excepcional e renderização server-side otimizada.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Arquitetura Serverless
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Criamos soluções que escalam de 10 a 10 milhões de usuários sem intervenção técnica. A infraestrutura serverless garante que você pague apenas pelo computacional que seus clientes consumirem.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Inteligência Embutida
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Todo SaaS criado pela InovaCortex nasce "AI-Ready". Desde o banco de dados vetorial para busca semântica até a integração fluida com modelos Generativos para impulsionar as features do seu produto.
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                        Segurança Enterprise
                                    </h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        Implementações com autenticação robusta (SSO, 2FA), criptografia at-rest e in-transit, além de proteção nativa contra DDoS. Uma arquitetura pronta para auditorias de conformidade globais.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex gap-4">
                            <Link href="/contato" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
                                Iniciar Projeto SaaS
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
