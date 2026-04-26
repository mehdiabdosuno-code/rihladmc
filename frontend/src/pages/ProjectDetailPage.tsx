import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FolderKanban, Calculator, MapPin, Receipt, Download,
  Save, Edit3, Check, X, Clock, Users, Calendar, Globe,
  ChevronRight, Sparkles, FileText, BarChart2, Plane, Building2,
  AlertTriangle, Copy, ExternalLink, MoreHorizontal,
  BadgeCheck, TrendingUp, Hash, Layers, History, Shield, Navigation
} from 'lucide-react'
import { projectsApi, quotationsApi, itinerariesApi, invoicesApi, aiApi } from '@/lib/api'
import { clsx } from 'clsx'
import { ItineraryMap } from '@/components/maps/ItineraryMap'

// ââ Status badges ââââââââââââââââââââââââââââââââââââââââââââââââ
const STATUS_MAP: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  draft:       { label: 'Brouillon',  class: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: Edit3 },
  in_progress: { label: 'En cours',   class: 'bg-blue-500/10 text-blue-500 border-blue-500/20',     icon: Clock },
  validated:   { label: 'Validé',     class: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Check },
  sent:        { label: 'Envoyé',     class: 'bg-rihla/10 text-rihla border-rihla/20',            icon: Plane },
  won:         { label: 'Gagné',      class: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20', icon: Check },
  lost:        { label: 'Perdu',      class: 'bg-rose-500/10 text-rose-500 border-rose-500/20',     icon: X },
}

const TABS = [
  { id: 'overview',   label: 'Pilotage Global', icon: Layers },
  { id: 'quotation',  label: 'Cotation',         icon: Calculator },
  { id: 'itinerary',  label: 'Itinéraire',       icon: MapPin },
  { id: 'invoice',    label: 'Facturation',      icon: Receipt },
  { id: 'exports',    label: 'Édition & PDF',    icon: FileText },
  { id: 'audit',      label: 'Audit Trail',      icon: History },
] as const
type TabId = typeof TABS[number]['id']

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabId>('overview')

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then(r => r.data),
    enabled: !!projectId,
  })

  const { data: quotationData } = useQuery({
    queryKey: ['project-quotation', projectId],
    queryFn: () => quotationsApi.byProject(projectId!).then(r => r.data),
    enabled: !!projectId && (tab === 'quotation' || tab === 'overview'),
  })

  const { data: itineraryData } = useQuery({
    queryKey: ['project-itinerary', projectId],
    queryFn: () => itinerariesApi.byProject(projectId!).then(r => r.data),
    enabled: !!projectId && (tab === 'itinerary' || tab === 'overview'),
  })

  const { data: invoiceData } = useQuery({
    queryKey: ['project-invoices', projectId],
    queryFn: () => invoicesApi.byProject(projectId!).then(r => r.data),
    enabled: !!projectId && (tab === 'invoice' || tab === 'overview'),
  })

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => projectsApi.patch(projectId!, newStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
      <div className="w-12 h-12 border-4 border-rihla/20 border-t-rihla rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Analyse du dossier...</p>
    </div>
  )

  if (!project) return (
    <div className="flex items-center justify-center h-[70vh]">
      <div className="text-center bg-white dark:bg-slate-900 p-12 rounded-[48px] border border-slate-200 dark:border-slate-800 shadow-2xl">
        <AlertTriangle size={64} className="mx-auto mb-6 text-amber-500" />
        <h2 className="text-2xl font-black text-slate-800 dark:text-cream mb-2">Dossier non référencé</h2>
        <p className="text-slate-400 text-sm mb-8">Ce projet n'existe plus dans la base active de S'TOURS.</p>
        <Link to="/projects" className="px-8 py-3 bg-rihla text-white rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-rihla/20">
          Retour au Portfolio
        </Link>
      </div>
    </div>
  )

  const status = STATUS_MAP[project.status] || STATUS_MAP.draft
  const StatusIcon = status.icon

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-300">
      
      {/* ———————————————————————————————————————————————————————————————————————————— */}
      <div className="px-10 py-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Link to="/projects" className="hover:text-rihla transition-colors">PORTFOLIO</Link>
        <ChevronRight size={10} />
        <span className="text-slate-900 dark:text-cream">{project.name}</span>
      </div>

      {/* ———————————————————————————————————————————————————————————————————————————— */}
      <div className="px-10 mb-10">
        <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 p-10 shadow-sm relative overflow-hidden">
          
          {/* Glass Accent */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rihla/5 blur-[120px] -mr-64 -mt-64 pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className={clsx(
                  "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                  status.class
                )}>
                  <StatusIcon size={12} className="inline mr-2" /> {status.label}
                </div>
                {project.project_type && (
                  <div className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    {project.project_type}
                  </div>
                )}
              </div>
              
              <h1 className="text-4xl font-black text-slate-900 dark:text-cream leading-tight mb-2 tracking-tighter">
                {project.name}
              </h1>
              
              <div className="flex items-center gap-6 mt-4">
                 <div className="flex items-center gap-2 text-slate-400 text-xs font-bold italic">
                   <Building2 size={14} className="text-rihla" /> {project.client_name || 'Client Direct'}
                 </div>
                 <div className="flex items-center gap-2 text-slate-400 text-xs font-bold italic">
                   <Hash size={14} className="text-rihla" /> {project.reference || 'REF-9921'}
                 </div>
              </div>
            </div>

            <div className="flex gap-3">
               <button className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 hover:text-rihla transition-all shadow-inner">
                 <Copy size={20} />
               </button>
               <button className="px-8 py-4 bg-rihla text-white text-[11px] font-black uppercase rounded-2xl shadow-2xl shadow-rihla/20 hover:scale-105 transition-all">
                 <Save size={18} className="inline mr-2" /> Sauvegarder
               </button>
            </div>
          </div>

          {/* Metrics Bar */}
          <div className="grid grid-cols-4 gap-6 mt-10 pt-10 border-t border-slate-100 dark:border-white/5 relative z-10">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destination</p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 italic">
                <MapPin size={14} className="text-rihla" /> {project.destination || 'Marrakech, Maroc'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logistique</p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 italic">
                <Users size={14} className="text-rihla" /> {project.pax_count || 20} PAX
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Temporalité</p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 italic">
                <Calendar size={14} className="text-rihla" /> {project.duration_days || 7} Jours
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dernière MaJ</p>
              <p className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 italic">
                <Clock size={14} className="text-rihla" /> {new Date(project.updated_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Workflow Interactive */}
          <div className="flex items-center gap-1 mt-10">
            {['draft', 'in_progress', 'validated', 'sent', 'won'].map((s, i) => {
              const st = STATUS_MAP[s]
              const active = s === project.status
              const past = ['draft','in_progress','validated','sent','won'].indexOf(project.status) >= i
              return (
                <button
                  key={s}
                  onClick={() => !active && statusMutation.mutate(s)}
                  disabled={active}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border",
                    active ? "bg-slate-900 text-white border-slate-900 shadow-xl" :
                    past ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                    "bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-100 dark:border-white/5"
                  )}
                >
                  <div className={clsx("w-2 h-2 rounded-full", active ? "bg-rihla" : past ? "bg-emerald-500" : "bg-slate-300")} />
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ———————————————————————————————————————————————————————————————————————————— */}
      <div className="px-10 mb-8 flex items-center gap-2">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex items-center gap-3 px-8 py-4 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all",
                active ? "bg-slate-900 text-white shadow-2xl scale-105" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
              )}
            >
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ———————————————————————————————————————————————————————————————————————————— */}
      <div className="px-10">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {tab === 'overview' && (
            <OverviewTab project={project} quotation={quotationData} itinerary={itineraryData} invoices={invoiceData} onTab={setTab} />
          )}
          {tab === 'quotation' && (
            <QuotationTab project={project} quotation={quotationData} />
          )}
          {tab === 'itinerary' && (
            <ItineraryTab project={project} itinerary={itineraryData} />
          )}
          {tab === 'invoice' && (
            <InvoiceTab project={project} invoices={invoiceData} />
          )}
          {tab === 'exports' && (
            <ExportsTab project={project} />
          )}
          {tab === 'audit' && (
            <AuditTab projectId={projectId!} />
          )}
        </div>
      </div>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————————
// OVERVIEW TAB
// ————————————————————————————————————————————————————————————————————————————
function OverviewTab({ project, quotation, itinerary, invoices, onTab }: any) {
  const modules = [
    {
      title: 'Cotation',
      icon: Calculator,
      color: 'text-rihla',
      bg: 'bg-rihla/10',
      status: quotation?.total_selling ? `${quotation.total_selling.toLocaleString()} MAD` : 'En attente',
      label: 'Volume de vente',
      tab: 'quotation',
    },
    {
      title: 'Itinéraire',
      icon: MapPin,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      status: itinerary?.days?.length ? `${itinerary.days.length} Jours Rédigés` : 'À créer',
      label: 'Progression éditoriale',
      tab: 'itinerary',
    },
    {
      title: 'Facturation',
      icon: Receipt,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      status: invoices?.length ? `${invoices.length} Factures` : 'Aucune émise',
      label: 'État des encaissements',
      tab: 'invoice',
    },
    {
      title: 'Exports',
      icon: Download,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      status: 'PDF · DOCX · PPT',
      label: 'Documents prêts',
      tab: 'exports',
    },
    {
      title: 'Live Tracking',
      icon: Navigation,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
      status: 'Portail B2C Actif',
      label: 'Expérience Voyageur',
      tab: 'live',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-8">
      {/* Module Grid */}
      <div className="col-span-3 grid grid-cols-2 gap-8">
        {modules.map(m => {
          const Icon = m.icon
          return (
            <button
              key={m.title}
              onClick={() => onTab(m.tab)}
              className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-8 text-left hover:shadow-2xl transition-all group overflow-hidden relative"
            >
              <div className="flex items-center justify-between mb-8">
                <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center", m.bg)}>
                  <Icon size={28} className={m.color} />
                </div>
                <ChevronRight size={20} className="text-slate-200 group-hover:text-rihla transition-all group-hover:translate-x-2" />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-cream tracking-tighter mb-4">{m.status}</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <BadgeCheck size={14} className="text-emerald-500" /> Module {m.title} Actif
              </div>
            </button>
          )
        })}

        {/* AI Insight Card */}
        <div className="col-span-2 bg-gradient-to-br from-rihla to-rihla-dark rounded-[48px] p-12 text-white relative overflow-hidden shadow-2xl shadow-rihla/20">
           <div className="absolute top-0 right-0 p-20 opacity-10">
             <Sparkles size={120} />
           </div>
           <div className="relative z-10 flex items-center justify-between">
              <div>
                <h4 className="text-3xl font-black mb-4 tracking-tighter">S'TOURS Genius : Dossier Analyse</h4>
                <p className="text-rihla-light text-lg font-medium opacity-90 leading-relaxed mb-8 max-w-xl">
                  Ce dossier présente un taux de conversion estimé à **85%**. L'IA suggère d'ajouter une option VIP "Survol en Montgolfière" pour augmenter la marge de 12%.
                </p>
                <button className="px-8 py-4 bg-white text-rihla text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-black/20">
                  Appliquer Suggestion
                </button>
              </div>
           </div>
        </div>
      </div>

      {/* Sidebar: Internal Notes & Team */}
      <div className="col-span-1 space-y-8">
         <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Notes du Designer</h5>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic mb-8">
              {project.notes || "Aucune note interne pour le moment. Le client souhaite une approche centrée sur l'artisanat de Fès."}
            </p>
            <button className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black text-slate-400 uppercase hover:border-rihla hover:text-rihla transition-all">
              Éditer les Notes
            </button>
         </div>

         <div className="bg-emerald-500 rounded-[40px] p-8 text-white text-center">
            <TrendingUp size={40} className="mx-auto mb-4" />
            <p className="text-4xl font-black tracking-tighter mb-1">PRO-FIT</p>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Marge Brute Optimisée</p>
         </div>
      </div>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————————
// QUOTATION TAB
// ————————————————————————————————————————————————————————————————————————————
function QuotationTab({ project, quotation }: any) {
  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 p-12 shadow-sm">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter mb-2">Moteur de Cotation</h2>
            <p className="text-slate-400 text-sm font-medium">Analyse précise des coûts et marges opérationnelles.</p>
          </div>
          <Link to="/quotations" className="px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:text-rihla transition-all">
            Full Screen Editor <ExternalLink size={14} className="inline ml-2" />
          </Link>
        </div>

        {quotation?.id ? (
          <div className="space-y-12">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-8">
              <div className="bg-slate-50 dark:bg-white/5 rounded-[32px] p-8 border border-slate-100 dark:border-white/5 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Net Achat</p>
                <p className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter">
                  {quotation.price_per_pax?.toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-rihla/5 rounded-[32px] p-8 border border-rihla/10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={24} /></div>
                <p className="text-[10px] font-black text-rihla uppercase tracking-widest mb-2">Prix de Vente PAX</p>
                <p className="text-3xl font-black text-rihla tracking-tighter">
                   {(quotation.total_selling / (project.pax_count || 1)).toLocaleString()} MAD
                </p>
              </div>
              <div className="bg-emerald-500/10 rounded-[32px] p-8 border border-emerald-500/20 text-center">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Dossier</p>
                <p className="text-3xl font-black text-emerald-600 tracking-tighter">
                  {quotation.total_selling?.toLocaleString()} MAD
                </p>
              </div>
            </div>

            {/* AI Predictive Insight */}
            <AIPricingInsight projectId={project.id} />

            {/* Pricing Grid */}
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Grille Tarifaire B2B</h3>
              <div className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Base PAX</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest">Achat / PAX</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-rihla">Vente / PAX</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest">Marge (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {[10, 15, 20, 25].map((basis, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-8 py-6 font-black text-slate-900 dark:text-cream text-lg">BASE {basis}</td>
                        <td className="px-8 py-6 text-right font-bold text-slate-500 italic">4,500 MAD</td>
                        <td className="px-8 py-6 text-right font-black text-rihla text-xl">5,850 MAD</td>
                        <td className="px-8 py-6 text-right font-black text-emerald-500">23%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 dark:bg-white/5 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/5">
            <Calculator size={64} className="mx-auto mb-6 text-slate-200" />
            <h4 className="text-xl font-black text-slate-800 dark:text-cream mb-2">Aucune Cotation Active</h4>
            <p className="text-slate-400 text-sm mb-10">Générez vos prix basés sur les tarifs 2026.</p>
            <button className="px-10 py-4 bg-rihla text-white text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-rihla/20">
              Lancer le Chiffrage
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————————
// ITINERARY TAB
// ————————————————————————————————————————————————————————————————————————————
function ItineraryTab({ project, itinerary }: any) {
  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 p-12 shadow-sm">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter mb-2">Programme de Voyage</h2>
            <p className="text-slate-400 text-sm font-medium">Narration de l'expérience client au Maroc.</p>
          </div>
          <div className="flex gap-4">
             <button className="px-6 py-3 bg-emerald-500/10 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={14} /> Régénérer par IA
             </button>
             <Link to="/itineraries" className="px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                Éditeur Narratif <ExternalLink size={14} className="inline ml-2" />
             </Link>
          </div>
        </div>

        {/* STRATEGIC ITINERARY MAP */}
        <div className="mb-12">
          <ItineraryMap days={itinerary?.days || []} />
        </div>

        {itinerary?.days?.length > 0 ? (
          <div className="space-y-6">
            {itinerary.days.map((day: any) => (
              <div key={day.id || day.day_number} className="group bg-white dark:bg-slate-950/50 rounded-[32px] border border-slate-100 dark:border-white/5 p-8 flex items-start gap-8 hover:shadow-xl transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Edit3 size={18} className="text-slate-300 hover:text-rihla cursor-pointer" />
                </div>
                
                {/* Day Marker */}
                <div className="w-16 h-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center shrink-0 font-serif text-2xl font-bold shadow-2xl">
                  {day.day_number}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-2">
                   <div className="flex items-center gap-4 mb-3">
                     <h4 className="text-xl font-black text-slate-900 dark:text-cream tracking-tight truncate">{day.title}</h4>
                     {day.ai_generated && (
                       <span className="px-3 py-1 bg-rihla/10 text-rihla text-[9px] font-black uppercase tracking-widest rounded-lg">IA Genius</span>
                     )}
                   </div>
                   <div className="flex items-center gap-6 text-[11px] font-bold text-slate-400 italic mb-6">
                      <span className="flex items-center gap-2"><MapPin size={14} className="text-rihla" /> {day.city}</span>
                      <span className="flex items-center gap-2"><Building2 size={14} className="text-amber-500" /> {day.hotel || 'Hébergement non défini'}</span>
                   </div>
                   <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                     {day.description || 'Cliquez pour rédiger l’expérience de cette journée...'}
                   </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 dark:bg-white/5 rounded-[40px]">
            <MapPin size={64} className="mx-auto mb-6 text-slate-200" />
            <h4 className="text-xl font-black text-slate-800 dark:text-cream mb-6">Itinéraire Vierge</h4>
            <button className="px-10 py-4 bg-slate-900 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-black/20">
              Générer Premier Jet (IA)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————————
// INVOICE TAB
// ————————————————————————————————————————————————————————————————————————————
function InvoiceTab({ project, invoices }: any) {
  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 p-12 shadow-sm">
        <div className="flex items-center justify-between mb-12">
          <div>
             <h2 className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter mb-2">Comptabilité & Encaissements</h2>
             <p className="text-slate-400 text-sm font-medium">Historique des facturations et état des paiements.</p>
          </div>
          <button className="px-8 py-4 bg-amber-500 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-amber-500/20">
             Nouvelle Facture
          </button>
        </div>

        {invoices?.length > 0 ? (
          <div className="grid grid-cols-2 gap-6">
             {invoices.map((inv: any) => (
                <div key={inv.id} className="bg-slate-50 dark:bg-white/5 rounded-[32px] p-8 border border-slate-100 dark:border-white/5 flex items-center justify-between group hover:shadow-xl transition-all">
                   <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-amber-500 shadow-sm group-hover:scale-110 transition-transform">
                         <Receipt size={28} />
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{inv.invoice_number}</p>
                         <p className="text-lg font-black text-slate-900 dark:text-cream tracking-tighter">
                            {inv.total_ttc?.toLocaleString()} MAD
                         </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase rounded-lg">Payée</span>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 italic">Le 12/04/26</p>
                   </div>
                </div>
             ))}
          </div>
        ) : (
          <div className="text-center py-20">
             <Receipt size={64} className="mx-auto mb-6 text-slate-200" />
             <p className="text-slate-400 text-sm font-medium">Aucun flux financier dÃ©tectÃ© sur ce dossier.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// EXPORTS TAB
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function ExportsTab({ project }: any) {
  const formats = [
    { ext: 'PDF Premium',  icon: FileText,  color: 'bg-rihla text-white',      desc: 'Proposition Client Haute Définition' },
    { ext: 'Word Editable', icon: FileText,  color: 'bg-blue-600 text-white',   desc: 'Version modifiable pour correction' },
    { ext: 'PowerPoint',   icon: BarChart2, color: 'bg-amber-600 text-white',  desc: 'Présentation pour écran géant' },
    { ext: 'Excel Budget', icon: BarChart2, color: 'bg-emerald-600 text-white', desc: 'Détail analytique des coûts' },
  ]

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 p-12 shadow-sm">
       <h2 className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter mb-4">Exportation & Brand Content</h2>
       <p className="text-slate-400 text-sm font-medium mb-12">GÃ©nÃ©rez vos documents officiels aux couleurs de S'TOURS.</p>

       <div className="grid grid-cols-2 gap-8">
          {formats.map(f => {
            const Icon = f.icon
            return (
              <button key={f.ext} className="flex items-center gap-6 p-8 rounded-[40px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:shadow-2xl transition-all group text-left">
                 <div className={clsx("w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform", f.color)}>
                    <Icon size={32} />
                 </div>
                 <div className="flex-1">
                    <p className="text-xl font-black text-slate-900 dark:text-cream tracking-tighter mb-1">{f.ext}</p>
                    <p className="text-xs font-medium text-slate-400">{f.desc}</p>
                 </div>
                 <Download size={20} className="text-slate-200 group-hover:text-rihla transition-colors" />
              </button>
            )
          })}
       </div>
    </div>
  )
}

// ── AUDIT TAB ──────────────────────────────────────────────────────────
function AuditTab({ projectId }: { projectId: string }) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['project-audit', projectId],
    queryFn: () => projectsApi.getAudit(projectId).then(r => r.data),
  })

  if (isLoading) return <div className="p-20 text-center animate-pulse">Chargement de l'historique...</div>

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 p-12 shadow-sm">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
          <Shield size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter">Historique des Modifications</h2>
          <p className="text-slate-400 text-sm font-medium italic">Audit trail complet pour la conformité et le suivi des dossiers.</p>
        </div>
      </div>

      <div className="space-y-4">
        {logs?.map((log: any) => (
          <div key={log.id} className="p-6 rounded-[32px] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-start gap-6 hover:shadow-lg transition-all">
             <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-rihla shadow-sm">
               <History size={18} />
             </div>
             <div className="flex-1">
               <div className="flex justify-between items-start mb-2">
                 <h4 className="font-black text-slate-900 dark:text-cream text-sm uppercase tracking-tight">
                   {log.action} · {log.entity_type}
                 </h4>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   {new Date(log.created_at).toLocaleString('fr-FR')}
                 </span>
               </div>
               <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                 {log.description || `Action effectuée sur ${log.entity_type} (${log.entity_id})`}
               </p>
               {log.changes && (
                 <div className="bg-white dark:bg-black/20 rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                   <div className="grid grid-cols-2 gap-4">
                     {Object.entries(log.changes).map(([field, val]: [string, any]) => (
                       <div key={field} className="text-[10px]">
                         <p className="font-black text-slate-400 uppercase tracking-tighter mb-1">{field}</p>
                         <div className="flex items-center gap-2">
                           <span className="text-rose-500 line-through opacity-50">{JSON.stringify(val.before)}</span>
                           <ChevronRight size={10} className="text-slate-300" />
                           <span className="text-emerald-500 font-bold">{JSON.stringify(val.after)}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               <div className="mt-4 flex items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                 <span>IP: {log.ip_address || '—'}</span>
                 <span>ID Utilisateur: {log.user_id || 'Système'}</span>
               </div>
             </div>
          </div>
        ))}
        {(!logs || logs.length === 0) && (
          <div className="text-center py-20 opacity-30">
            <Shield size={64} className="mx-auto mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Aucun log d'audit pour ce dossier.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── AI PRICING INSIGHT ──────────────────────────────────────────────────
function AIPricingInsight({ projectId }: { projectId: string }) {
  const { data: insight, isLoading } = useQuery({
    queryKey: ['predictive-pricing', projectId],
    queryFn: () => aiApi.getPredictivePricing(projectId).then(r => r.data),
  })

  if (isLoading) return <div className="h-40 bg-slate-50 dark:bg-white/5 rounded-[40px] animate-pulse mb-8" />
  if (!insight || insight.error) return null

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group mb-12">
      <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
        <Sparkles size={100} />
      </div>
      
      <div className="flex items-start gap-8 relative z-10">
        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shrink-0">
          <TrendingUp size={40} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] bg-white/20 px-3 py-1 rounded-full">S'TOURS Genius</span>
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Confiance: {Math.round(insight.confidence_score * 100)}%</span>
          </div>
          <h4 className="text-3xl font-black tracking-tighter mb-4">Stratégie de Marge Optimale</h4>
          <p className="text-indigo-100 font-medium leading-relaxed mb-8 max-w-2xl">
            {insight.market_insight}
          </p>
          
          <div className="flex items-center gap-12">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Marge Suggérée</p>
              <p className="text-4xl font-black text-white">{insight.optimal_margin_pct}%</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Ajustement Marché</p>
              <p className="text-4xl font-black text-emerald-400">+{insight.suggested_price_adjustment}%</p>
            </div>
            <button className="ml-auto px-8 py-4 bg-white text-indigo-900 text-[11px] font-black uppercase rounded-2xl shadow-xl hover:scale-105 transition-all">
              Appliquer la Stratégie
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
