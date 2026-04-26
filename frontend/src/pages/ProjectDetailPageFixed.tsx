import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FolderKanban, Calculator, MapPin, Receipt, Download,
  Save, Edit3, Check, X, Clock, Users, Calendar, Globe,
  ChevronRight, Sparkles, FileText, BarChart2, Plane, Building2,
  AlertTriangle, Copy, ExternalLink, MoreHorizontal, Mail, Flag, Share2, Link as LinkIcon, Palette,
  History, ClipboardCheck, Lock, ShieldCheck, Info
} from 'lucide-react'
import { projectsApi, quotationsApi, itinerariesApi, invoicesApi, reportsApi, api } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { CollaborationAvatarGroup } from '@/components/collaboration/CollaborationAvatarGroup'
import { ProjectComments } from '@/components/collaboration/ProjectComments'
import { AuditLog } from '@/components/security/AuditLog'
import { recordRecentProject } from '@/hooks/useRecentProjects'
import { clsx } from 'clsx'

// ── Status badges ────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  draft:       { label: 'Brouillon',  class: 'bg-parchment text-slate border-line',         icon: Edit3 },
  in_progress: { label: 'En cours',   class: 'bg-info-50 text-info border-royal-100',       icon: Clock },
  validated:   { label: 'Validé',     class: 'bg-success-50 text-success border-success/20', icon: Check },
  sent:        { label: 'Envoyé',     class: 'bg-saffron-50 text-saffron border-saffron/20', icon: Plane },
  won:         { label: 'Gagné',      class: 'bg-success-50 text-success border-success/20', icon: Check },
  lost:        { label: 'Perdu',      class: 'bg-danger-50 text-danger border-danger/20',   icon: X },
}

// ── Tab config ───────────────────────────────────────────────────
const TABS = [
  { id: 'overview',   label: 'Vue d\u2019ensemble', icon: FolderKanban },
  { id: 'quotation',  label: 'Cotation',           icon: Calculator },
  { id: 'itinerary',  label: 'Itinéraire',         icon: MapPin },
  { id: 'invoice',    label: 'Facturation',        icon: Receipt },
  { id: 'exports',    label: 'Exports',            icon: Download },
  { id: 'dna',        label: 'Sécurité & DNA',     icon: ShieldCheck },
] as const
type TabId = typeof TABS[number]['id']

// ── Main component ───────────────────────────────────────────────
export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabId>('overview')
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [showBranding, setShowBranding] = useState(false)

  async function handleShare() {
    const res = await api.post(`/proposals/${projectId}/share`, {})
    const token = res.data.token
    const url = `${window.location.origin}/p/${token}`
    setShareLink(url)
  }

  function copyShareLink() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!).then(r => r.data),
    enabled: !!projectId,
  })

  // Track recent projects for the command palette
  useEffect(() => {
    if (project?.id) {
      recordRecentProject({
        id: project.id,
        name: project.name,
        reference: project.reference,
        client_name: project.client_name,
      })
    }
  }, [project?.id, project?.name, project?.reference, project?.client_name])

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initialisation de la console...</span>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center p-12 bg-white border border-line rounded">
          <AlertTriangle size={48} className="mx-auto mb-4 text-rihla" />
          <h2 className="text-xl font-black text-navy uppercase tracking-tight mb-2">Dossier Introuvable</h2>
          <p className="text-slate-500 text-xs mb-6 uppercase tracking-widest">Référence non répertoriée ou accès refusé.</p>
          <Link to="/projects"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-navy text-white rounded font-bold text-xs uppercase transition-colors">
            <ArrowLeft size={14} /> Revenir à l'inventaire
          </Link>
        </div>
      </div>
    )
  }

  const status = STATUS_MAP[project.status] || STATUS_MAP.draft

  return (
    <div className="animate-fade-in bg-slate-50/30 dark:bg-slate-950 min-h-full pb-20">
      
      {/* HEADER — premium SaaS */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 px-8 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <Link to="/projects" className="hover:text-rihla transition-colors">Projets</Link>
              <ChevronRight size={12} className="text-slate-300" />
              <span className="text-slate-700 dark:text-slate-300 font-mono">{project.reference || project.id.slice(0,8)}</span>
            </div>
            <div className="flex items-center gap-3">
              <CollaborationAvatarGroup projectId={projectId!} />
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <Copy size={12} /> Dupliquer
              </button>
              <button 
                onClick={() => setShowBranding(!showBranding)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <Palette size={12} /> Branding
              </button>
              <button className="btn-primary">
                <Edit3 size={12} /> Modifier
              </button>
            </div>
          </div>

          {/* Title + meta + KPI right */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={clsx(
                  "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide",
                  status.class
                )}>
                  {status.label}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{project.project_type || 'DMC'}</span>
              </div>
              <h1 className="text-[22px] font-semibold text-slate-900 dark:text-cream tracking-tight leading-tight">
                {project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[13px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Building2 size={13} className="text-rihla" /> {project.client_name || 'Client direct'}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-rihla" /> {project.destination || 'Destination non définie'}</span>
                <span className="inline-flex items-center gap-1.5"><Users size={13} className="text-rihla" /> {project.pax_count || 0} pax</span>
                {project.client_country && (
                  <span className="inline-flex items-center gap-1.5"><Flag size={13} className="text-rihla" /> {project.client_country}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 self-start md:self-auto min-w-[280px]">
              <div className="flex items-stretch border border-slate-200/80 dark:border-white/10 rounded-lg overflow-hidden">
                <div className="flex-1 px-4 py-2.5">
                  <p className="text-[11px] text-slate-500">Cotation</p>
                  <p className="text-[15px] font-semibold text-rihla">{quotationData?.[0]?.total_selling?.toLocaleString() || '0'} <span className="text-[11px] text-slate-400">€</span></p>
                </div>
                <div className="w-px bg-slate-200/80 dark:bg-white/10" />
                <div className="flex-1 px-4 py-2.5">
                  <p className="text-[11px] text-slate-500">Factures</p>
                  <p className="text-[15px] font-semibold text-slate-900 dark:text-cream">{invoiceData?.length || 0}</p>
                </div>
              </div>
              {!shareLink ? (
                <button onClick={handleShare}
                  className="btn-primary w-full justify-center">
                  <Share2 size={13} /> Partager au client
                </button>
              ) : (
                <div className="flex items-center gap-2 border border-slate-200/80 dark:border-white/10 rounded-lg p-2">
                  <LinkIcon size={12} className="text-rihla flex-shrink-0" />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate flex-1 font-mono">{shareLink}</span>
                  <button onClick={copyShareLink}
                    className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                    {shareCopied ? '✓ Copié' : 'Copier'}
                  </button>
                  <a href={shareLink} target="_blank" rel="noreferrer"
                    className="flex-shrink-0 text-slate-400 hover:text-rihla transition-colors">
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BRANDING CONFIG PANEL ─────────────────────────────────── */}
      {showBranding && (
        <div className="bg-white dark:bg-slate-900 border-b border-line dark:border-white/5 animate-in slide-in-from-top-4 duration-300">
           <div className="max-w-7xl mx-auto px-8 py-8">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-[10px] font-black text-navy dark:text-cream uppercase tracking-widest flex items-center gap-2">
                    <Palette size={14} className="text-rihla" /> Personnalisation de la proposition
                 </h3>
                 <button onClick={() => setShowBranding(false)} className="text-slate-400 hover:text-navy"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-3 gap-8">
                 <div className="space-y-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Couleur Primaire</label>
                    <div className="flex items-center gap-4">
                       <input 
                         type="color" 
                         value={project.branding_config?.primary_color || '#B08D57'} 
                         onChange={(e) => {
                            const newBranding = { ...(project.branding_config || {}), primary_color: e.target.value }
                            projectsApi.patch(projectId!, { branding_config: newBranding }).then(() => qc.invalidateQueries({ queryKey: ['project', projectId] }))
                         }}
                         className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer"
                       />
                       <span className="font-mono text-xs text-slate-400">{project.branding_config?.primary_color || '#B08D57'}</span>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logo Partenaire (URL)</label>
                    <input 
                      type="text"
                      placeholder="https://..."
                      value={project.branding_config?.logo_url || ''}
                      onChange={(e) => {
                         const newBranding = { ...(project.branding_config || {}), logo_url: e.target.value }
                         projectsApi.patch(projectId!, { branding_config: newBranding }).then(() => qc.invalidateQueries({ queryKey: ['project', projectId] }))
                      }}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-line dark:border-white/10 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-rihla outline-none"
                    />
                 </div>
                 <div className="flex items-center">
                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-line dark:border-white/10 text-center flex-1">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aperçu White-Label</p>
                       <div className="mt-2 flex justify-center">
                          {project.branding_config?.logo_url ? (
                             <img src={project.branding_config.logo_url} className="h-6 object-contain" alt="Logo preview" />
                          ) : (
                             <div className="h-6 w-20 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                          )}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
      {/* WORKFLOW TRACKER */}
      <div className="bg-white border-b border-line px-8 py-3 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['draft', 'in_progress', 'validated', 'sent', 'won'].map((s, i) => {
              const st = STATUS_MAP[s]
              const active = s === project.status
              const past = ['draft','in_progress','validated','sent','won'].indexOf(project.status) > i
              return (
                <div key={s} className="flex items-center">
                  <button
                    onClick={() => !active && statusMutation.mutate(s)}
                    disabled={active}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all border",
                      active ? "bg-navy text-white border-navy shadow-sm" : 
                      past ? "bg-emerald-50 text-emerald-700 border-emerald-200" : 
                      "text-slate-400 border-transparent hover:border-line"
                    )}
                  >
                    <span className={clsx(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[9px] border",
                      active ? "bg-white text-navy border-white" : 
                      past ? "bg-emerald-500 text-white border-emerald-500" : 
                      "bg-slate-100 border-line"
                    )}>
                      {past ? <Check size={10} strokeWidth={4} /> : i + 1}
                    </span>
                    {st.label}
                  </button>
                  {i < 4 && <ChevronRight size={10} className="mx-2 text-line" />}
                </div>
              )
            })}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
             Dernière MAJ: {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : '—'}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 mt-10">
        {/* TABS - PROFESSIONAL CONSOLE STYLE */}
        <div className="flex items-center gap-1 mb-8">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  "flex items-center gap-3 px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-4",
                  active ? "border-rihla text-navy bg-white shadow-sm" : "border-transparent text-slate-400 hover:text-navy hover:bg-slate-100/50"
                )}
              >
                <Icon size={14} className={active ? "text-rihla" : ""} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* TAB CONTENT VIEW */}
        <div className="animate-fade-up">
          {tab === 'overview' && (
            <OverviewTab project={project} quotation={quotationData?.[0]} itinerary={itineraryData?.[0]} invoices={invoiceData} onTab={setTab} />
          )}
          {tab === 'quotation' && (
            <QuotationTab project={project} quotation={quotationData?.[0]} />
          )}
          {tab === 'itinerary' && (
            <ItineraryTab project={project} itinerary={itineraryData?.[0]} />
          )}

          {tab === 'invoice' && (
            <InvoiceTab project={project} invoices={invoiceData} />
          )}
          {tab === 'exports' && (
            <ExportsTab project={project} />
          )}
          {tab === 'dna' && (
            <DnaTab project={project} />
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TAB: DNA & Handover — Security & Permanent Record
// ══════════════════════════════════════════════════════════════════
function DnaTab({ project }: { project: any }) {
  const [checks, setChecks] = useState({
     quotation: true,
     itinerary: true,
     allergies: false,
     guide_notes: false,
     vouchers: false
  })

  const progress = Math.round((Object.values(checks).filter(v => v).length / 5) * 100)

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="grid grid-cols-3 gap-8">
          
          {/* BLACK BOX - PERMANENT RECORD */}
          <div className="col-span-2 space-y-6">
             <div className="bg-slate-900 rounded-[48px] p-10 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                   <Lock size={160} className="text-rihla" />
                </div>
                <div className="relative z-10">
                   <div className="flex items-center gap-3 mb-8">
                      <div className="w-12 h-12 rounded-2xl bg-rihla/20 flex items-center justify-center text-rihla">
                         <History size={24} />
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-white tracking-tight">Voyage DNA Archive</h3>
                         <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Registre Immuable du Circuit</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      {[
                        { time: 'Il y a 2h', event: 'Mise à jour Branding White-Label', user: 'Admin' },
                        { time: 'Hier, 14:20', event: 'Validation Finale Devis v4', user: 'Sonia E.' },
                        { time: '23 Oct', event: 'Ajout notes allergies alimentaires', user: 'Karim B.' },
                        { time: '20 Oct', event: 'Création du dossier source', user: 'System' },
                      ].map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-white/10 transition-all">
                           <div className="flex items-center gap-4">
                              <span className="text-[10px] font-black text-white/20 w-20">{e.time}</span>
                              <p className="text-sm font-bold text-white/80">{e.event}</p>
                           </div>
                           <span className="text-[10px] font-black text-rihla px-3 py-1 bg-rihla/10 rounded-full">{e.user}</span>
                        </div>
                      ))}
                   </div>

                   <div className="mt-10 pt-10 border-t border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <ShieldCheck className="text-emerald-500" size={16} />
                         <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Données chiffrées & redondées</span>
                      </div>
                      <button className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                         <Download size={14} /> Télécharger Black Box PDF
                      </button>
                   </div>
                </div>
             </div>
          </div>

          {/* HANDOVER WIZARD */}
          <div className="col-span-1 space-y-6">
             <div className="bg-white border border-line rounded-[40px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900">
                      <ClipboardCheck size={20} />
                   </div>
                   <h3 className="text-sm font-black uppercase tracking-widest">Handover Ops</h3>
                </div>

                <p className="text-xs text-slate-400 font-medium mb-8">
                   Vérifiez ces points critiques avant de transmettre le dossier aux Opérations.
                </p>

                <div className="space-y-4 mb-10">
                   {[
                     { id: 'quotation', label: 'Cotation validée par client' },
                     { id: 'itinerary', label: 'Itinéraire complet & imagé' },
                     { id: 'allergies', label: 'Checklist Allergies passagers' },
                     { id: 'guide_notes', label: 'Designer Intent (Note Guide)' },
                     { id: 'vouchers', label: 'Vouchers en attente d\'envoi' },
                   ].map((item) => (
                     <button 
                       key={item.id}
                       onClick={() => setChecks(c => ({ ...c, [item.id]: !c[item.id as keyof typeof checks] }))}
                       className="flex items-center justify-between w-full p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-transparent transition-all"
                     >
                        <span className="text-xs font-bold text-slate-700">{item.label}</span>
                        <div className={clsx(
                           "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all",
                           checks[item.id as keyof typeof checks] ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200"
                        )}>
                           {checks[item.id as keyof typeof checks] && <Check size={14} strokeWidth={4} />}
                        </div>
                     </button>
                   ))}
                </div>

                <div className="space-y-2 mb-8">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="text-slate-400">Prêt pour opération</span>
                      <span className={clsx(progress === 100 ? "text-emerald-500" : "text-amber-500")}>{progress}%</span>
                   </div>
                   <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={clsx("h-full transition-all duration-700", progress === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${progress}%` }} />
                   </div>
                </div>

                <button 
                  disabled={progress < 100}
                  className={clsx(
                    "w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl",
                    progress === 100 ? "bg-slate-900 text-white hover:scale-[1.02]" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                  )}
                >
                   <Lock size={16} /> Transmettre aux Ops
                </button>
             </div>

             <div className="p-6 bg-rihla/5 border border-rihla/10 rounded-3xl">
                <div className="flex items-center gap-2 text-rihla font-black text-[10px] uppercase mb-2">
                   <Info size={14} /> Sécurité RIHLA
                </div>
                <p className="text-[11px] text-slate-500 italic leading-relaxed">
                   "Une fois transmis, le dossier est verrouillé en édition pour le designer. Seules les Ops peuvent effectuer des modifs terrain."
                </p>
             </div>
           </div>
        </div>

        {/* Comments thread */}
        <ProjectComments projectId={project?.id || ''} />

        {/* Audit log */}
        <AuditLog projectId={project?.id} />
     </div>
  )
}

// ── Export helper ────────────────────────────────────────────────
async function handleExport(format: string, project: any) {
  try {
    const response = await reportsApi.export({
      report_id: 'project_export',
      report_name: project.name,
      format,
      filters: [{ field: 'project_id', op: '=', value: project.id }],
      settings: { theme: 'stours_classic' }
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${project.name}.${format.toLowerCase()}`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    console.error('Export error:', error)
    alert(`Erreur lors de la génération du ${format}`)
  }
}

// ══════════════════════════════════════════════════════════════════
// TAB: Overview — KPI cards + quick actions + timeline
// ══════════════════════════════════════════════════════════════════
function OverviewTab({ project, quotation, itinerary, invoices, onTab }: any) {
  const modules = [
    {
      title: 'Cotation',
      icon: Calculator,
      color: 'text-rihla',
      bg: 'bg-slate-100',
      status: quotation?.total_selling ? `${quotation.total_selling.toLocaleString()} €` : 'À créer',
      hasData: !!quotation?.id,
      tab: 'quotation' as TabId,
    },
    {
      title: 'Itinéraire',
      icon: MapPin,
      color: 'text-navy',
      bg: 'bg-slate-100',
      status: itinerary?.days?.length ? `${itinerary.days.length} jours rédigés` : 'À créer',
      hasData: !!itinerary?.id,
      tab: 'itinerary' as TabId,
    },
    {
      title: 'Facturation',
      icon: Receipt,
      color: 'text-navy',
      bg: 'bg-slate-100',
      status: invoices?.length ? `${invoices.length} facture(s)` : 'Aucune facture',
      hasData: invoices?.length > 0,
      tab: 'invoice' as TabId,
    },
    {
      title: 'Exports',
      icon: Download,
      color: 'text-rihla',
      bg: 'bg-slate-100',
      status: 'PDF · PPTX · XLSX',
      hasData: false,
      tab: 'exports' as TabId,
    },
  ]

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Module Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {modules.map(m => {
          const Icon = m.icon
          return (
            <button
              key={m.title}
              onClick={() => onTab(m.tab)}
              className="bg-white rounded border border-line shadow-sm p-6 text-left
                         hover:border-rihla/30 hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={clsx("w-10 h-10 rounded flex items-center justify-center", m.bg)}>
                  <Icon size={18} className={m.color} />
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-rihla transition-colors" />
              </div>
              <h3 className="text-xs font-black text-navy uppercase tracking-widest mb-1">{m.title}</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{m.status}</p>
              {m.hasData && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
                  <div className="h-full bg-emerald-500 w-full" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Notes Section */}
        <div className="col-span-8 space-y-6">
          <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-line">
               <h3 className="text-[10px] font-black text-navy uppercase tracking-widest">Notes Opérationnelles</h3>
            </div>
            <div className="p-6">
              {project.notes ? (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.notes}</p>
              ) : (
                <p className="text-xs italic text-slate-400">Aucune note opérationnelle pour ce dossier.</p>
              )}
            </div>
          </div>

          {/* Email Draft Section */}
          <EmailDraftPanel projectId={project.id} initialDraft={project.email_draft} />

          <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-line">
               <h3 className="text-[10px] font-black text-navy uppercase tracking-widest">Actions de Contrôle</h3>
            </div>
            <div className="p-6 flex flex-wrap gap-3">
              <button onClick={() => onTab('quotation')}
                className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-navy-dark transition-all shadow-sm">
                <Calculator size={14} /> Réviser Cotation
              </button>
              <button onClick={() => onTab('itinerary')}
                className="flex items-center gap-2 px-4 py-2 bg-white text-navy border border-line rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">
                <Sparkles size={14} /> Optimisation IA
              </button>
              <button onClick={() => onTab('invoice')}
                className="flex items-center gap-2 px-4 py-2 bg-white text-navy border border-line rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">
                <Receipt size={14} /> Émettre Titre
              </button>
              <button onClick={() => onTab('exports')}
                className="flex items-center gap-2 px-4 py-2 bg-white text-navy border border-line rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">
                <FileText size={14} /> Export Console
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="col-span-4 space-y-6">
           <div className="bg-slate-900 text-white p-6 rounded shadow-lg border border-slate-800">
              <h4 className="text-[10px] font-black text-rihla uppercase tracking-widest mb-4">Statut de Validation</h4>
              <ul className="space-y-4">
                 <li className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white/50 uppercase tracking-tighter">Budget Client</span>
                    <span className="text-emerald-400 uppercase">Validé</span>
                 </li>
                 <li className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white/50 uppercase tracking-tighter">Dispo Hôtels</span>
                    <span className="text-amber-400 uppercase">En attente</span>
                 </li>
                 <li className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white/50 uppercase tracking-tighter">Logistique</span>
                    <span className="text-white/20 uppercase underline decoration-rihla">Non initié</span>
                 </li>
              </ul>
              <button className="mt-8 w-full py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded text-[10px] font-black uppercase tracking-widest">Lancer l'audit de dossier</button>
           </div>
        </div>
      </div>
    </div>
  )
}

// ── Email Draft Panel ──────────────────────────────────────────────
function EmailDraftPanel({ projectId, initialDraft }: { projectId: string; initialDraft?: string }) {
  const [draft, setDraft] = useState(initialDraft || '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await projectsApi.saveEmailDraft(projectId, draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setDraft(text)
    } catch {
      // fallback: the user can manually paste
    }
  }

  return (
    <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
      <div className="px-6 py-3 bg-slate-50 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-rihla" />
          <h3 className="text-[10px] font-black text-navy uppercase tracking-widest">Brouillon Email Client</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePaste}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase tracking-wider transition-all">
            <Copy size={10} /> Coller
          </button>
          <button onClick={handleSave}
                  disabled={saving}
                  className={clsx(
                    'flex items-center gap-1 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all',
                    saved ? 'bg-emerald-50 text-emerald-700' : 'bg-navy text-white hover:bg-navy-dark'
                  )}>
            {saved ? <><Check size={10} /> Sauvegardé</> : saving ? 'Sauvegarde…' : <><Save size={10} /> Sauvegarder</>}
          </button>
        </div>
      </div>
      <div className="p-4">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Collez ici l'email du client pour le garder comme brouillon. Vous pourrez y revenir en cas de besoin pour répondre ou suivre la demande…"
          className="w-full min-h-[120px] bg-slate-50 border border-slate-200 rounded px-4 py-3 text-xs text-slate-700 leading-relaxed focus:ring-2 focus:ring-rihla focus:border-rihla outline-none transition-all resize-y font-mono"
        />
        {draft && (
          <p className="text-[9px] text-slate-400 mt-2 flex items-center gap-1">
            <Mail size={9} /> {draft.length} caractères · Brouillon enregistré pour suivi client
          </p>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TAB: Quotation — embedded pricing engine interface
// ══════════════════════════════════════════════════════════════════
function QuotationTab({ project, quotation }: any) {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-line flex items-center justify-between">
          <h2 className="text-[10px] font-black text-navy uppercase tracking-widest tracking-widest">Moteur de Cotation Consolidé</h2>
          <Link to="/quotations"
            className="flex items-center gap-1.5 text-[10px] font-bold text-rihla hover:underline uppercase tracking-widest">
            Console de Calcul <ExternalLink size={10} />
          </Link>
        </div>

        <div className="p-6">
          {quotation?.id ? (
            <div className="space-y-8">
              {/* OPERATIONAL KPI ROW */}
              <div className="grid grid-cols-3 gap-0 border border-line rounded overflow-hidden">
                <div className="p-5 bg-slate-50 border-r border-line">
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-2">Coût Net / Pax</div>
                  <div className="font-mono text-2xl font-bold text-navy">
                    {quotation.price_per_pax?.toLocaleString()} <span className="text-sm font-normal text-slate-300">€</span>
                  </div>
                </div>
                <div className="p-5 bg-white border-r border-line shadow-inner">
                  <div className="text-[9px] text-rihla uppercase tracking-widest font-black mb-2">Vente / Pax</div>
                  <div className="font-mono text-2xl font-bold text-rihla">
                    {quotation.total_selling ? Math.round(quotation.total_selling / (project.pax_count || 20)).toLocaleString() : '—'} <span className="text-sm font-normal opacity-30">€</span>
                  </div>
                </div>
                <div className="p-5 bg-slate-50">
                  <div className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-2">Valeur Totale Dossier</div>
                  <div className="font-mono text-2xl font-bold text-navy">
                    {quotation.total_selling?.toLocaleString()} <span className="text-sm font-normal text-slate-300">€</span>
                  </div>
                </div>
              </div>

              <div className="p-12 text-center bg-slate-50 border border-line rounded text-xs font-bold text-slate-400 uppercase tracking-widest">
                 Détails de cotation disponibles dans la console de calcul.
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50/50 border-2 border-dashed border-line rounded">
              <Calculator size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-[10px] font-black text-navy uppercase tracking-widest mb-6">Simulation financière manquante</p>
              <Link to="/quotations"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-navy text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-navy-dark transition-all">
                Initialiser Cotation
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ItineraryTab({ project, itinerary }: any) {
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-line flex items-center justify-between">
          <h2 className="text-[10px] font-black text-navy uppercase tracking-widest">Plan d'Opérations (Programme)</h2>
          <Link to="/itineraries"
            className="flex items-center gap-1.5 text-[10px] font-bold text-rihla hover:underline uppercase tracking-widest">
            Éditeur S'TOURS <ExternalLink size={10} />
          </Link>
        </div>

        <div className="p-6">
          {itinerary?.days?.length > 0 ? (
            <div className="relative pl-8 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-px before:bg-line">
              {itinerary.days.map((day: any, i: number) => (
                <div key={day.id || day.day_number} className="mb-10 last:mb-0 relative group">
                  {/* Timeline node */}
                  <div className={clsx(
                    "absolute -left-8 w-6 h-6 rounded bg-white border-2 flex items-center justify-center text-[10px] font-black z-10 transition-colors",
                    day.ai_generated ? "border-rihla text-rihla" : "border-navy text-navy"
                  )}>
                    {day.day_number}
                  </div>
                  
                  {/* Content card */}
                  <div className="bg-white border border-line rounded p-5 hover:border-navy transition-colors">
                    <div className="flex items-center justify-between mb-2">
                       <h4 className="text-xs font-black text-navy uppercase tracking-wider">{day.title}</h4>
                       {day.ai_generated && (
                         <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-tighter flex items-center gap-1">
                           <Sparkles size={10} /> IA Assistée
                         </span>
                       )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                      <span className="flex items-center gap-1.5"><MapPin size={10} className="text-rihla" /> {day.city}</span>
                      {day.hotel && <span className="flex items-center gap-1.5"><Building2 size={10} /> {day.hotel}</span>}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                      {day.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50/50 border-2 border-dashed border-line rounded">
              <MapPin size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-[10px] font-black text-navy uppercase tracking-widest mb-6">Séquençage temporel non défini</p>
              <Link to="/itineraries"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-navy text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-navy-dark transition-all">
                Planifier avec l'IA
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Invoice tab implementation ────────────────────────────────────
function InvoiceTab({ project, invoices }: any) {
  const INV_STATUS: Record<string, { label: string; class: string }> = {
    draft:    { label: 'Brouillon', class: 'bg-slate-100 text-slate-500' },
    issued:   { label: 'Émise',     class: 'bg-blue-50 text-blue-700' },
    sent:     { label: 'Envoyée',   class: 'bg-amber-50 text-amber-700' },
    paid:     { label: 'Réglée',    class: 'bg-emerald-50 text-emerald-700' },
    cancelled:{ label: 'Annulée',   class: 'bg-rose-50 text-rose-700' },
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-line flex items-center justify-between">
          <h2 className="text-[10px] font-black text-navy uppercase tracking-widest">Registre de Facturation</h2>
          <Link to="/invoices"
            className="flex items-center gap-1.5 text-[10px] font-bold text-rihla hover:underline uppercase tracking-widest">
            Flux Comptable <ExternalLink size={10} />
          </Link>
        </div>

        <div className="p-6">
          {invoices?.length > 0 ? (
            <div className="border border-line rounded overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-navy text-white text-[9px] font-black uppercase tracking-[0.2em]">
                    <th className="px-6 py-3 border-r border-white/10">Référence</th>
                    <th className="px-6 py-3 border-r border-white/10">Date Emission</th>
                    <th className="px-6 py-3 border-r border-white/10 text-center">Statut</th>
                    <th className="px-6 py-3 text-right">Montant TTC</th>
                    <th className="px-6 py-3 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {invoices.map((inv: any) => {
                    const st = INV_STATUS[inv.status] || INV_STATUS.draft
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 border-r border-line align-middle">
                           <div className="flex items-center gap-2">
                              <Receipt size={14} className="text-slate-300" />
                              <span className="font-mono text-xs font-bold text-navy">{inv.invoice_number}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 border-r border-line text-[10px] font-bold text-slate-400 uppercase tracking-tight align-middle">
                           {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 border-r border-line text-center align-middle">
                           <span className={clsx("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", st.class)}>
                              {st.label}
                           </span>
                        </td>
                        <td className="px-6 py-4 border-r border-line text-right font-mono font-bold text-navy text-sm align-middle">
                           {inv.total_ttc?.toLocaleString()} <span className="text-[10px] font-normal opacity-40">€</span>
                        </td>
                        <td className="px-6 py-4 text-center align-middle">
                           <button className="p-1.5 text-rihla hover:bg-rihla/10 rounded transition-colors" title="Télécharger PDF">
                              <Download size={14} />
                           </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50/50 border-2 border-dashed border-line rounded">
              <Receipt size={48} className="mx-auto mb-4 text-slate-200" />
              <p className="text-[10px] font-black text-navy uppercase tracking-widest mb-6">Aucun flux financier enregistré</p>
              <Link to="/invoices"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-navy text-white rounded font-bold text-xs uppercase tracking-widest hover:bg-navy-dark transition-all">
                Générer Facture
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ExportsTab({ project }: any) {
  const formats = [
    { ext: 'PDF',  icon: FileText,  color: 'bg-navy',   desc: 'Proposition Client (Format Pro)' },
    { ext: 'DOCX', icon: FileText,  color: 'bg-slate-800',  desc: 'Document Microsoft Word' },
    { ext: 'PPTX', icon: BarChart2, color: 'bg-rihla', desc: 'Présentation PowerPoint' },
    { ext: 'XLSX', icon: BarChart2, color: 'bg-emerald-800',    desc: 'Bordereau de Prix Excel' },
  ]

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-white rounded border border-line shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-line">
          <h2 className="text-[10px] font-black text-navy uppercase tracking-widest">Centre d'Exports Consolidés</h2>
        </div>

        <div className="p-6">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-8">
            Génération de documents conformes à la charte graphique S'TOURS.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formats.map(f => {
              const Icon = f.icon
              return (
                <button key={f.ext}
                  onClick={() => handleExport(f.ext, project)}
                  className="flex items-center gap-4 p-5 rounded border border-line
                             hover:border-navy hover:bg-slate-50 transition-all text-left group">
                  <div className={clsx("w-12 h-12 rounded flex items-center justify-center text-white shadow-sm transition-transform", f.color)}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-xs text-navy uppercase tracking-widest mb-1">{f.ext}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{f.desc}</div>
                  </div>
                  <Download size={14} className="text-slate-300 group-hover:text-rihla transition-colors" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
