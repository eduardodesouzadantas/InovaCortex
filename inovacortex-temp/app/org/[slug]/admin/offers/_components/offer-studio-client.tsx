"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    Layout,
    Target,
    FileText,
    Globe,
    BarChart3,
    Save,
    Rocket,
    ExternalLink,
    ChevronRight,
    Calculator,
    Briefcase
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface OfferStudioClientProps {
    orgId: string;
    orgSlug: string;
}

export function OfferStudioClient({ orgId, orgSlug }: OfferStudioClientProps) {
    const [offers, setOffers] = useState<any[]>([]);
    const [selectedOffer, setSelectedOffer] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("builder");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        fetchOffers();
    }, []);

    async function fetchOffers() {
        setLoading(true);
        const res = await fetch(`/api/org/${orgSlug}/offers`);
        const data = await res.json();
        setOffers(data);
        if (data.length > 0) setSelectedOffer(data[0]);
        setLoading(false);
    }

    async function handleCreateDraft() {
        const niche = prompt("Qual o nicho da oferta? (ex: Consultoria, SaaS, Mentoria)") || "High-Ticket";
        setLoading(true);
        const res = await fetch(`/api/org/${orgSlug}/offers`, {
            method: "POST",
            body: JSON.stringify({ niche })
        });
        const newOffer = await res.json();
        setOffers([newOffer, ...offers]);
        setSelectedOffer(newOffer);
        setLoading(false);
    }

    async function handleSave() {
        if (!selectedOffer) return;
        setSaving(true);
        await fetch(`/api/org/${orgSlug}/offers/${selectedOffer.id}`, {
            method: "PATCH",
            body: JSON.stringify(selectedOffer)
        });
        setSaving(false);
    }

    async function handlePublish() {
        if (!selectedOffer) return;
        setPublishing(true);
        const res = await fetch(`/api/org/${orgSlug}/offers/${selectedOffer.id}/publish`, {
            method: "POST"
        });
        const updated = await res.json();
        setSelectedOffer(updated);
        setOffers(offers.map(o => o.id === updated.id ? updated : o));
        setPublishing(false);
        alert(`Lançamento concluído! Slug: ${updated.publishedSlug}`);
    }

    if (loading && offers.length === 0) return <div className="p-12 text-zinc-500">Carregando Studio...</div>;

    const chartData = [
        { name: 'Seg', v: 120, c: 12 },
        { name: 'Ter', v: 150, c: 18 },
        { name: 'Qua', v: 180, c: 15 },
        { name: 'Qui', v: 220, c: 25 },
        { name: 'Sex', v: 200, c: 20 },
        { name: 'Sab', v: 110, c: 10 },
        { name: 'Dom', v: 90, c: 8 },
    ];

    const offerData = selectedOffer ? (typeof selectedOffer.offerJson === 'string' ? JSON.parse(selectedOffer.offerJson) : selectedOffer.offerJson) : null;

    return (
        <div className="flex h-screen overflow-hidden bg-[#0a0a0c]">

            {/* Sidebar: Offer List */}
            <aside className="w-80 border-r border-white/5 bg-zinc-950 flex flex-col">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="font-black tracking-tight text-white uppercase text-xs">Offer Studio</h2>
                    <button
                        onClick={handleCreateDraft}
                        className="p-1.5 rounded-lg bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {offers.map(offer => (
                        <button
                            key={offer.id}
                            onClick={() => setSelectedOffer(offer)}
                            className={`w-full text-left p-4 rounded-xl transition-all border ${selectedOffer?.id === offer.id
                                    ? 'bg-zinc-900 border-[#d4af37]/30'
                                    : 'border-transparent hover:bg-white/5 text-zinc-500 hover:text-white'
                                }`}
                        >
                            <div className="text-sm font-bold truncate mb-1">{offer.name}</div>
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${offer.status === 'published' ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                                <span className="text-[10px] uppercase font-black opacity-50">{offer.status}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content: Tabs & Editor */}
            <main className="flex-1 flex flex-col min-w-0">
                {!selectedOffer ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                        <Layout className="w-12 h-12 mb-4 opacity-20" />
                        <p>Selecione ou crie uma oferta para começar.</p>
                    </div>
                ) : (
                    <>
                        {/* Top Bar */}
                        <header className="p-4 border-b border-white/5 bg-zinc-950 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <h3 className="font-bold text-sm text-zinc-400 truncate max-w-sm">{selectedOffer.name}</h3>
                                <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                                    {[
                                        { id: 'builder', icon: Layout, label: 'Builder' },
                                        { id: 'roi', icon: Calculator, label: 'ROI Model' },
                                        { id: 'assets', icon: FileText, label: 'Assets' },
                                        { id: 'publish', icon: Rocket, label: 'Publish' },
                                        { id: 'performance', icon: BarChart3, label: 'Data' },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-zinc-500 hover:text-white'
                                                }`}
                                        >
                                            <tab.icon className="w-3.5 h-3.5" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button
                                    onClick={handlePublish}
                                    disabled={publishing}
                                    className="px-4 py-2 rounded-lg bg-[#d4af37] text-black text-xs font-black hover:bg-[#b8962e] transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Rocket className="w-3.5 h-3.5" />
                                    Launcher
                                </button>
                            </div>
                        </header>

                        {/* Editor Area */}
                        <div className="flex-1 overflow-hidden flex">
                            <div className="flex-1 overflow-y-auto p-8 relative">
                                <AnimatePresence mode="wait">
                                    {activeTab === 'builder' && (
                                        <motion.div
                                            key="builder"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="max-w-2xl space-y-8"
                                        >
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Nome do Programa</label>
                                                <input
                                                    value={selectedOffer.name}
                                                    onChange={e => setSelectedOffer({ ...selectedOffer, name: e.target.value })}
                                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm focus:border-[#d4af37]/50 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">A Promessa (Outcome)</label>
                                                <textarea
                                                    rows={3}
                                                    value={offerData.promise}
                                                    onChange={e => setSelectedOffer({ ...selectedOffer, offerJson: { ...offerData, promise: e.target.value } })}
                                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm focus:border-[#d4af37]/50 outline-none transition-all resize-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Preço (Cents)</label>
                                                    <input
                                                        type="number"
                                                        value={selectedOffer.priceCents}
                                                        onChange={e => setSelectedOffer({ ...selectedOffer, priceCents: parseInt(e.target.value) })}
                                                        className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm focus:border-[#d4af37]/50 outline-none transition-all"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Moeda</label>
                                                    <select
                                                        value={selectedOffer.currency}
                                                        onChange={e => setSelectedOffer({ ...selectedOffer, currency: e.target.value })}
                                                        className="w-full bg-zinc-900 border border-white/10 rounded-xl p-4 text-sm focus:border-[#d4af37]/50 outline-none transition-all"
                                                    >
                                                        <option value="BRL">BRL (R$)</option>
                                                        <option value="USD">USD ($)</option>
                                                        <option value="EUR">EUR (€)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'performance' && (
                                        <motion.div
                                            key="performance"
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="space-y-8"
                                        >
                                            <div className="grid grid-cols-3 gap-6">
                                                {[
                                                    { label: 'Views', value: '1,240', trend: '+12%' },
                                                    { label: 'Clicks/CTA', value: '86', trend: '+5%' },
                                                    { label: 'CR (Funnel)', value: '6.9%', trend: '+0.4%' },
                                                ].map(stat => (
                                                    <div key={stat.label} className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5">
                                                        <div className="text-xs text-zinc-500 mb-2">{stat.label}</div>
                                                        <div className="text-2xl font-black">{stat.value}</div>
                                                        <div className="text-[10px] text-emerald-400 font-bold mt-1">{stat.trend}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="h-80 w-full bg-zinc-900/40 rounded-3xl border border-white/5 p-6">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData}>
                                                        <defs>
                                                            <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                                        <XAxis dataKey="name" stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={{ background: '#000', border: '1px solid #333', fontSize: '10px' }} />
                                                        <Area type="monotone" dataKey="v" stroke="#d4af37" fillOpacity={1} fill="url(#colorV)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'publish' && (
                                        <motion.div key="publish" className="space-y-8 max-w-xl">
                                            <div className="p-8 rounded-3xl bg-zinc-900 border border-[#d4af37]/20 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                                    <Rocket className="w-16 h-16" />
                                                </div>
                                                <h4 className="text-lg font-bold mb-4">Lançar Oferta Publicamente</h4>
                                                <p className="text-zinc-400 text-sm mb-6">Ao publicar, geramos o One-Pager premium, o contrato jurídico e configuramos o link de pagamento exclusivo.</p>
                                                {selectedOffer.publishedSlug ? (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2 p-3 bg-black rounded-lg border border-white/10">
                                                            <span className="text-zinc-500 text-xs">URL:</span>
                                                            <code className="text-[#d4af37] text-xs">/p/o/${selectedOffer.publishedSlug}</code>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <a href={`/p/o/${selectedOffer.publishedSlug}`} target="_blank" className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">
                                                                <Globe className="w-3.5 h-3.5" /> Ver Página
                                                            </a>
                                                            <button className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">
                                                                Copiar Link
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={handlePublish} className="w-full py-4 bg-[#d4af37] text-black font-black rounded-2xl hover:bg-[#b8962e] transition-all flex items-center justify-center gap-3">
                                                        <Rocket className="w-5 h-5" /> Iniciar Lançamento
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 opacity-50">
                                                    <Briefcase className="w-5 h-5 mb-3 text-zinc-500" />
                                                    <div className="text-xs font-bold mb-1">Deal Packet</div>
                                                    <p className="text-[10px] text-zinc-600">Disponível após publish</p>
                                                </div>
                                                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 opacity-50">
                                                    <Target className="w-5 h-5 mb-3 text-zinc-500" />
                                                    <div className="text-xs font-bold mb-1">FB/IG Ads Prep</div>
                                                    <p className="text-[10px] text-zinc-600">Em desenvolvimento</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Preview Panel */}
                            <div className="w-[450px] border-l border-white/5 bg-zinc-900/40 flex flex-col">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between text-xs font-bold text-zinc-500">
                                    <span>Live Preview</span>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500/50" />
                                        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                                        <div className="w-2 h-2 rounded-full bg-green-500/50" />
                                    </div>
                                </div>
                                <div className="flex-1 bg-black m-4 rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
                                    {selectedOffer.status === 'published' ? (
                                        <iframe
                                            src={`/p/o/${selectedOffer.publishedSlug}`}
                                            className="w-full h-full border-none transform scale-90 origin-top h-[111%]"
                                            title="Offer Preview"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-12 text-center">
                                            <Rocket className="w-12 h-12 mb-4 opacity-10" />
                                            <p className="text-xs">Visualize a página premium após o primeiro lançamento.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
