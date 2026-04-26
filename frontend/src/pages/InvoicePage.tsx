import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, FileText, CheckCircle, Clock, XCircle, Banknote } from 'lucide-react'
import { invoicesApi, projectsApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner, SectionTitle, StatusBadge } from '@/components/ui'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Status config ─────────────────────────────────────────────────
const INV_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  draft:     { label: 'Brouillon', color: 'bg-warm text-muted border border-line', icon: Clock },
  issued:    { label: 'Émise',     color: 'bg-royal-50 text-royal',                icon: FileText },
  sent:      { label: 'Envoyée',   color: 'bg-amber-50 text-amber-700',            icon: FileText },
  paid:      { label: 'Réglée',    color: 'bg-green-50 text-green-700',            icon: CheckCircle },
  cancelled: { label: 'Annulée',   color: 'bg-red-50 text-red-600',               icon: XCircle },
}

const CURRENCY_SYM: Record<string, string> = { EUR:'€', USD:'$', GBP:'£', MAD:'MAD' }
const fmtMoney = (v: number | string, cur = 'EUR') => {
  const sym = CURRENCY_SYM[cur] ?? cur
  return `${sym} ${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtDate = (d?: string) => {
  if (!d) return '–'
  try { return format(new Date(d), 'dd MMM yyyy', { locale: fr }) }
  catch { return d }
}

// ── Invoice status badge ──────────────────────────────────────────
function InvBadge({ status }: { status: string }) {
  const cfg = INV_STATUS[status] ?? INV_STATUS.draft
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill
                      text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
      {status}
    </span>
  )
}

// ── Quick create form ─────────────────────────────────────────────
function QuickCreate({ projects, onCreated }: { projects: any[]; onCreated: () => void }) {
  const [projectId, setProjectId] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [mode,      setMode]      = useState<'auto'|'manual'>('auto')

  const handleCreate = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      if (mode === 'auto') {
        await invoicesApi.fromProject(projectId)
      } else {
        const p = projects.find(x => x.id === projectId)
        await invoicesApi.create({
          project_id:    projectId,
          client_name:   p?.client_name || '',
          client_email:  p?.client_email || '',
          currency:      p?.currency || 'EUR',
          pax_count:     p?.pax_count,
          travel_dates:  p?.travel_dates || '',
          subtotal:      0, tax_rate: 0, deposit_pct: 30,
        })
      }
      onCreated()
      setProjectId('')
    } catch (e: any) {
      alert(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 mb-6">
      <SectionTitle>Créer une facture</SectionTitle>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <select className="input-base" value={projectId}
                  onChange={e => setProjectId(e.target.value)}>
            <option value="">Sélectionner un projet…</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.client_name ? `— ${p.client_name}` : ''}
                <span className={p.status === 'won' ? ' ★ CONFIRMÉ' : ''}></span>
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 bg-warm border border-line rounded-brand p-1">
          {(['auto','manual'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-[7px] text-xs font-semibold transition-all
                ${mode === m ? 'bg-bordeaux text-warm' : 'text-muted hover:text-ink'}`}>
              {m === 'auto' ? '⚡ Auto depuis cotation' : '✎ Manuelle'}
            </button>
          ))}
        </div>
        <button onClick={handleCreate} disabled={!projectId || loading}
          className="btn-primary">
          {loading ? <Spinner size={14} className="text-warm" /> : <Plus size={14} />}
          Créer facture
        </button>
      </div>
      {mode === 'auto' && (
        <p className="text-xs text-muted mt-2">
          ✦ Mode auto : récupère la dernière cotation validée du projet et génère la facture complète.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export function InvoicePage() {
  const qc = useQueryClient()
  const [selected,     setSelected]     = useState<any | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [downloading,  setDownloading]  = useState<string | null>(null)

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => projectsApi.list({ limit: 200 }).then(r => r.data?.items ?? []),
  })

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['invoices', filterStatus],
    queryFn:  () => invoicesApi.list({ status: filterStatus || undefined, limit: 200 }).then(r => r.data),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      invoicesApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })

  const downloadPdf = async (inv: any) => {
    setDownloading(inv.id)
    try {
      const res = await invoicesApi.generatePdf(inv.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a   = document.createElement('a')
      a.href     = url
      a.download = `Facture_${inv.number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      qc.invalidateQueries({ queryKey: ['invoices'] })
    } catch (e: any) {
      alert(`Erreur PDF: ${e.message}`)
    } finally {
      setDownloading(null)
    }
  }

  // Summary stats
  const total       = invoices?.length || 0
  const totalAmount = invoices?.reduce((a: number, i: any) => a + Number(i.total), 0) || 0
  const paid        = invoices?.filter((i: any) => i.status === 'paid').length || 0
  const paidAmount  = invoices?.filter((i: any) => i.status === 'paid')
                               .reduce((a: number, i: any) => a + Number(i.total), 0) || 0

  return (
    <div className="min-h-full">
      <PageHeader
        title="Facturation"
        subtitle="Générer et gérer les factures clients — format RIHLA / S'TOURS"
      />

      <div className="p-8">
        <QuickCreate projects={projects || []} onCreated={() => refetch()} />

        <div className="flex justify-end mb-6">
          <button 
            onClick={async () => {
              if (!invoices?.length) return
              const ids = invoices.map((i: any) => i.id)
              const res = await invoicesApi.exportErp(ids)
              const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
              const a   = document.createElement('a')
              a.href     = url
              a.download = `Export_ERP_Sage_${new Date().toISOString().split('T')[0]}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            disabled={!invoices?.length}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50"
          >
            <Download size={16} /> Exporter vers ERP (Sage)
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Factures totales', value: total,                       sub: 'tous statuts',   icon: FileText   },
            { label: 'Montant total',    value: fmtMoney(totalAmount, 'EUR'),sub: 'TTC',            icon: Banknote   },
            { label: 'Réglées',         value: paid,                        sub: 'factures payées', icon: CheckCircle },
            { label: 'Montant encaissé',value: fmtMoney(paidAmount, 'EUR'),  sub: 'confirmé',       icon: CheckCircle },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-label text-muted">{label}</p>
                <div className="w-7 h-7 bg-warm border border-line rounded-brand
                                flex items-center justify-center">
                  <Icon size={13} className="text-bordeaux" />
                </div>
              </div>
              <p className="font-serif text-2xl font-bold text-ink">{value}</p>
              <p className="text-xs text-muted mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          {['', 'draft', 'issued', 'sent', 'paid', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-brand text-xs font-semibold transition-all
                ${filterStatus === s
                  ? 'bg-bordeaux text-warm'
                  : 'text-muted hover:text-ink hover:bg-warm border border-transparent hover:border-line'}`}>
              {s === '' ? 'Toutes' : INV_STATUS[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="h-4 flex-1 bg-slate-200/70 dark:bg-white/5 rounded" />
                  <div className="h-4 w-24 bg-slate-200/70 dark:bg-white/5 rounded" />
                  <div className="h-4 w-20 bg-slate-200/70 dark:bg-white/5 rounded" />
                  <div className="h-4 w-16 bg-slate-200/70 dark:bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : !invoices?.length ? (
            <div className="text-center py-12 text-muted">
              <FileText size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune facture {filterStatus ? `avec statut "${filterStatus}"` : ''}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  {['Numéro', 'Client', 'Montant TTC', 'Acompte', 'Solde', 'Date', 'Statut', ''].map(h => (
                    <th key={h} className="text-left text-label text-muted px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id}
                      className="border-b border-line/50 hover:bg-warm/40 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-ink text-xs">{inv.number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{inv.client_name || '–'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-ink">
                        {fmtMoney(inv.total, inv.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {fmtMoney(Number(inv.total) * 0.3, inv.currency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-royal font-semibold">
                      {fmtMoney(Number(inv.total) * 0.7, inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {inv.created_at ? fmtDate(inv.created_at.split('T')[0]) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative group/status">
                        <InvBadge status={inv.status} />
                        {/* Quick status change dropdown */}
                        <select
                          className="absolute inset-0 opacity-0 cursor-pointer w-full"
                          value={inv.status}
                          onChange={e => updateStatus.mutate({ id: inv.id, status: e.target.value })}
                        >
                          {Object.entries(INV_STATUS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                                      transition-opacity">
                        <button
                          onClick={() => downloadPdf(inv)}
                          disabled={downloading === inv.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-bordeaux text-warm
                                     rounded-brand text-xs font-semibold hover:bg-bordeaux-dark
                                     transition-colors disabled:opacity-50"
                          title="Télécharger PDF"
                        >
                          {downloading === inv.id
                            ? <Spinner size={11} className="text-warm" />
                            : <Download size={11} />}
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
