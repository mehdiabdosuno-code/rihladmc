import { useEffect, useState } from 'react'
import {
  Plug,
  Plus,
  RefreshCw,
  AlertCircle,
  Check,
  Trash2,
  Pencil,
  X,
  Loader2,
  ShieldCheck,
  TestTube2,
  Server,
  ExternalLink,
} from 'lucide-react'
import { erpApi } from '@/lib/api'
import type {
  ErpConfig,
  ErpConfigPayload,
  ErpPushLog,
} from '@/lib/api'

const KIND_LABEL: Record<ErpConfig['kind'], string> = {
  sap_s4hana: 'SAP S/4HANA Cloud',
  sap_business_one: 'SAP Business One',
}

const EMPTY_PAYLOAD: ErpConfigPayload = {
  client_key: '',
  label: '',
  kind: 'sap_s4hana',
  base_url: '',
  is_dry_run: true,
  is_active: true,
  notes: '',
  oauth_token_url: '',
  oauth_client_id: '',
  oauth_client_secret: '',
  oauth_scope: '',
  b1_company_db: '',
  b1_username: '',
  b1_password: '',
}

export function ErpIntegrationsPage() {
  const [items, setItems] = useState<ErpConfig[]>([])
  const [logs, setLogs] = useState<ErpPushLog[]>([])
  const [loading, setLoading] = useState(false)
  const [editor, setEditor] = useState<{ open: boolean; id: string | null; payload: ErpConfigPayload }>({
    open: false,
    id: null,
    payload: EMPTY_PAYLOAD,
  })
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const [cfgs, lgs] = await Promise.all([
        erpApi.listConfigs(),
        erpApi.listLogs({ limit: 25 }).catch(() => ({ data: [] as ErpPushLog[] })),
      ])
      setItems(cfgs.data)
      setLogs(lgs.data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMsg({ kind: 'err', text: err.response?.data?.detail || 'Échec chargement' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const openCreate = () => setEditor({ open: true, id: null, payload: { ...EMPTY_PAYLOAD } })

  const openEdit = (cfg: ErpConfig) => {
    setEditor({
      open: true,
      id: cfg.id,
      payload: {
        client_key: cfg.client_key,
        label: cfg.label,
        kind: cfg.kind,
        base_url: cfg.base_url ?? '',
        is_dry_run: cfg.is_dry_run,
        is_active: cfg.is_active,
        notes: cfg.notes ?? '',
        oauth_token_url: cfg.oauth_token_url ?? '',
        oauth_client_id: cfg.oauth_client_id ?? '',
        oauth_client_secret: '',
        oauth_scope: cfg.oauth_scope ?? '',
        b1_company_db: cfg.b1_company_db ?? '',
        b1_username: cfg.b1_username ?? '',
        b1_password: '',
      },
    })
  }

  const closeEditor = () => setEditor({ open: false, id: null, payload: EMPTY_PAYLOAD })

  const save = async () => {
    setLoading(true)
    try {
      const p = editor.payload
      const cleaned: ErpConfigPayload = {
        ...p,
        oauth_client_secret: p.oauth_client_secret || undefined,
        b1_password: p.b1_password || undefined,
      }
      if (editor.id) {
        await erpApi.updateConfig(editor.id, cleaned)
        setMsg({ kind: 'ok', text: 'Configuration mise à jour' })
      } else {
        await erpApi.createConfig(cleaned)
        setMsg({ kind: 'ok', text: 'Configuration créée' })
      }
      closeEditor()
      await refresh()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMsg({ kind: 'err', text: err.response?.data?.detail || 'Échec enregistrement' })
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette configuration ERP ?')) return
    setLoading(true)
    try {
      await erpApi.deleteConfig(id)
      setMsg({ kind: 'ok', text: 'Configuration supprimée' })
      await refresh()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setMsg({ kind: 'err', text: err.response?.data?.detail || 'Échec suppression' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-[1200px] mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rihla/10 flex items-center justify-center">
              <Plug className="w-5 h-5 text-rihla" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-900">ERP Client (SAP)</h1>
              <p className="text-xs text-slate-500">
                Configurez les ERP de vos clients pour pousser automatiquement les factures (SAP S/4HANA Cloud · SAP Business One).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Rafraîchir
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rihla rounded-lg shadow-sm hover:bg-rihla/90"
            >
              <Plus size={12} /> Nouvelle configuration
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`mb-4 flex items-start gap-2 p-3 rounded-lg text-sm border ${
              msg.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {msg.kind === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
            <div className="flex-1">{msg.text}</div>
            <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-slate-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Configs list */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Configurations</h2>
            <span className="text-[11px] text-slate-500">{items.length} entrée(s)</span>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Server className="w-8 h-8 mx-auto text-slate-300 mb-3" />
              <div className="text-sm font-semibold text-slate-700 mb-1">
                Aucune configuration ERP
              </div>
              <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
                Créez une première configuration en mode <strong>dry-run</strong> pour tester
                le push factures sans tenant SAP réel. Les credentials SAP pourront être
                ajoutés ensuite, sans impact sur RIHLA.
              </p>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rihla rounded-lg shadow-sm hover:bg-rihla/90"
              >
                <Plus size={12} /> Créer une configuration
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((cfg) => (
                <div key={cfg.id} className="px-4 py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {cfg.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {KIND_LABEL[cfg.kind]}
                      </span>
                      {cfg.is_dry_run ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <TestTube2 size={10} /> Dry-run
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck size={10} /> Live
                        </span>
                      )}
                      {!cfg.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      <span className="font-mono text-[11px]">client_key={cfg.client_key}</span>
                      {cfg.base_url && <> · {cfg.base_url}</>}
                    </div>
                    {cfg.notes && (
                      <div className="mt-1 text-[11px] text-slate-400 truncate">{cfg.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(cfg)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(cfg.id)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent logs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Derniers push (audit)</h2>
            <a
              href="/invoices"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rihla hover:underline"
            >
              Aller aux factures <ExternalLink size={11} />
            </a>
          </div>
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              Aucun push enregistré
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((lg) => (
                <div key={lg.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                  <StatusBadge status={lg.status} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] text-slate-600 truncate">
                      {lg.kind} · invoice {lg.invoice_id.slice(0, 8)}
                      {lg.is_dry_run && <span className="ml-2 text-amber-600 font-bold">[dry-run]</span>}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {lg.created_at && new Date(lg.created_at).toLocaleString('fr-FR')}
                      {lg.duration_ms != null && ` · ${lg.duration_ms} ms`}
                      {lg.remote_ref && ` · ref ${lg.remote_ref}`}
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

      {/* Editor modal */}
      {editor.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {editor.id ? 'Modifier la configuration' : 'Nouvelle configuration ERP'}
              </h3>
              <button
                onClick={closeEditor}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client key (slug)">
                  <input
                    value={editor.payload.client_key}
                    onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, client_key: e.target.value } })}
                    placeholder="acme-fr"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </Field>
                <Field label="Label affiché">
                  <input
                    value={editor.payload.label}
                    onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, label: e.target.value } })}
                    placeholder="ACME France · S/4HANA Prod"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type d'ERP">
                  <select
                    value={editor.payload.kind}
                    onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, kind: e.target.value as ErpConfig['kind'] } })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="sap_s4hana">SAP S/4HANA Cloud</option>
                    <option value="sap_business_one">SAP Business One</option>
                  </select>
                </Field>
                <Field label="Base URL">
                  <input
                    value={editor.payload.base_url ?? ''}
                    onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, base_url: e.target.value } })}
                    placeholder="https://my.s4hana.cloud.sap"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={!!editor.payload.is_dry_run}
                    onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, is_dry_run: e.target.checked } })}
                    className="w-4 h-4"
                  />
                  Mode dry-run (mock — aucune requête réelle)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={!!editor.payload.is_active}
                    onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, is_active: e.target.checked } })}
                    className="w-4 h-4"
                  />
                  Configuration active
                </label>
              </div>

              {editor.payload.kind === 'sap_s4hana' ? (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Auth OAuth2 (S/4HANA Cloud)
                  </div>
                  <Field label="Token URL">
                    <input
                      value={editor.payload.oauth_token_url ?? ''}
                      onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, oauth_token_url: e.target.value } })}
                      placeholder="https://<tenant>.authentication.eu10.hana.ondemand.com/oauth/token"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Client ID">
                      <input
                        value={editor.payload.oauth_client_id ?? ''}
                        onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, oauth_client_id: e.target.value } })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </Field>
                    <Field label="Scope (optionnel)">
                      <input
                        value={editor.payload.oauth_scope ?? ''}
                        onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, oauth_scope: e.target.value } })}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </Field>
                  </div>
                  <Field label={editor.id ? 'Client Secret (laisser vide = inchangé)' : 'Client Secret'}>
                    <input
                      type="password"
                      value={editor.payload.oauth_client_secret ?? ''}
                      onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, oauth_client_secret: e.target.value } })}
                      placeholder="•••••••••"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                    />
                  </Field>
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Auth Service Layer (Business One)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Company DB">
                      <input
                        value={editor.payload.b1_company_db ?? ''}
                        onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, b1_company_db: e.target.value } })}
                        placeholder="SBODEMOFR"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </Field>
                    <Field label="Username">
                      <input
                        value={editor.payload.b1_username ?? ''}
                        onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, b1_username: e.target.value } })}
                        placeholder="manager"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </Field>
                  </div>
                  <Field label={editor.id ? 'Password (laisser vide = inchangé)' : 'Password'}>
                    <input
                      type="password"
                      value={editor.payload.b1_password ?? ''}
                      onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, b1_password: e.target.value } })}
                      placeholder="•••••••••"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                    />
                  </Field>
                </div>
              )}

              <Field label="Notes (interne)">
                <textarea
                  value={editor.payload.notes ?? ''}
                  onChange={(e) => setEditor({ ...editor, payload: { ...editor.payload, notes: e.target.value } })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </Field>
            </div>
            <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={closeEditor}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={loading || !editor.payload.client_key || !editor.payload.label}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rihla rounded-lg shadow-sm hover:bg-rihla/90 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
        {label}
      </span>
      {children}
    </label>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'success' | 'failed' }) {
  const map = {
    success: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OK' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'KO' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: '…' },
  }
  const m = map[status]
  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-black ${m.bg} ${m.text} flex-shrink-0`}>
      {m.label}
    </span>
  )
}

export default ErpIntegrationsPage
