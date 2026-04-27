import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Download, FileText, CheckCircle, Clock, XCircle, Banknote, Plug, Loader2, X, TestTube2, ShieldCheck } from 'lucide-react'
import { invoicesApi, projectsApi, erpApi } from '@/lib/api'
import type { ErpConfig, ErpPushLog, ErpPushResult } from '@/lib/api'
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
  const [erpModal,     setErpModal]     = useState<any | null>(null)

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
                        <button
                          onClick={() => setErpModal(inv)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white
                                     rounded-brand text-xs font-semibold hover:bg-slate-700
                                     transition-colors"
                          title="Pousser vers l'ERP du client (SAP)"
                        >
                          <Plug size={11} /> ERP
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

      {erpModal && (
        <ErpPushModal invoice={erpModal} onClose={() => setErpModal(null)} />
      )}
    </div>
  )
}

// ── ERP push modal ───────────────────────────────────────────────
function ErpPushModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const [configs, setConfigs] = useState<ErpConfig[]>([])
  const [logs,    setLogs]    = useState<ErpPushLog[]>([])
  const [selectedCfg, setSelectedCfg] = useState<string>('')
  const [pushing,  setPushing]  = useState(false)
  const [force,    setForce]    = useState(false)
  const [result,   setResult]   = useState<ErpPushResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const refreshLogs = async () => {
    try {
      const r = await erpApi.listLogs({ invoice_id: invoice.id, limit: 10 })
      setLogs(r.data)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    erpApi.listConfigs({ is_active: true })
      .then(r => {
        setConfigs(r.data)
        if (r.data.length === 1) setSelectedCfg(r.data[0].id)
      })
      .catch(() => {})
    refreshLogs()
  }, [invoice.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePush = async () => {
    setPushing(true)
    setError(null)
    setResult(null)
    try {
      const r = await erpApi.pushInvoice(invoice.id, {
        config_id: selectedCfg || undefined,
        force,
      })
      setResult(r.data)
      await refreshLogs()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Échec du push')
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Pousser la facture vers l'ERP</h3>
            <p className="text-[11px] text-slate-500 font-mono">{invoice.number} · {invoice.client_name || '–'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {configs.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              Aucune configuration ERP active. Rendez-vous sur{' '}
              <a href="/erp-integrations" className="font-semibold underline">ERP Client (SAP)</a>{' '}
              pour en créer une (mode dry-run disponible pour tester sans tenant SAP).
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                  Configuration ERP cible
                </span>
                <select
                  value={selectedCfg}
                  onChange={(e) => setSelectedCfg(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">— Auto (par client / défaut) —</option>
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} · {c.kind === 'sap_s4hana' ? 'S/4HANA' : 'Business One'}
                      {c.is_dry_run ? ' (dry-run)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="w-4 h-4"
                />
                Forcer le re-push (ignore l'idempotence — utile après modification de la facture)
              </label>
              <button
                onClick={handlePush}
                disabled={pushing}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-700 disabled:opacity-50"
              >
                {pushing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                Envoyer vers l'ERP
              </button>
            </>
          )}

          {result && (
            <div
              className={`rounded-lg p-3 text-xs border ${
                result.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1 font-semibold">
                {result.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {result.status === 'success' ? 'Push réussi' : 'Push échoué'}
                {result.is_dry_run && (
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-200 text-amber-900 flex items-center gap-1">
                    <TestTube2 size={9} /> Dry-run
                  </span>
                )}
              </div>
              <div className="font-mono text-[11px]">
                HTTP {result.http_status ?? '–'} · {result.duration_ms ?? '–'} ms
                {result.remote_ref && <> · ref {result.remote_ref}</>}
              </div>
              {result.error_message && <div className="mt-1">{result.error_message}</div>}
            </div>
          )}
          {error && (
            <div className="rounded-lg p-3 text-xs border bg-red-50 border-red-200 text-red-800">
              {error}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
              Historique <span className="text-slate-300">·</span>
              <span className="font-normal lowercase tracking-normal text-slate-400">
                {logs.length} push enregistré(s)
              </span>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun push pour cette facture</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                {logs.map((lg) => (
                  <div key={lg.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                    <span
                      className={`px-2 py-1 rounded-md text-[10px] font-black flex-shrink-0 ${
                        lg.status === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : lg.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {lg.status === 'success' ? 'OK' : lg.status === 'failed' ? 'KO' : '…'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-slate-700 truncate">
                        {lg.kind} {lg.is_dry_run && <span className="text-amber-600 font-bold">[dry-run]</span>}
                        {lg.remote_ref && <> · ref {lg.remote_ref}</>}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {lg.created_at && new Date(lg.created_at).toLocaleString('fr-FR')}
                        {lg.duration_ms != null && ` · ${lg.duration_ms} ms`}
                      </div>
                      {lg.error_message && (
                        <div className="text-[11px] text-red-600 truncate">{lg.error_message}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
