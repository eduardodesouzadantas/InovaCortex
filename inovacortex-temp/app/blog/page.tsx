"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/fade-in";

export default function BlogPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-32 border-b border-border/40 overflow-hidden bg-muted/10 flex-1 flex flex-col justify-center items-center h-[80vh]">
                    <div className="absolute inset-0 z-0 bg-primary/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full opacity-50 pointer-events-none" />

                    <div className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center">
                        <div className="mb-8 p-4 rounded-xl bg-primary/10 inline-flex">
                            <BookOpen className="h-10 w-10 text-primary" />
                        </div>
                        <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                            Insights Técnicos
                        </Badge>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                            Notas de <span className="text-gradient">Engenharia</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
                            Estudos aprofundados sobre adoção de agentes de IA, arquiteturas Serverless e modernização de infraestrutura legada.
                            <br /><br />
                            <span className="font-semibold text-foreground">A primeira edição está sendo revisada.</span>
                        </p>

                        <div className="max-w-md w-full mx-auto mb-10 p-6 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Entre para a lista de espera
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Seja notificado assim que o primeiro estudo de caso técnico for publicado. Zero spam.
                            </p>
                            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); alert("Obrigado pelo interesse! Seu email foi salvo na lista."); }}>
                                <input
                                    type="email"
                                    placeholder="Seu melhor e-mail corporativo"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                                    required
                                />
                                <button type="submit" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                                    Inscrever
                                </button>
                            </form>
                        </div>

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
