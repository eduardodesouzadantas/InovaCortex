import { Card, CardContent } from "@/components/ui/card";
import { Brain, Network, Terminal, Activity, X } from "lucide-react";

export function AgentFirstSection() {
    return (
        <section className="py-24 bg-muted/30 border-y border-border/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-8 text-foreground leading-tight">
                            O software tradicional <br className="hidden md:block" />atingiu seu <span className="text-gradient">limite</span>.
                        </h2>

                        <div className="space-y-5 mb-10 text-lg text-muted-foreground">
                            <p className="flex items-center gap-4">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"><X className="h-4 w-4" /></span>
                                Scripts rígidos não escalam.
                            </p>
                            <p className="flex items-center gap-4">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"><X className="h-4 w-4" /></span>
                                Workflows estáticos quebram sob exceções.
                            </p>
                            <p className="flex items-center gap-4">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent"><X className="h-4 w-4" /></span>
                                Interfaces não tomam decisões.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-accent"></div>
                            <p className="text-xl font-medium text-foreground">
                                O mundo real é dinâmico, não estruturado e imprevisível.
                            </p>
                        </div>
                    </div>

                    <div>
                        <Card variant="glass" className="border-border/50 bg-background/50 shadow-2xl">
                            <CardContent className="p-8 md:p-10">
                                <h3 className="text-2xl font-bold mb-8">Empresas modernas precisam de sistemas que:</h3>
                                <ul className="space-y-6 mb-10">
                                    <li className="flex items-center gap-4 text-xl">
                                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                            <Brain className="h-6 w-6" />
                                        </div>
                                        <span className="font-medium">Raciocinem</span>
                                    </li>
                                    <li className="flex items-center gap-4 text-xl">
                                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                            <Network className="h-6 w-6" />
                                        </div>
                                        <span className="font-medium">Adaptem-se</span>
                                    </li>
                                    <li className="flex items-center gap-4 text-xl">
                                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                            <Terminal className="h-6 w-6" />
                                        </div>
                                        <span className="font-medium">Executem</span>
                                    </li>
                                    <li className="flex items-center gap-4 text-xl">
                                        <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                            <Activity className="h-6 w-6" />
                                        </div>
                                        <span className="font-medium">Reportem</span>
                                    </li>
                                </ul>

                                <div className="pt-6 border-t border-border/50">
                                    <p className="text-xl font-semibold text-gradient">
                                        A InovaCortex projeta essa nova camada operacional.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    );
}
