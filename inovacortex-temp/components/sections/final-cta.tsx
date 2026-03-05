import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function FinalCtaSection() {
    return (
        <section className="py-24 relative overflow-hidden">
            {/* Background gradients */}
            <div className="absolute inset-0 -z-10 bg-primary/5" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[400px] bg-accent/20 blur-[100px] rounded-full -z-10" />

            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                <div className="mx-auto max-w-4xl text-center flex flex-col items-center">
                    <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                        <Sparkles className="h-8 w-8" />
                    </div>

                    <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-6">
                        Pronto para escalar com <span className="text-gradient hover:animate-pulse">Inteligência Estratégica?</span>
                    </h2>

                    <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                        Pare de perder tempo com tarefas repetitivas e sistemas lentos.
                        Agende uma consultoria gratuita e descubra o impacto dos Agentes de IA no seu negócio.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <Button size="lg" variant="gradient" className="h-14 px-8 text-base shadow-xl shadow-primary/20" asChild>
                            <Link href="/contato">
                                Falar com um Especialista <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-8 text-base bg-background/50 backdrop-blur-sm" asChild>
                            <Link href="/cases">
                                Ver Casos de Sucesso
                            </Link>
                        </Button>
                    </div>

                    <p className="mt-8 text-sm text-muted-foreground">
                        Sem compromisso. Avaliamos a viabilidade técnica na primeira call.
                    </p>
                </div>
            </div>
        </section>
    );
}
