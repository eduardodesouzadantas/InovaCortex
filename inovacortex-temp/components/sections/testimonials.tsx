import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export function TestimonialsSection() {
    const testimonials = [
        {
            name: "Rafael Costa",
            role: "CTO, TechLogistics",
            content: "A plataforma desenvolvida pela InovaCortex mudou completamente nossa operação. Os agentes de IA integrados no nosso SaaS reduziram nossos tickets de suporte nível 1 a quase zero.",
            rating: 5,
        },
        {
            name: "Mariana Silva",
            role: "Diretora de Inovação, FinTech BR",
            content: "A agilidade da equipe é impressionante. Entregaram um sistema complexo com arquitetura Serverless em tempo recorde, e a estabilidade da aplicação é perfeita.",
            rating: 5,
        },
        {
            name: "Carlos Mendes",
            role: "CEO, GrowthSales",
            content: "A abordagem Agent-First não é só marketing. Nossas automações de prospecção agora falam com leads como se fossem humanos reais, qualificados pela IA deles.",
            rating: 5,
        }
    ];

    return (
        <section className="py-24">
            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                        O que dizem nossos clientes
                    </h2>
                    <p className="text-lg text-muted-foreground mx-auto max-w-2xl">
                        Acreditamos que resultados reais são a nossa melhor propaganda técnica.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-3">
                    {testimonials.map((test, i) => (
                        <Card key={i} variant="glass" className="bg-background/40 backdrop-blur-md">
                            <CardContent className="p-8">
                                <div className="flex mb-4">
                                    {[...Array(test.rating)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                                    ))}
                                </div>
                                <p className="text-base text-muted-foreground italic mb-6 leading-relaxed">
                                    "{test.content}"
                                </p>
                                <div className="mt-auto">
                                    <div className="font-semibold text-foreground">{test.name}</div>
                                    <div className="text-sm text-primary">{test.role}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
