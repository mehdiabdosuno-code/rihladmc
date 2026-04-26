import React from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { dossiersApi } from '../../services/api'
import { useNavigation } from '@react-navigation/native'

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',  color: '#64748b', bg: '#f1f5f9' },
  confirme:   { label: 'Confirmé',   color: '#2563eb', bg: '#dbeafe' },
  pret:       { label: 'Prêt',       color: '#16a34a', bg: '#dcfce7' },
  en_cours:   { label: 'En cours',   color: '#d97706', bg: '#fef9c3' },
  termine:    { label: 'Terminé',    color: '#6b7280', bg: '#f3f4f6' },
}

export function DossiersScreen() {
  const navigation = useNavigation<any>()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dossiers'],
    queryFn: () => dossiersApi.miens().then((r) => r.data.data),
  })

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e3a5f" />
      </View>
    )
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#1e3a5f" />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucun dossier assigné</Text>
        </View>
      }
      renderItem={({ item }) => {
        const statutCfg = STATUT_CONFIG[item.statut] || STATUT_CONFIG.brouillon
        const debut = new Date(item.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
        const fin   = new Date(item.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('DossierDetail', { dossier: item })}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.groupName}>{item.nom_groupe}</Text>
                <Text style={styles.ref}>{item.numero_dossier}</Text>
              </View>
              <View style={[styles.statutBadge, { backgroundColor: statutCfg.bg }]}>
                <Text style={[styles.statutText, { color: statutCfg.color }]}>{statutCfg.label}</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.dates}>📅 {debut} → {fin}</Text>
              <Text style={styles.participants}>👥 {item.nb_participants || '?'} pers.</Text>
            </View>
          </TouchableOpacity>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 18, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  groupName: { fontSize: 16, fontWeight: '800', color: '#1e3a5f', maxWidth: 200 },
  ref: { fontSize: 12, color: '#64748b', marginTop: 3 },
  statutBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  statutText: { fontSize: 12, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  dates: { fontSize: 13, color: '#374151' },
  participants: { fontSize: 13, color: '#374151' },
})
