"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Calendar, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";
import { FadeIn } from "@/components/fade-in";

export default function ContatoPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            {/* Header */}
            <FadeIn delay={0}>
                <section className="relative pt-32 pb-16 border-b border-border/40 overflow-hidden bg-muted/10">
                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10">
                        <div className="max-w-3xl">
                            <Badge variant="outline" className="mb-6 font-normal border-primary/30 bg-primary/5 text-primary">
                                Atendimento Premium
                            </Badge>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                                Fale com um <span className="text-gradient">Especialista</span>
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed">
                                Vamos mapear os gargalos da sua operação e desenhar uma arquitetura
                                Agent-First sob medida. Sem compromisso, foco total em resolução.
                            </p>
                        </div>
                    </div>
                </section>
            </FadeIn>

            <FadeIn delay={150}>
                <section className="py-20 relative">
                    <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />

                    <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10">
                        <div className="flex flex-col lg:flex-row gap-16">

                            {/* Contact Form */}
                            <div className="lg:w-3/5">
                                <Card className="border-border/50 bg-background/50 backdrop-blur-sm shadow-2xl">
                                    <CardContent className="p-8 md:p-12">
                                        <h2 className="text-2xl font-bold mb-8">Solicite uma Análise Técnica</h2>

                                        <form className="space-y-6" action="#" method="POST">
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                        Nome Completo
                                                    </label>
                                                    <input id="name" type="text" className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="João Silva" required />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                        E-mail Corporativo
                                                    </label>
                                                    <input id="email" type="email" className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="joao@suaempresa.com.br" required />
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label htmlFor="company" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                        Empresa
                                                    </label>
                                                    <input id="company" type="text" className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Sua Empresa" required />
                                                </div>
                                                <div className="space-y-2">
                                                    <label htmlFor="role" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                        Cargo
                                                    </label>
                                                    <select id="role" defaultValue="" className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" required>
                                                        <option value="" disabled>Selecione seu cargo...</option>
                                                        <option value="ceo">C-Level / Proprietário</option>
                                                        <option value="diretor">Diretor / Head</option>
                                                        <option value="gerente">Gerente / Coordenador</option>
                                                        <option value="especialista">Especialista / Analista</option>
                                                        <option value="outro">Outro</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label htmlFor="message" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                    Qual é o seu principal gargalo hoje?
                                                </label>
                                                <textarea id="message" className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y" placeholder="Conte-nos brevemente o problema que está tentando resolver..." required></textarea>
                                            </div>

                                            <div className="pt-4">
                                                <Button type="button" size="lg" className="w-full md:w-auto h-12 px-8 text-base">
                                                    Enviar Solicitação
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-6">
                                                <ShieldCheck className="h-4 w-4 text-green-500" />
                                                Seus dados estão protegidos. Não enviamos spam.
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Direct Contact Info */}
                            <div className="lg:w-2/5 space-y-8">
                                <div>
                                    <h3 className="text-xl font-bold mb-4">Outras formas de contato</h3>
                                    <p className="text-muted-foreground mb-8">
                                        Prefere uma abordagem mais direta? Sinta-se à vontade para nos chamar em nossos canais oficiais.
                                    </p>
                                </div>

                                <Card className="border-border/50 bg-background hover:border-primary/50 transition-colors">
                                    <CardContent className="p-6 flex items-start gap-4">
                                        <div className="p-3 rounded-full bg-primary/10 text-primary shrink-0">
                                            <Mail className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-lg mb-1">E-mail</h4>
                                            <p className="text-muted-foreground mb-2 text-sm">Para propostas, parcerias e dúvidas gerais.</p>
                                            <a href="mailto:eduardo@inovacortex.com" className="text-primary font-medium hover:underline">eduardo@inovacortex.com</a>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-border/50 bg-background hover:border-primary/50 transition-colors">
                                    <CardContent className="p-6 flex items-start gap-4">
                                        <div className="p-3 rounded-full bg-green-500/10 text-green-500 shrink-0">
                                            <MessageSquare className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-lg mb-1">WhatsApp Business</h4>
                                            <p className="text-muted-foreground mb-2 text-sm">Para contato ágil e suporte rápido.</p>
                                            <a href="https://wa.me/5511967011133" target="_blank" rel="noopener noreferrer" className="text-green-500 font-medium hover:underline">+55 11 96701-1133</a>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20 mt-8">
                                    <Calendar className="h-8 w-8 text-primary mb-4" />
                                    <h4 className="text-xl font-bold mb-2">Discovery Call Direta</h4>
                                    <p className="text-muted-foreground mb-6 text-sm">
                                        Pule a fila e abra nossa agenda para marcar um papo de 30 minutos com um engenheiro.
                                    </p>
                                    <Button variant="outline" className="w-full bg-background border-primary/20 hover:bg-primary/5">
                                        Agendar no Calendly
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </div>
                </section>
            </FadeIn>
        </div>
    );
}
