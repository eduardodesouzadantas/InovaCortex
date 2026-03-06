import Link from "next/link";
import { Github, Linkedin, Twitter, Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-border/40 bg-background/95 pt-16 pb-8">
            <div className="container mx-auto px-4 md:px-8 max-w-screen-xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

                    <div className="md:col-span-1 space-y-4">
                        <Link href="/" className="inline-block">
                            <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">InovaCortex</span>
                        </Link>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Desenvolvimento inteligente, escalável e focado em automações para a nova era digital.
                        </p>
                        <div className="flex space-x-4 pt-2">
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Linkedin className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                                <Github className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">Soluções</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link href="/solucoes/ia" className="hover:text-primary transition-colors">Agentes de IA</Link></li>
                            <li><Link href="/solucoes/saas" className="hover:text-primary transition-colors">Desenvolvimento SaaS</Link></li>
                            <li><Link href="/solucoes/automacao" className="hover:text-primary transition-colors">Automação de Processos</Link></li>
                            <li><Link href="/solucoes/dashboards" className="hover:text-primary transition-colors">Dashboards Inteligentes</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">Empresa</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li><Link href="/sobre" className="hover:text-primary transition-colors">Sobre Nós</Link></li>
                            <li><Link href="/cases" className="hover:text-primary transition-colors">Casos de Sucesso</Link></li>
                            <li><Link href="/carreiras" className="hover:text-primary transition-colors">Carreiras</Link></li>
                            <li><Link href="/blog" className="hover:text-primary transition-colors">Blog</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-4 text-foreground">Contato</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center">
                                <Mail className="h-4 w-4 mr-2" />
                                <a href="mailto:eduardo@inovacortex.com" className="hover:text-primary transition-colors">eduardo@inovacortex.com</a>
                            </li>
                            <li>
                                <p className="text-muted-foreground">São Paulo, SP - Brasil</p>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-border/50 pt-8 mt-8 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground">
                    <p>© {new Date().getFullYear()} InovaCortex. Todos os direitos reservados.</p>
                    <div className="flex space-x-4 mt-4 md:mt-0">
                        <Link href="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
                        <Link href="/termos" className="hover:text-foreground transition-colors">Termos de Serviço</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
