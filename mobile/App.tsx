import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Text, View, ActivityIndicator } from 'react-native'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'

import { useAuthStore } from './src/store/authStore'
import { LoginScreen } from './src/screens/auth/LoginScreen'
import { DossiersScreen } from './src/screens/dossiers/DossiersScreen'
import { RapportScreen } from './src/screens/rapports/RapportScreen'
import { ChatScreen } from './src/screens/chat/ChatScreen'
import { notificationsApi } from './src/services/api'

const Stack = createNativeStackNavigator()
const Tab   = createBottomTabNavigator()
const qc    = new QueryClient({ defaultOptions: { queries: { staleTime: 30000 } } })

// Configurer les notifications push
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
})

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = { Dossiers: '📋', Paiements: '💶', Profil: '👤' }
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name] || '•'}</Text>
    </View>
  )
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#1e3a5f',
        tabBarInactiveTintColor: '#94a3b8',
        headerStyle: { backgroundColor: '#1e3a5f' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800' },
      })}
    >
      <Tab.Screen name="Dossiers" component={DossiersScreen} options={{ title: 'Mes Dossiers' }} />
    </Tab.Navigator>
  )
}

function AppNavigator() {
  const { user, isLoading, loadToken, token } = useAuthStore()

  useEffect(() => { loadToken() }, [])

  // Enregistrer FCM token
  useEffect(() => {
    if (!token) return
    Notifications.getExpoPushTokenAsync()
      .then(({ data }) => notificationsApi.saveFcmToken(data))
      .catch(() => {})
  }, [token])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4f8' }}>
        <ActivityIndicator size="large" color="#1e3a5f" />
      </View>
    )
  }

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#1e3a5f' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '800' } }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={AppTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="RapportScreen"
            component={RapportScreen}
            options={{ title: 'Rapport Journalier' }}
          />
          <Stack.Screen
            name="ChatScreen"
            component={ChatScreen}
            options={({ route }: any) => ({ title: route.params?.tdNom || 'Chat TD' })}
          />
        </>
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  )
}
