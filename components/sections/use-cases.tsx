import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopySlash, Play, Zap, Network } from "lucide-react";

export function UseCasesSection() {
    return (
        <section className="py-24 bg-muted/20">
            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-5xl mb-6">
                        Infraestrutura de Decisão <span className="text-gradient">Operacional</span>
                    </h2>
                    <p className="text-xl font-medium text-foreground mx-auto max-w-3xl mb-4">
                        Automação executa tarefas. Inteligência operacional coordena sistemas.
                    </p>
                    <p className="text-lg text-muted-foreground mx-auto max-w-3xl">
                        Projetamos arquiteturas corporativas robustas. Seus processos deixam de depender apenas de pessoas e passam a operar como sistemas coordenados.
                    </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto mb-16">
                    <Card className="bg-background/50 backdrop-blur-sm border-border/50 text-center py-6">
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <Play className="h-8 w-8 text-primary mb-4" />
                            <h3 className="font-semibold text-lg">Executam processos</h3>
                        </CardContent>
                    </Card>
                    <Card className="bg-background/50 backdrop-blur-sm border-border/50 text-center py-6">
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <CopySlash className="h-8 w-8 text-accent mb-4" />
                            <h3 className="font-semibold text-lg">Monitoram exceções</h3>
                        </CardContent>
                    </Card>
                    <Card className="bg-background/50 backdrop-blur-sm border-border/50 text-center py-6">
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <Zap className="h-8 w-8 text-primary mb-4" />
                            <h3 className="font-semibold text-lg">Aprendem com dados</h3>
                        </CardContent>
                    </Card>
                    <Card className="bg-background/50 backdrop-blur-sm border-border/50 text-center py-6">
                        <CardContent className="flex flex-col items-center justify-center p-4">
                            <Network className="h-8 w-8 text-accent mb-4" />
                            <h3 className="font-semibold text-lg">Reportam métricas</h3>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    );
}
