import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { sendMessage, sendTyping } from '@/lib/socket'
import { useDossierSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/stores/authStore'
import { Send, Phone } from 'lucide-react'

interface Props {
  dossierId: string
  interlocuteurId: string
  interlocuteurNom: string
  interlocuteurTel?: string
}

interface Message {
  id: string
  expediteur: { id: string; nom: string; role: string }
  contenu: string
  created_at: string
  lu: boolean
}

export function ChatWindow({ dossierId, interlocuteurId, interlocuteurNom, interlocuteurTel }: Props) {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['chat', dossierId],
    queryFn: () => api.get(`/dossiers/${dossierId}/messages`).then((r) => r.data),
  })

  useDossierSocket(dossierId, {
    nouveau_message: (data: unknown) => {
      const msg = data as Message
      qc.setQueryData<Message[]>(['chat', dossierId], (prev = []) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
    },
    typing: (data: unknown) => {
      const d = data as { user_id: string; typing: boolean }
      if (d.user_id !== user?.id) setPartnerTyping(d.typing)
    },
  })

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true)
      sendTyping(dossierId, true)
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false)
      sendTyping(dossierId, false)
    }, 2000)
  }

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(dossierId, interlocuteurId, input.trim())
    setInput('')
    setIsTyping(false)
    sendTyping(dossierId, false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#1e3a5f' }}>{interlocuteurNom}</p>
          {partnerTyping && <p style={{ fontSize: 11, color: '#10b981' }}>En train d'écrire...</p>}
        </div>
        {interlocuteurTel && (
          <a
            href={`tel:${interlocuteurTel}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e3a5f', color: '#fff', borderRadius: 8, padding: '8px 14px', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
          >
            <Phone size={14} />
            Appeler
          </a>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg) => {
          const isMine = msg.expediteur.id === user?.id
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '70%',
                background: isMine ? '#1e3a5f' : '#f0f4f8',
                color: isMine ? '#fff' : '#1a1a1a',
                borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
              }}>
                {!isMine && (
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{msg.expediteur.nom}</p>
                )}
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.contenu}</p>
                <p style={{ fontSize: 10, opacity: 0.65, marginTop: 4, textAlign: 'right' }}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); handleTyping() }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder="Écrivez un message..."
          style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 24, padding: '10px 16px', fontSize: 14, outline: 'none' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          style={{ background: '#1e3a5f', border: 'none', borderRadius: 24, padding: '10px 16px', cursor: input.trim() ? 'pointer' : 'not-allowed', opacity: input.trim() ? 1 : 0.5 }}
        >
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  )
}
