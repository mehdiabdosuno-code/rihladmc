import { useState } from 'react'
import { 
  FileText, Share2, Download, Eye, Layout, Palette, 
  Image as ImageIcon, Globe, Lock, ChevronRight, Sparkles,
  Camera, Map as MapIcon, Calendar, Hotel, Bus, CheckCircle2, TrendingUp
} from 'lucide-react'
import { XLS_DAILY, XLS_MARGIN_PCT } from '@/data/ys_travel_11d'
import { useSimulation } from '@/hooks/useSimulation'
import { clsx } from 'clsx'

// ── Mock Templates ──────────────────────────────────────────────
const TEMPLATES = [
  { id: 'luxury',   name: 'Majestic Gold',   color: '#C5A059', font: 'font-serif', img: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&q=80&w=400', accent: 'bg-[#C5A059]' },
  { id: 'modern',   name: 'Nomad Spirit',    color: '#D97706', font: 'font-sans',  img: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?auto=format&fit=crop&q=80&w=400', accent: 'bg-[#D97706]' },
  { id: 'business', name: 'STOURS Elite',   color: '#1628A9', font: 'font-sans',  img: 'https://images.unsplash.com/photo-1553508913-264739567433?auto=format&fit=crop&q=80&w=400', accent: 'bg-[#1628A9]' },
]

export function ProposalStudioPage() {
  const [selectedTemplate, setSelectedTemplate] = useState('luxury')
  const [isGenerating, setIsGenerating] = useState(false)

  const sim = useSimulation(XLS_MARGIN_PCT)

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      window.print() // Ouvre la boîte de dialogue PDF du navigateur
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rihla flex items-center justify-center text-white shadow-lg shadow-rihla/20">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Proposal Studio</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Design & Export Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
            <Eye size={14} /> Aperçu
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2.5 bg-ink text-cream text-xs font-bold rounded-lg shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {isGenerating ? <><Download size={14} className="animate-bounce" /> Génération...</> : <><Download size={14} /> Exporter PDF</>}
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <button className="flex items-center gap-2 px-4 py-2.5 bg-rihla text-white text-xs font-bold rounded-lg shadow-lg hover:shadow-rihla/30 transition-all">
            <Share2 size={14} /> Partager le lien
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-8 grid grid-cols-12 gap-8">
        
        {/* LEFT: Sidebar Settings */}
        <div className="col-span-3 space-y-6">
          
          {/* Template Selection */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Layout size={12} /> Templates
            </h3>
            <div className="space-y-3">
              {TEMPLATES.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full group relative rounded-xl overflow-hidden border-2 transition-all ${selectedTemplate === t.id ? 'border-rihla ring-4 ring-rihla/10' : 'border-transparent'}`}
                >
                  <img src={t.img} alt={t.name} className="w-full h-24 object-cover group-hover:scale-110 transition-transform duration-500 opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-left">
                    <p className="text-white font-bold text-xs">{t.name}</p>
                    <p className="text-white/50 text-[10px]">{t.font} Typography</p>
                  </div>
                  {selectedTemplate === t.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-rihla rounded-full flex items-center justify-center">
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Design Controls */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Palette size={12} /> Personnalisation
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-2">Couleur d'accentuation</label>
                <div className="flex gap-2">
                  {['#140800', '#e63900', '#d97706', '#059669', '#2563eb'].map(c => (
                    <button key={c} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-50">
                <button className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-rihla">
                  <span className="flex items-center gap-2"><ImageIcon size={14} /> Bibliothèque Images</span>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="pt-2">
                <button className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-rihla">
                  <span className="flex items-center gap-2"><Globe size={14} /> Langue d'export</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">ANGLAIS</span>
                </button>
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidentialité</h3>
              <Lock size={12} className="text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Le lien public sera protégé par un mot de passe pour le Tour Opérateur.
            </p>
            <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/10">
              <span className="text-[10px] font-mono text-emerald-400">rihla.com/p/82x_4k...</span>
              <button className="text-[10px] font-bold text-white hover:text-rihla transition-colors">COPIER</button>
            </div>
          </div>
        </div>

        {/* RIGHT: Live Preview (The Canvas) */}
        <div className={clsx(
          "col-span-9 bg-white rounded-[48px] shadow-2xl overflow-hidden border border-slate-200 min-h-[1200px] relative transition-all duration-700",
          selectedTemplate === 'luxury' ? 'font-serif' : 'font-sans'
        )}>
          
          {/* Cover Page */}
          <div className="relative h-[700px] flex items-center justify-center overflow-hidden">
            <img 
              src={TEMPLATES.find(t => t.id === selectedTemplate)?.img} 
              className="absolute inset-0 w-full h-full object-cover scale-105"
            />
            <div className={clsx(
              "absolute inset-0 opacity-60 backdrop-blur-[1px]",
              selectedTemplate === 'luxury' ? "bg-[#140800]" : 
              selectedTemplate === 'modern' ? "bg-[#2d1a10]" : "bg-[#0A0F1D]"
            )} />
            
            {/* Decorative Gold Frame for Luxury */}
            {selectedTemplate === 'luxury' && (
              <div className="absolute inset-8 border border-[#C5A059]/30 pointer-events-none" />
            )}

            <div className="relative text-center px-12">
              <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 mx-auto mb-10 flex items-center justify-center shadow-2xl">
                <img src="/rihla_logo_profile.png" className="w-16 h-16 grayscale brightness-200" alt="Logo" />
              </div>
              <h2 className={clsx(
                "text-white text-7xl font-black mb-6 tracking-tighter",
                selectedTemplate === 'luxury' ? "font-serif italic" : "font-sans uppercase"
              )}>
                Magical Morocco
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-12 bg-white/30" />
                <p className="text-white text-xs font-bold tracking-[0.4em] uppercase opacity-80">Private Expedition · 2026</p>
                <div className="h-px w-12 bg-white/30" />
              </div>
              <div className="mt-12 flex items-center justify-center gap-8">
                <div className="text-white/60 text-center">
                  <p className="text-[10px] uppercase font-bold tracking-widest mb-1">Duration</p>
                  <p className="text-sm font-bold text-white">11 Days / 10 Nights</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div className="text-white/60 text-center">
                  <p className="text-[10px] uppercase font-bold tracking-widest mb-1">Participants</p>
                  <p className="text-sm font-bold text-white">20 - 30 Pax</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div className="text-white/60 text-center">
                  <p className="text-[10px] uppercase font-bold tracking-widest mb-1">Departure</p>
                  <p className="text-sm font-bold text-white">November 2026</p>
                </div>
              </div>
            </div>
          </div>

          {/* Itinerary Grid */}
          <div className="p-12">
            <div className="flex justify-between items-end mb-12 border-b border-slate-100 pb-8">
              <div>
                <h3 className="text-3xl font-black text-slate-900 mb-2">The Journey</h3>
                <p className="text-slate-400 text-sm">A hand-crafted selection of Morocco's finest treasures.</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 text-xs font-bold text-slate-600">
                  <Calendar size={14} className="text-rihla" /> Nov 01 - Nov 11
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 text-xs font-bold text-slate-600">
                  <Hotel size={14} className="text-rihla" /> 4* Premium
                </div>
              </div>
            </div>

            {/* Daily cards (Dynamic) */}
            <div className="grid grid-cols-2 gap-8">
              {XLS_DAILY.filter(d => d.halfDbl > 0).map((item, idx) => (
                <div key={item.day} className="group cursor-pointer">
                  <div className="relative h-48 rounded-2xl overflow-hidden mb-4">
                    <img src={`https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&q=80&w=400&v=${item.day}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-lg flex flex-col items-center justify-center shadow-lg">
                      <span className="text-[10px] font-black text-slate-400 leading-none">DAY</span>
                      <span className="text-lg font-black text-rihla leading-none">{item.day}</span>
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 mb-1">{item.date}</h4>
                  <p className="text-xs font-bold text-rihla uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapIcon size={12} /> {item.cities}
                  </p>
                  <div className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                    <span className="font-bold">Hôtel:</span> {item.hotel} ({item.formula}) <br/>
                    <span className="font-bold">Repas:</span> {item.rest}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Investment Section */}
            <div className="mt-20 p-12 bg-slate-50 rounded-[40px] border border-slate-200">
              <div className="text-center mb-8">
                <TrendingUp size={32} className="mx-auto text-rihla mb-4" />
                <h4 className="text-3xl font-black text-slate-900 mb-2">Financial Investment</h4>
                <p className="text-slate-500 text-sm">Estimated rates per person based on group size.</p>
              </div>
              
              <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className={clsx(
                    "text-white",
                    selectedTemplate === 'luxury' ? "bg-[#140800]" : 
                    selectedTemplate === 'modern' ? "bg-[#D97706]" : "bg-rihla"
                  )}>
                    <tr>
                      <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px]">Group Size (Pax)</th>
                      <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px] text-right">Price per Person (MAD)</th>
                      <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px] text-right opacity-80 italic">Price per Person (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sim.grid.map((row) => (
                      <tr key={row.pax} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800">{row.pax} Pax</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{Math.round(row.sell).toLocaleString('fr-FR')} MAD</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">${Math.round(row.usd).toLocaleString('en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-4 text-center">
                * Single supplement: {Math.round(sim.singleSupplement).toLocaleString('fr-FR')} MAD. Rates are valid for the selected dates only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
