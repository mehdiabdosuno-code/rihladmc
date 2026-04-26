import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Sparkles, Send, Copy, Check, RotateCcw, Trash2,
  FileText, MapPin, Calculator, Languages, Zap,
  ChevronDown, Loader2,
} from 'lucide-react'
import { aiApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'

// ── Prompt presets ───────────────────────────────────────────────
const PRESETS = [
  {
    label: 'Itinéraire jour',
    icon: MapPin,
    prompt: 'Rédige une description premium (~100 mots) pour le Jour 3 d\u2019un circuit Maroc : Fès — visite médina, tanneries, Bou Inania. Ton luxe, en anglais.',
  },
  {
    label: 'Email client',
    icon: FileText,
    prompt: 'Rédige un email professionnel en anglais pour accompagner l\u2019envoi d\u2019une proposition de circuit 9 jours au Maroc à un tour-opérateur australien. Ton premium, concis.',
  },
  {
    label: 'Calcul transport',
    icon: Calculator,
    prompt: 'Pour un groupe de 28 personnes, calcule le nombre de véhicules nécessaires : minibus 17 places. Applique la règle ceil(pax/capacité). Montre le détail.',
  },
  {
    label: 'Traduction FR→EN',
    icon: Languages,
    prompt: 'Traduis en anglais premium ce texte de programme touristique :\n\n"Arrivée à l\u2019aéroport Mohammed V. Transfert VIP vers l\u2019hôtel. Visite panoramique de la Mosquée Hassan II, chef-d\u2019œuvre architectural surplombant l\u2019Atlantique."',
  },
]

// ── Message type ─────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tokens?: number
  cost?: number
}

// ── Main component ───────────────────────────────────────────────
export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Assistant IA S\u2019TOURS — prêt à vous aider. Posez une question ou choisissez un provider ci-dessous.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [provider, setProvider] = useState<'anthropic' | 'ollama'>('anthropic')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  // ── Send mutation ────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (args: { prompt: string; provider: string }) => 
      aiApi.generate(args.prompt, args.provider).then(r => r.data),
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.content || 'Réponse vide.',
          timestamp: new Date(),
          tokens: (data.input_tokens || 0) + (data.output_tokens || 0),
          cost: data.cost,
        },
      ])
    },
    onError: (err: any) => {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Erreur : ${err.response?.data?.detail || err.message || 'Impossible de joindre l\u2019IA.'}`,
          timestamp: new Date(),
        },
      ])
    },
  })

  const send = (text?: string) => {
    const prompt = (text || input).trim()
    if (!prompt) return

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    sendMutation.mutate({ prompt, provider })
  }

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'system',
      content: 'Conversation effacée. Prêt pour une nouvelle session.',
      timestamp: new Date(),
    }])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <PageHeader
        title="Assistant IA"
        subtitle="Générez du contenu, calculez, traduisez — propulsé par Claude & Ollama"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-brand border border-line">
              <button
                onClick={() => setProvider('anthropic')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-pill text-[10px] font-bold transition-all ${provider === 'anthropic' ? 'bg-ink text-cream shadow-sm' : 'text-slate hover:text-ink'}`}
              >
                <Sparkles size={11} /> Claude (Cloud)
              </button>
              <button
                onClick={() => setProvider('ollama')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-pill text-[10px] font-bold transition-all ${provider === 'ollama' ? 'bg-emerald-600 text-cream shadow-sm' : 'text-slate hover:text-ink'}`}
              >
                <Zap size={11} /> Gemma (Local)
              </button>
            </div>
            <button onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate
                         border border-line rounded-brand hover:bg-parchment transition-colors">
              <Trash2 size={12} /> Effacer
            </button>
          </div>
        }
      />

      {/* ── Chat area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}>

            <div className={`relative max-w-[80%] rounded-card px-5 py-4 ${
              msg.role === 'user'
                ? 'bg-ink text-cream shadow-md'
                : msg.role === 'system'
                  ? 'bg-saffron-50 text-saffron border border-saffron/20'
                  : 'bg-white border border-line shadow-card'
            }`}>
              {/* Role badge */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={11} className="text-rihla" />
                  <span className="text-[10px] text-rihla font-bold uppercase tracking-wider">Claude</span>
                  {msg.tokens && (
                    <span className="ml-2 text-[9px] text-fog font-mono">
                      {msg.tokens} tokens
                    </span>
                  )}
                </div>
              )}

              {/* Content */}
              <div className={`text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' ? 'text-cream' : 'text-graphite'
              }`}>
                {msg.content}
              </div>

              {/* Actions (assistant only) */}
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-3 pt-2 border-t border-line-soft">
                  <button
                    onClick={() => copyToClipboard(msg.id, msg.content)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate
                               hover:text-ink hover:bg-parchment rounded transition-all"
                  >
                    {copiedId === msg.id
                      ? <><Check size={10} className="text-success" /> Copié</>
                      : <><Copy size={10} /> Copier</>
                    }
                  </button>
                  <button
                    onClick={() => send(msg.content.slice(0, 40) + '… — reformule en version plus courte')}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate
                               hover:text-ink hover:bg-parchment rounded transition-all"
                  >
                    <RotateCcw size={10} /> Reformuler
                  </button>
                </div>
              )}

              {/* Timestamp */}
              <div className={`text-[9px] mt-1 ${
                msg.role === 'user' ? 'text-cream/40' : 'text-fog'
              }`}>
                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sendMutation.isPending && (
          <div className="flex justify-start animate-fade-up">
            <div className="bg-white border border-line rounded-card px-5 py-4 shadow-card">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-rihla animate-spin" />
                <span className="text-xs text-slate">Claude réfléchit…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Presets bar ───────────────────────────────────────── */}
      <div className="px-6 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <span className="text-[10px] text-fog uppercase tracking-wider font-bold flex-shrink-0">
            Modèles :
          </span>
          {PRESETS.map(p => {
            const Icon = p.icon
            return (
              <button key={p.label}
                onClick={() => send(p.prompt)}
                disabled={sendMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-parchment
                           border border-line-soft text-[11px] text-graphite font-medium
                           hover:border-rihla/30 hover:bg-rihla-50 hover:text-rihla
                           transition-all flex-shrink-0 whitespace-nowrap disabled:opacity-40"
              >
                <Icon size={11} /> {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <div className="flex items-end gap-3 bg-white rounded-card border border-line shadow-card p-3
                        focus-within:ring-2 focus-within:ring-rihla/20 focus-within:border-rihla/40
                        transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Posez une question, demandez une traduction, un calcul…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-fog
                       focus:outline-none leading-relaxed"
            disabled={sendMutation.isPending}
          />
          <button
            onClick={() => send()}
            disabled={sendMutation.isPending || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-brand bg-rihla text-cream
                       hover:bg-rihla-dark disabled:opacity-40 disabled:hover:bg-rihla
                       transition-colors shadow-sm flex-shrink-0"
          >
            {sendMutation.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="text-[10px] text-fog mt-2 text-center">
          Propulsé par Claude (Anthropic) · Entrée pour envoyer · Shift+Entrée pour un retour à la ligne
        </p>
      </div>
    </div>
  )
}
