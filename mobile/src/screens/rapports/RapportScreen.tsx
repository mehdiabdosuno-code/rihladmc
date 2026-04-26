import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportsApi } from '../../services/api'

type EmojiVal = 'bien' | 'moyen' | 'mauvais' | null

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner' },
  { key: 'dejeuner',       label: 'Déjeuner' },
  { key: 'diner',          label: 'Dîner' },
  { key: 'hotel',          label: 'Hôtel' },
  { key: 'transport',      label: 'Transport' },
  { key: 'accueil_hote',   label: 'Accueil / Hôte' },
]

const OPTIONS: { val: EmojiVal; emoji: string; color: string; bg: string }[] = [
  { val: 'bien',    emoji: '😊', color: '#065f46', bg: '#d1fae5' },
  { val: 'moyen',   emoji: '😐', color: '#92400e', bg: '#fef3c7' },
  { val: 'mauvais', emoji: '😞', color: '#991b1b', bg: '#fee2e2' },
]

interface Props {
  route: { params: { dossierId: string; numeroDossier: string; nomGroupe: string } }
  navigation: any
}

export function RapportScreen({ route, navigation }: Props) {
  const { dossierId, numeroDossier, nomGroupe } = route.params
  const qc = useQueryClient()

  const today = new Date().toISOString().split('T')[0]
  const [evals, setEvals] = useState<Record<string, EmojiVal>>({})
  const [commentaire, setCommentaire] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const jourActuel = 1 // En production, calculer depuis date_debut
      return rapportsApi.soumettre(dossierId, {
        jour: jourActuel,
        date_rapport: today,
        ...evals,
        commentaire: commentaire || undefined,
      })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['rapports', dossierId] })
      const { alerte_declenchee, categories_alertes } = res.data
      if (alerte_declenchee) {
        Alert.alert(
          '⚠️ Alerte envoyée',
          `Le TD a été alerté pour : ${(categories_alertes as string[]).join(', ')}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        )
      } else {
        Alert.alert('✅ Rapport soumis', 'Le rapport a été envoyé avec succès.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ])
      }
    },
    onError: () => Alert.alert('Erreur', 'Impossible de soumettre le rapport. Réessayez.'),
  })

  const allFilled = CATEGORIES.every((c) => evals[c.key] !== undefined)
  const hasMauvais = Object.values(evals).some((v) => v === 'mauvais')

  const select = (cat: string, val: EmojiVal) => setEvals((e) => ({ ...e, [cat]: val }))

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f0f4f8' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header dossier */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{nomGroupe}</Text>
          <Text style={styles.headerSub}>{numeroDossier} • Rapport du {today}</Text>
        </View>

        {/* Alerte mauvais */}
        {hasMauvais && (
          <View style={styles.alerteBox}>
            <Text style={styles.alerteText}>⚠️ Une alerte sera envoyée automatiquement au TD</Text>
          </View>
        )}

        {/* Catégories */}
        {CATEGORIES.map(({ key, label }) => (
          <View key={key} style={styles.catCard}>
            <Text style={styles.catLabel}>{label}</Text>
            <View style={styles.emojiRow}>
              {OPTIONS.map(({ val, emoji, color, bg }) => {
                const selected = evals[key] === val
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => select(key, val)}
                    style={[
                      styles.emojiBtn,
                      { backgroundColor: selected ? bg : '#f8fafc', borderColor: selected ? color : '#e2e8f0', borderWidth: selected ? 2 : 1 },
                      selected && styles.emojiBtnSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emojiChar}>{emoji}</Text>
                    <Text style={[styles.emojiLabel, { color: selected ? color : '#94a3b8' }]}>
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ))}

        {/* Commentaire */}
        <View style={styles.commentCard}>
          <Text style={styles.catLabel}>Commentaire (optionnel)</Text>
          <TextInput
            style={styles.commentInput}
            value={commentaire}
            onChangeText={setCommentaire}
            multiline
            numberOfLines={4}
            placeholder="Observations, incidents, suggestions..."
            placeholderTextColor="#94a3b8"
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !allFilled && styles.submitBtnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={!allFilled || mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>📤 Soumettre le rapport</Text>
          }
        </TouchableOpacity>

        {!allFilled && (
          <Text style={styles.helperText}>Évaluez toutes les catégories pour continuer</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const BLUE = '#1e3a5f'

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14 },
  header: { backgroundColor: BLUE, borderRadius: 14, padding: 20, marginBottom: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  alerteBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center' },
  alerteText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  catCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  catLabel: { fontSize: 15, fontWeight: '700', color: '#1e3a5f', marginBottom: 14 },
  emojiRow: { flexDirection: 'row', gap: 10 },
  emojiBtn: { flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 12, gap: 6 },
  emojiBtnSelected: { transform: [{ scale: 1.05 }] },
  emojiChar: { fontSize: 30 },
  emojiLabel: { fontSize: 11, fontWeight: '600' },
  commentCard: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  commentInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 14, color: '#374151', minHeight: 100, backgroundColor: '#f8fafc' },
  submitBtn: { backgroundColor: BLUE, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  helperText: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 4 },
})
