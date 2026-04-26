import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, AtSign, Send, Clock, User, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Comment {
  id: string
  content: string
  author_name: string
  author_initials: string
  created_at: string
  mentions?: string[]
}

interface ProjectCommentsProps {
  projectId: string
}

// Fetch comments using the audit/collaboration endpoint
async function fetchComments(projectId: string): Promise<Comment[]> {
  try {
    const res = await api.get(`/projects/${projectId}/comments`)
    return res.data
  } catch {
    // Fallback mock data if endpoint doesn't exist yet
    return [
      {
        id: 'c1',
        content: "Le client souhaite une visite privée de la Médina. Je vérifie la disponibilité avec le guide Rachid.",
        author_name: "Sonia El Amrani",
        author_initials: "SE",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        mentions: []
      },
      {
        id: 'c2',
        content: "@Karim — peux-tu valider les tarifs du Mamounia pour ce dossier avant ce soir ?",
        author_name: "Admin",
        author_initials: "AD",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        mentions: ['Karim']
      },
    ]
  }
}

async function postComment(projectId: string, content: string): Promise<Comment> {
  try {
    const res = await api.post(`/projects/${projectId}/comments`, { content })
    return res.data
  } catch {
    // Return mock for demo
    return {
      id: Date.now().toString(),
      content,
      author_name: 'Vous',
      author_initials: 'VS',
      created_at: new Date().toISOString(),
      mentions: []
    }
  }
}

export function ProjectComments({ projectId }: ProjectCommentsProps) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(true)

  const { data: comments = [] } = useQuery({
    queryKey: ['project-comments', projectId],
    queryFn: () => fetchComments(projectId),
    refetchInterval: 30000,
  })

  const addComment = useMutation({
    mutationFn: () => postComment(projectId, text),
    onSuccess: (newComment) => {
      qc.setQueryData(['project-comments', projectId], (old: Comment[] = []) => [newComment, ...old])
      setText('')
    }
  })

  // Parse @mentions
  const renderContent = (content: string) => {
    return content.split(/(@\w+)/g).map((part, i) => 
      part.startsWith('@') 
        ? <span key={i} className="text-rihla font-bold">{part}</span>
        : part
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rihla/10 flex items-center justify-center text-rihla">
            <MessageSquare size={16} />
          </div>
          <h3 className="text-sm font-black text-slate-800 dark:text-cream uppercase tracking-widest">
            Discussion Équipe
          </h3>
          {comments.length > 0 && (
            <span className="px-2 py-0.5 bg-rihla text-white text-[10px] font-black rounded-full">{comments.length}</span>
          )}
        </div>
        <ChevronDown size={16} className={clsx("text-slate-400 transition-transform", expanded ? "rotate-180" : "")} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-white/10">
          {/* Input */}
          <div className="p-4 border-b border-slate-100 dark:border-white/10">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-rihla text-white flex items-center justify-center text-[10px] font-black shrink-0">VS</div>
              <div className="flex-1 flex gap-2">
                <div className="flex-1 relative">
                  <AtSign size={14} className="absolute left-3 top-3 text-slate-400" />
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) {
                        e.preventDefault()
                        addComment.mutate()
                      }
                    }}
                    placeholder="Ajouter un commentaire... (@mentionner un collègue)"
                    rows={2}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs resize-none focus:ring-2 focus:ring-rihla/20 outline-none"
                  />
                </div>
                <button
                  disabled={!text.trim() || addComment.isPending}
                  onClick={() => addComment.mutate()}
                  className="self-end px-4 py-2.5 bg-rihla text-white rounded-2xl text-[10px] font-black disabled:opacity-40 hover:bg-rihla/90 transition-all flex items-center gap-1.5"
                >
                  <Send size={12} /> Envoyer
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 ml-11">Ctrl+Entrée pour envoyer · @nom pour mentionner</p>
          </div>

          {/* Comments list */}
          <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-80 overflow-y-auto">
            {comments.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Aucun commentaire. Commencez la discussion.</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3 p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300 shrink-0">
                    {c.author_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-slate-800 dark:text-cream">{c.author_name}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {format(new Date(c.created_at), 'dd/MM HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {renderContent(c.content)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
