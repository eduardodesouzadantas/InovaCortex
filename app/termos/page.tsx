import { ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Termos de Serviço | InovaCortex",
    description: "Termos e condições de uso dos serviços e site da InovaCortex.",
};

export default function TermosPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-24 border-b border-border/40 overflow-hidden bg-muted/10 min-h-screen">
                    <div className="container mx-auto px-4 relative z-10 max-w-3xl">
                        <Link href="/" className="inline-flex mb-8 items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar
                        </Link>

                        <div className="mb-8 inline-flex p-3 rounded-lg bg-primary/10">
                            <Scale className="h-6 w-6 text-primary" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-8">
                            Termos de Serviço
                        </h1>

                        <div className="space-y-6 text-muted-foreground leading-relaxed">
                            <p>
                                Ao acessar o site da InovaCortex, você concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis. Se você não concordar com algum destes termos, está proibido de usar ou acessar este site.
                            </p>

                            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">1. Uso de Licença</h2>
                            <p>
                                É concedida permissão para o download temporário de informações puramente institucionais para visualização transitória. Esta é uma concessão e não transferência de título. Não é permitido:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>Modificar ou copiar os materiais e arquiteturas descritas;</li>
                                <li>Tentar descompilar ou fazer engenharia reversa de qualquer software ou agente contido no site InovaCortex;</li>
                                <li>Remover quaisquer direitos autorais ou notações de propriedade intelectual.</li>
                            </ul>

                            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. Isenção de Responsabilidade</h2>
                            <p>
                                Os materiais no site da InovaCortex são fornecidos 'como estão'. InovaCortex não oferece garantias, expressas ou implícitas, e, por este meio, isenta e nega todas as outras garantias sobre a viabilidade de inteligência artificial em cenários não analisados previamente via diagnóstico corporativo oficial.
                            </p>

                            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. Contratos Enterprise</h2>
                            <p>
                                O desenvolvimento e implementação de infraestrutura de agentes (Mission Control, Artifacts, etc.) é regido por contratos de prestação de serviços (SLA) específicos assinados B2B, que se sobrepõem a estes termos institucionais informativos.
                            </p>

                            <p className="pt-8 text-sm">
                                Última atualização: Fevereiro de 2026.
                            </p>
                        </div>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
