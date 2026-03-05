import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Carreiras | InovaCortex",
    description: "Junte-se à InovaCortex e ajude a construir o Córtex corporativo do futuro.",
};

export default function CarreirasPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-32 border-b border-border/40 overflow-hidden bg-muted/10 flex-1 flex flex-col justify-center items-center h-[80vh]">
                    <div className="absolute inset-0 z-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
                        <div className="mb-8 p-4 rounded-xl bg-primary/10 inline-flex">
                            <Users className="h-10 w-10 text-primary" />
                        </div>
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Faça Parte do Córtex
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                            Carreiras na <span className="text-gradient">InovaCortex</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
                            Buscamos engenheiros de software, especialistas em IA e arquitetos de dados que queiram redefinir o limite do que é possível automatizar.
                            <br /><br />
                            <span className="font-semibold text-foreground">Vagas serão publicadas em breve.</span>
                        </p>

                        <Link href="/" className="inline-flex h-12 items-center justify-center rounded-md border border-border/50 bg-background/50 backdrop-blur-sm px-8 text-sm font-medium hover:bg-muted transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retornar à Início
                        </Link>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
