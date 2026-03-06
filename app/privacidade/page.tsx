import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";
import { Metadata } from "next";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = {
    title: "Política de Privacidade | InovaCortex",
    description: "Compliance e proteção de dados na InovaCortex.",
};

export default function PrivacidadePage() {
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
                            <Shield className="h-6 w-6 text-primary" />
                        </div>

                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-8">
                            Política de Privacidade e Governança
                        </h1>

                        <div className="space-y-6 text-muted-foreground leading-relaxed">
                            <p>
                                Na InovaCortex, a privacidade não é um adendo legal, é o princípio base do nosso <strong className="text-foreground">Security by Design</strong>.
                            </p>

                            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">Uso de Dados Corporativos</h2>
                            <p>
                                Ao engajar com nossos modelos e arquiteturas, garantimos o isolamento de dados. Não utilizamos informações proprietárias dos nossos clientes para treinar modelos fundacionais públicos (LLMs de base). Sistemas implementados operam em ambientes tenant-isolated, com controle rigoroso de acesso baseado em funções (RBAC).
                            </p>

                            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">Coleta no Site Institucional</h2>
                            <p>
                                Neste site institucional, coletamos minimamente informações essenciais para diagnóstico de contato via formulários ou cookies estritamente necessários para performance da página. Não vendemos, alugamos ou compartilhamos leads com corretores de dados de terceiros.
                            </p>

                            <h2 className="text-xl font-bold text-foreground mt-8 mb-4">Direitos do Usuário (LGPD)</h2>
                            <p>
                                De acordo com as leis vigentes de proteção de dados (como LGPD no Brasil), você possui o direito de solicitar a visualização, alteração ou deleção de qualquer dado pessoal armazenado em nossa base de diagnósticos. Para requisições de privacidade, contate-nos em <a href="mailto:eduardo@inovacortex.com" className="text-primary hover:underline">eduardo@inovacortex.com</a>.
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
