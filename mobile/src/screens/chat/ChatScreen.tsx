import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Linking,
} from 'react-native'
import { useAuthStore } from '../../store/authStore'
import { connectSocket } from '../../services/socket'
import { api } from '../../services/api'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface Props {
  route: { params: { dossierId: string; tdId: string; tdNom: string; tdTelephone?: string } }
}

interface Message {
  id: string
  expediteur: { id: string; nom: string }
  contenu: string
  created_at: string
}

export function ChatScreen({ route }: Props) {
  const { dossierId, tdId, tdNom, tdTelephone } = route.params
  const { user, token } = useAuthStore()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [partnerTyping, setPartnerTyping] = useState(false)
  const flatRef = useRef<FlatList>(null)

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['chat', dossierId],
    queryFn: () => api.get(`/dossiers/${dossierId}/messages`).then((r) => r.data),
  })

  useEffect(() => {
    if (!token) return
    const socket = connectSocket(token)
    socket.emit('rejoindre_dossier', { dossier_id: dossierId })

    socket.on('nouveau_message', (msg: Message) => {
      qc.setQueryData<Message[]>(['chat', dossierId], (prev = []) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      )
      flatRef.current?.scrollToEnd({ animated: true })
    })

    socket.on('typing', (d: { user_id: string; typing: boolean }) => {
      if (d.user_id !== user?.id) setPartnerTyping(d.typing)
    })

    return () => {
      socket.off('nouveau_message')
      socket.off('typing')
      socket.emit('quitter_dossier', { dossier_id: dossierId })
    }
  }, [token, dossierId])

  const send = () => {
    if (!input.trim() || !token) return
    const socket = connectSocket(token)
    socket.emit('envoyer_message', { dossier_id: dossierId, destinataire_id: tdId, contenu: input.trim() })
    setInput('')
  }

  const handleTyping = () => {
    if (!token) return
    const socket = connectSocket(token)
    socket.emit('typing', { dossier_id: dossierId, typing: true })
    setTimeout(() => socket.emit('typing', { dossier_id: dossierId, typing: false }), 2000)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f0f4f8' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <View>
          <Text style={styles.headerName}>{tdNom}</Text>
          {partnerTyping && <Text style={styles.typing}>En train d'écrire...</Text>}
        </View>
        {tdTelephone && (
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${tdTelephone}`)}
          >
            <Text style={styles.callText}>📞 Appeler</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMine = item.expediteur.id === user?.id
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, isMine && { color: '#fff' }]}>{item.contenu}</Text>
              <Text style={[styles.bubbleTime, isMine && { color: 'rgba(255,255,255,0.65)' }]}>
                {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )
        }}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(t) => { setInput(t); handleTyping() }}
          placeholder="Message..."
          placeholderTextColor="#94a3b8"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
          onPress={send}
          disabled={!input.trim()}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const BLUE = '#1e3a5f'

const styles = StyleSheet.create({
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerName: { fontSize: 16, fontWeight: '800', color: BLUE },
  typing: { fontSize: 11, color: '#10b981', marginTop: 2 },
  callBtn: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  callText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  messagesList: { padding: 16, gap: 10 },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  bubbleText: { fontSize: 15, color: '#1a1a1a', lineHeight: 21 },
  bubbleTime: { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120, color: '#1a1a1a', backgroundColor: '#f8fafc' },
  sendBtn: { width: 46, height: 46, backgroundColor: BLUE, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18 },
})
