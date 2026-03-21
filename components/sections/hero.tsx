import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
    return (
        <section className="relative overflow-hidden pt-24 pb-32 lg:pt-36 lg:pb-40">
            {/* Background gradients for premium tech feel */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
            <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[100px] mix-blend-screen"></div>

            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                <div className="mx-auto max-w-4xl text-center">
                    <div className="mb-8 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                        Infraestrutura de Inteligência Operacional
                    </div>

                    <h1 className="mb-8 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-tight">
                        Infraestrutura de Inteligência para Empresas que <span className="text-gradient hover:animate-pulse">Operam em Escala</span>
                    </h1>

                    <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
                        Projetamos e orquestramos sistemas autônomos integrados aos seus processos críticos — combinando agentes especializados, governança e monitoramento contínuo.
                    </p>

                    <div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0 relative z-10 mb-6">
                        <Link href="/empresa/login" className="inline-flex h-14 items-center justify-center rounded-md bg-primary px-8 text-base font-bold text-primary-foreground shadow transition-colors hover:bg-primary/90 w-full sm:w-auto">
                            Entrar na Empresa
                        </Link>
                        <Link href="/avaliacao" className="inline-flex h-14 items-center justify-center rounded-md border border-border/50 bg-background/50 backdrop-blur-sm px-8 text-base font-medium hover:bg-muted transition-colors w-full sm:w-auto">
                            Fazer Avaliação Técnica (2 min)
                        </Link>
                    </div>

                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Acesse sua conta e siga direto para o sistema sem precisar entender a separação interna.
                    </p>
                </div>
            </div>
        </section>
    );
}
