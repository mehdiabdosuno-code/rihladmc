import { useState } from 'react'
import { 
  Settings, Building2, Globe, Shield, 
  Key, Bell, Palette, Save, 
  CheckCircle, AlertTriangle, CreditCard,
  Mail, Phone, MapPin, Percent
} from 'lucide-react'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'agency' | 'finance' | 'api' | 'security'>('agency')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-400 shadow-inner">
              <Settings size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream">Paramètres Système</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">Configuration Enterprise & API</p>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-rihla text-white text-xs font-bold rounded-xl shadow-lg hover:-translate-y-0.5 transition-all"
          >
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'Enregistré !' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 flex gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {[
              { id: 'agency', label: 'Profil Agence', icon: Building2 },
              { id: 'finance', label: 'Finance & Taxes', icon: Percent },
              { id: 'api', label: 'Intégrations API', icon: Key },
              { id: 'security', label: 'Sécurité & Rôles', icon: Shield },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id ? 'bg-rihla text-white shadow-md' : 'text-slate-500 hover:bg-white dark:hover:bg-white/5'}`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertTriangle size={16} />
              <p className="text-[10px] font-black uppercase">Attention</p>
            </div>
            <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70 leading-relaxed">
              Certaines modifications peuvent impacter les cotations en cours.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          
          {activeTab === 'agency' && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 dark:text-cream mb-6">Identité de l'Agence</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nom commercial</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="text" defaultValue="S'TOURS DMC Morocco" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-rihla transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Identifiant Fiscal (ICE)</label>
                  <input type="text" defaultValue="001524389000065" className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-rihla transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Email de contact</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="email" defaultValue="ops@stours.ma" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-rihla transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="text" defaultValue="+212 524 433 030" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-rihla transition-all" />
                  </div>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Siège Social</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="text" defaultValue="Angle Av. Mansour Eddahbi & Rue Imam Chaffai, Marrakech" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-rihla transition-all" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 dark:text-cream mb-6">Paramètres Financiers</h3>
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">TVA sur Prestations</p>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="20" className="w-full bg-transparent text-xl font-black text-slate-800 dark:text-cream outline-none" />
                      <span className="font-black text-slate-400">%</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">TVA sur Transport</p>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="14" className="w-full bg-transparent text-xl font-black text-slate-800 dark:text-cream outline-none" />
                      <span className="font-black text-slate-400">%</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Marge Sécurité</p>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="3" className="w-full bg-transparent text-xl font-black text-slate-800 dark:text-cream outline-none" />
                      <span className="font-black text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black text-slate-800 dark:text-cream flex items-center gap-2">
                    <CreditCard size={16} className="text-rihla" /> Informations Bancaires (USD)
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Nom de la Banque" defaultValue="Attijariwafa Bank" className="px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold" />
                    <input type="text" placeholder="SWIFT / BIC" defaultValue="BCPAMA21" className="px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold" />
                    <input type="text" placeholder="IBAN" defaultValue="MA64 007 123 0000 4567 8901 2345" className="col-span-2 px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 dark:text-cream mb-6">Connecteurs Externes</h3>
              <div className="space-y-6">
                {[
                  { name: 'OpenAI GPT-4', desc: 'Génération d\'itinéraires et Content Studio', status: 'Connecté' },
                  { name: 'Fixer.io API', desc: 'Taux de change Live (Forex)', status: 'Connecté' },
                  { name: 'Google Maps Platform', desc: 'Calcul des distances et géocodage', status: 'Action requise', error: true },
                ].map((api, i) => (
                  <div key={i} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-[24px] border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${api.error ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
                        <Key size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-cream text-sm">{api.name}</p>
                        <p className="text-[11px] text-slate-400">{api.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-black uppercase ${api.error ? 'text-red-500' : 'text-emerald-500'}`}>{api.status}</span>
                      <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black hover:bg-slate-50 transition-all">CONFIGURER</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
