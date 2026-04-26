import { useState, useMemo } from 'react'
import { 
  Type, Languages, Wand2, Copy, Check, 
  RefreshCw, FileText, Globe, Sparkles, 
  MessageSquare, Layout, Download, Save,
  Calendar, MapPin, Hotel, Utensils
} from 'lucide-react'
import { aiApi } from '@/lib/api'
import { XLS_DAILY } from '@/data/ys_travel_11d'
import { clsx } from 'clsx'

export function ContentStudioPage() {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [tone, setTone] = useState('luxury')
  const [targetLang, setTargetLang] = useState('english')
  const [resultText, setResultText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const selectedDay = XLS_DAILY[selectedDayIdx]

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const prompt = `Tu es un copywriter expert en voyage de luxe pour l'agence S'TOURS DMC au Maroc. 
      Rédige un texte descriptif immersif et captivant pour le jour suivant de l'itinéraire :
      
      - JOUR : ${selectedDay.day}
      - VILLE : ${selectedDay.cities}
      - HÔTEL : ${selectedDay.hotel}
      - REPAS : ${selectedDay.rest}
      
      TONALITÉ : ${tone === 'luxury' ? 'Haut de gamme, élégant, sensoriel' : tone === 'adventure' ? 'Dynamique, explorateur, actif' : 'Professionnel, efficace, informatif'}
      LANGUE : ${targetLang}
      
      Rédige environ 3-4 phrases. Ne mentionne pas de prix. Focus sur l'expérience et le confort.`
      
      const res = await aiApi.generate(prompt)
      setResultText(res.data?.content || '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-warm-yellow dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-klein/10 flex items-center justify-center text-klein shadow-inner">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-ink dark:text-cream">AI Content Studio</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">Génération de contenu dynamique</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-6 py-2.5 bg-klein text-white text-xs font-bold rounded-xl shadow-xl shadow-klein/20 hover:-translate-y-0.5 transition-all">
              <Save size={14} /> Sauvegarder dans le Projet
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          
          {/* Sidebar - Day Selector */}
          <div className="col-span-3 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Itinéraire du Circuit</h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
              {XLS_DAILY.map((d, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={clsx(
                    "w-full flex flex-col items-start p-4 rounded-2xl border transition-all text-left",
                    selectedDayIdx === idx 
                      ? "bg-white border-klein shadow-md ring-1 ring-klein/10" 
                      : "bg-white/50 border-slate-100 hover:border-slate-200 hover:bg-white"
                  )}
                >
                  <span className={clsx("text-[9px] font-black uppercase mb-1", selectedDayIdx === idx ? "text-klein" : "text-slate-400")}>
                    Jour {d.day}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{d.cities}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Main Workspace */}
          <div className="col-span-9 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              
              {/* Context Panel */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Layout size={14} /> Contexte du Jour
                  </h3>
                  <span className="text-[9px] font-black bg-slate-100 px-2 py-1 rounded text-slate-500 uppercase">Input Réel</span>
                </div>
                
                <div className="space-y-6 flex-1">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg"><MapPin size={16} className="text-slate-400" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destination</p>
                      <p className="text-sm font-bold text-slate-800">{selectedDay.cities}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg"><Hotel size={16} className="text-slate-400" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hébergement</p>
                      <p className="text-sm font-bold text-slate-800">{selectedDay.hotel}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-50 rounded-lg"><Utensils size={16} className="text-slate-400" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Régime Alimentaire</p>
                      <p className="text-sm font-bold text-slate-800">{selectedDay.rest}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 space-y-4 border-t border-slate-50">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Tonalité</label>
                      <select 
                        value={tone}
                        onChange={e => setTone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                      >
                        <option value="luxury">✨ Luxueux</option>
                        <option value="adventure">🏔️ Aventure</option>
                        <option value="corporate">💼 Corporate</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Langue</label>
                      <select 
                        value={targetLang}
                        onChange={e => setTargetLang(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                      >
                        <option value="french">Français</option>
                        <option value="english">Anglais</option>
                        <option value="spanish">Espagnol</option>
                      </select>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-ink text-white rounded-2xl font-black text-xs shadow-xl hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={16} /> : <Wand2 size={16} />}
                    GÉNÉRER LE DESCRIPTIF
                  </button>
                </div>
              </div>

              {/* Result Panel */}
              <div className="bg-ink rounded-3xl p-8 shadow-2xl flex flex-col relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-klein/20 blur-[100px] pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h3 className="text-xs font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={14} /> Magie IA (Ollama)
                  </h3>
                </div>

                <div className="flex-1 relative z-10 overflow-y-auto">
                  {resultText ? (
                    <p className="text-cream text-lg leading-relaxed font-medium italic">
                      "{resultText}"
                    </p>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/10 text-center px-8">
                      <Sparkles size={48} className="mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">
                        Sélectionnez un jour et cliquez sur générer pour créer un contenu unique.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-white/10 flex justify-between items-center relative z-10">
                  <p className="text-[9px] text-white/20 font-bold uppercase">
                    {resultText.split(' ').filter(x => x).length} mots générés
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={copyToClipboard}
                      disabled={!resultText}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      Copier
                    </button>
                    <button 
                      disabled={!resultText}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-30"
                    >
                      <Download size={14} /> Exporter
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Settings Info */}
            <div className="bg-klein/5 border border-klein/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-klein/10 flex items-center justify-center text-klein">
                <MessageSquare size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-ink">Modèle Local Actif : Ollama / Claude</p>
                <p className="text-[10px] text-slate-500">Votre IA tourne localement sur votre serveur, garantissant la confidentialité totale de vos données clients.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

