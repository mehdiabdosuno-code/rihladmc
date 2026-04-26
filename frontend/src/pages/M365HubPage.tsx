import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Mail, Folder, FolderPlus, Send, MessageSquare, RefreshCw, Plug, Trash2,
  FileText, Inbox, ArrowUpRight, Sparkles, Cloud, Loader2, Link as LinkIcon,
} from 'lucide-react'
import { m365Api, type M365Dashboard, type M365MailMessage, type M365DriveFile, type M365Connection } from '@/lib/api'

const TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: Sparkles },
  { id: 'mail',     label: 'Outlook Mail',   icon: Mail },
  { id: 'drive',    label: 'SharePoint',     icon: Cloud },
  { id: 'teams',    label: 'Teams',          icon: MessageSquare },
  { id: 'connections', label: 'Comptes',     icon: Plug },
] as const
type TabId = typeof TABS[number]['id']

function fmtSize(n: number | null | undefined): string {
  if (!n) return '—'
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`
  return `${(n / 1024 / 1024).toFixed(1)} Mo`
}
function fmtRel(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  const diff = (Date.now() - d.getTime()) / 1000 / 60
  if (diff < 60) return `il y a ${Math.round(diff)} min`
  if (diff < 60 * 24) return `il y a ${Math.round(diff / 60)} h`
  return d.toLocaleDateString('fr-FR')
}

export function M365HubPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<TabId>('overview')
  const [dash, setDash] = useState<M365Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [drivePath, setDrivePath] = useState('/RIHLA/Dossiers')
  const [driveFiles, setDriveFiles] = useState<M365DriveFile[]>([])
  const [driveLoading, setDriveLoading] = useState(false)
  const [mailFilter, setMailFilter] = useState<'all' | 'linked' | 'sent'>('all')
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' })
  const [sending, setSending] = useState(false)
  const [teamsDraft, setTeamsDraft] = useState({
    title: 'Nouveau devis validé',
    message: 'Le devis QUO-2026-0042 vient d\'être validé par Voyageurs Élite.',
  })
  const [teamsSent, setTeamsSent] = useState<{ status: string, is_demo: boolean } | null>(null)

  const banner = params.get('connected') === 'demo'
    ? 'Compte de démonstration connecté avec succès.'
    : params.get('connected') === '1'
      ? 'Compte Microsoft 365 connecté avec succès.'
      : params.get('error')
        ? `Erreur OAuth : ${params.get('error')}`
        : null

  async function refresh() {
    setLoading(true)
    try {
      const { data } = await m365Api.dashboard()
      setDash(data)
    } finally {
      setLoading(false)
    }
  }

  async function loadDrive(path: string) {
    setDriveLoading(true)
    try {
      const { data } = await m365Api.driveList(path)
      setDriveFiles(data)
      setDrivePath(path)
    } finally {
      setDriveLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (tab === 'drive' && driveFiles.length === 0) loadDrive(drivePath)
  }, [tab])

  async function handleConnect() {
    setConnecting(true)
    try {
      const { data } = await m365Api.oauthStart()
      const url = data.auth_url.startsWith('/api/')
        ? `${(import.meta as any).env?.VITE_API_URL ?? ''}${data.auth_url}`
        : data.auth_url
      window.location.href = url
    } catch {
      setConnecting(false)
    }
  }

  async function handleDisconnect(c: M365Connection) {
    if (!confirm(`Déconnecter ${c.account_email} ?`)) return
    await m365Api.disconnect(c.id)
    await refresh()
  }

  async function handleSend() {
    if (!draft.to || !draft.subject) return
    setSending(true)
    try {
      await m365Api.sendMail({
        to: draft.to.split(',').map(x => x.trim()).filter(Boolean),
        subject: draft.subject,
        body: draft.body,
      })
      setComposing(false)
      setDraft({ to: '', subject: '', body: '' })
      await refresh()
    } finally {
      setSending(false)
    }
  }

  async function handleTeamsNotify() {
    const { data } = await m365Api.teamsNotify({
      title: teamsDraft.title,
      message: teamsDraft.message,
      color: '1f6feb',
      facts: [
        { name: 'Source', value: 'RIHLA · Dashboard' },
        { name: 'Émetteur', value: dash?.connection.account_email || '—' },
      ],
      action_url: 'https://stoursvoyages.sharepoint.com/sites/RIHLA',
      action_label: 'Ouvrir le dossier',
    })
    setTeamsSent(data as any)
    setTimeout(() => setTeamsSent(null), 3500)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement de l'intégration Microsoft 365…
        </div>
      </div>
    )
  }
  if (!dash) return null

  const inbox = mailFilter === 'sent'
    ? dash.recent_sent
    : mailFilter === 'linked'
      ? dash.linked_inbox
      : dash.recent_inbox

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold leading-tight">Microsoft 365 — intégration unifiée</h1>
            <p className="text-sm text-slate-500">Outlook Mail + Calendar + SharePoint + Teams · multi-comptes par Travel Designer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${dash.is_real ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {dash.is_real ? 'Mode réel · Azure AD configuré' : 'Mode démo'}
          </span>
          <button
            onClick={refresh}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
        </div>
      </header>

      {banner && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-800 px-4 py-2.5 text-sm">
          {banner}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-2 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm flex items-center gap-2 border-b-2 transition-colors ${
              tab === t.id ? 'border-indigo-600 text-indigo-700 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <KPI label="Comptes connectés" value={String(dash.connection ? 1 : 0)} icon={Plug} />
            <KPI label="Messages non lus" value={String(dash.inbox_unread)} icon={Inbox} accent="amber" />
            <KPI label="Liés à un dossier" value={String(dash.linked_inbox.length)} icon={LinkIcon} accent="indigo" />
            <KPI label="SharePoint" value={dash.sharepoint_configured ? 'Configuré' : 'Démo'} icon={Cloud}
                 accent={dash.sharepoint_configured ? 'emerald' : 'slate'} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Activités récentes
            </div>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>{dash.connection.account_email}</strong> · synchronisation OK</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>{dash.recent_inbox.length} email(s) reçus dans la dernière période</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{dash.linked_inbox.length} email(s) auto-rattachés à un dossier</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>{dash.drive_root.length} dossier(s) racine SharePoint accessibles</span>
              </li>
            </ul>
          </div>

          {/* Recent inbox preview */}
          <div className="md:col-span-3 rounded-xl border border-slate-200 bg-white">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2">
                <Inbox className="w-4 h-4 text-slate-500" /> Boîte de réception (extrait)
              </div>
              <button onClick={() => setTab('mail')} className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                Tout voir <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {dash.recent_inbox.slice(0, 4).map(m => (
                <MailRow key={m.id} m={m} />
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Mail tab */}
      {tab === 'mail' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'linked', 'sent'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setMailFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full ${
                    mailFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all' ? 'Inbox' : f === 'linked' ? 'Liés à un dossier' : 'Envoyés'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setComposing(true)}
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Nouvel email
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {inbox.length === 0 && (
                <li className="px-5 py-10 text-center text-sm text-slate-500">Aucun message à afficher.</li>
              )}
              {inbox.map(m => <MailRow key={m.id} m={m} />)}
            </ul>
          </div>

          {composing && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setComposing(false)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="font-medium">Nouvel email</div>
                  <button onClick={() => setComposing(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">À (séparés par virgule)</label>
                    <input
                      value={draft.to}
                      onChange={e => setDraft({ ...draft, to: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                      placeholder="contact@client.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Objet</label>
                    <input
                      value={draft.subject}
                      onChange={e => setDraft({ ...draft, subject: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Message</label>
                    <textarea
                      value={draft.body}
                      onChange={e => setDraft({ ...draft, body: e.target.value })}
                      rows={6}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => setComposing(false)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Annuler</button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !draft.to || !draft.subject}
                    className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Envoyer{!dash.is_real && ' (demo)'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drive tab */}
      {tab === 'drive' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <Cloud className="w-4 h-4" /> {dash.sharepoint_configured ? 'SharePoint Online · stoursvoyages' : 'SharePoint (démo)'}
              <code className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded">{drivePath}</code>
            </div>
            <div className="flex items-center gap-2">
              {drivePath !== '/RIHLA/Dossiers' && (
                <button
                  onClick={() => loadDrive(drivePath.split('/').slice(0, -1).join('/') || '/RIHLA/Dossiers')}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  ← Remonter
                </button>
              )}
              <button
                onClick={() => loadDrive(drivePath)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recharger
              </button>
            </div>
          </div>

          {driveLoading ? (
            <div className="text-sm text-slate-500 flex items-center gap-2 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2.5">Nom</th>
                    <th className="text-left px-4 py-2.5">Type</th>
                    <th className="text-right px-4 py-2.5">Taille</th>
                    <th className="text-right px-4 py-2.5">Modifié</th>
                    <th className="text-right px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {driveFiles.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Dossier vide.</td></tr>
                  )}
                  {driveFiles.map(f => (
                    <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {f.folder
                            ? <Folder className="w-4 h-4 text-amber-500" />
                            : <FileText className="w-4 h-4 text-slate-400" />}
                          {f.folder ? (
                            <button onClick={() => loadDrive(`${drivePath === '/' ? '' : drivePath}/${f.name}`)} className="hover:underline text-slate-800">
                              {f.name}
                            </button>
                          ) : <span>{f.name}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {f.folder ? 'Dossier' : f.mime_type?.includes('pdf') ? 'PDF' : f.mime_type?.includes('word') ? 'Word' : 'Fichier'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500">{f.folder ? '—' : fmtSize(f.size)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500">{fmtRel(f.modified_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {f.web_url && (
                          <a href={f.web_url} target="_blank" rel="noreferrer"
                             className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                            Ouvrir <ArrowUpRight className="w-3 h-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 flex items-start gap-3">
            <FolderPlus className="w-5 h-5 text-slate-400 mt-0.5" />
            <div className="text-sm text-slate-600">
              <strong>Provisioning auto :</strong> chaque nouveau dossier RIHLA déclenche la création d'une arborescence SharePoint
              <code className="mx-1 text-xs bg-white px-1.5 py-0.5 rounded">/RIHLA/Dossiers/&#123;projet&#125;/</code>
              avec sous-dossiers <em>Devis · Contrats · Factures · Vouchers · Photos client</em>.
            </div>
          </div>
        </div>
      )}

      {/* Teams tab */}
      {tab === 'teams' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-600" /> Notification de canal
            </h3>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Titre</label>
              <input
                value={teamsDraft.title}
                onChange={e => setTeamsDraft({ ...teamsDraft, title: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Message</label>
              <textarea
                value={teamsDraft.message}
                onChange={e => setTeamsDraft({ ...teamsDraft, message: e.target.value })}
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleTeamsNotify}
              className="w-full text-sm px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Envoyer dans Teams{!dash.teams_configured && ' (demo)'}
            </button>
            {teamsSent && (
              <div className={`text-xs px-3 py-2 rounded-lg ${teamsSent.is_demo ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                {teamsSent.is_demo
                  ? 'Notification simulée (mode démo) — configurer TEAMS_WEBHOOK_URL pour envoi réel.'
                  : 'Notification envoyée dans le canal Teams.'}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600" /> Triggers automatiques
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Liste des évènements RIHLA qui poussent automatiquement une notification dans le canal Teams configuré.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Devis validé par client</span>
                <span className="text-xs text-emerald-600">activé</span>
              </li>
              <li className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Paiement reçu (Stripe / CMI)</span>
                <span className="text-xs text-emerald-600">activé</span>
              </li>
              <li className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Escalade Agent Acompte (J+10)</span>
                <span className="text-xs text-emerald-600">activé</span>
              </li>
              <li className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>Alerte fournisseur (incident, score &lt; 60)</span>
                <span className="text-xs text-emerald-600">activé</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Voucher scanné sur le terrain</span>
                <span className="text-xs text-slate-400">désactivé</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Connections tab */}
      {tab === 'connections' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Plug className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">Connecter mon compte Microsoft 365</h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Chaque Travel Designer peut connecter son propre compte Outlook.
                Permissions demandées : Mail (lecture/envoi), Calendar, Files (OneDrive/SharePoint), User profile.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                {dash.is_real ? 'Connecter via Microsoft' : 'Connecter (démo)'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-5 py-3 border-b border-slate-100 text-sm font-medium">
              Comptes connectés ({dash.connection ? 1 : 0})
            </div>
            <ul className="divide-y divide-slate-100">
              <li className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{dash.connection.account_email}</div>
                  <div className="text-xs text-slate-500">
                    {dash.connection.display_name || '—'} · scopes : {dash.connection.scopes.length} ·
                    {dash.connection.is_demo ? ' connexion démo' : ' actif'}
                  </div>
                </div>
                {!dash.connection.is_demo && (
                  <button
                    onClick={() => handleDisconnect(dash.connection)}
                    className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Déconnecter
                  </button>
                )}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, icon: Icon, accent = 'slate' }: {
  label: string, value: string, icon: any, accent?: 'slate' | 'indigo' | 'amber' | 'emerald'
}) {
  const colors: Record<string, string> = {
    slate:   'bg-slate-50 text-slate-700',
    indigo:  'bg-indigo-50 text-indigo-700',
    amber:   'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[accent]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

function MailRow({ m }: { m: M365MailMessage }) {
  return (
    <li className="px-5 py-3 hover:bg-slate-50 cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={`w-1 self-stretch rounded-full ${m.direction === 'in' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium truncate">{m.subject || '(sans objet)'}</div>
            <div className="text-xs text-slate-400 shrink-0">{fmtRel(m.received_at)}</div>
          </div>
          <div className="text-xs text-slate-500 truncate mt-0.5">
            {m.direction === 'in' ? 'De' : 'À'} : <span className="text-slate-700">{m.direction === 'in' ? m.sender : m.recipients.join(', ')}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 line-clamp-1">{m.preview}</div>
          {(m.project_id || m.invoice_id) && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              {m.project_id && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 inline-flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> dossier
                </span>
              )}
              {m.invoice_id && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" /> facture
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
