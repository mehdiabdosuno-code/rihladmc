module.exports = {
  expo: {
    name: 'RIHLA Guide',
    slug: 'rihla-guide',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1e3a5f',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ma.rihla.guide',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1e3a5f',
      },
      package: 'ma.rihla.guide',
      permissions: ['NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE'],
      googleServicesFile: './google-services.json',
    },
    plugins: [
      ['expo-notifications', {
        icon: './assets/notification-icon.png',
        color: '#1e3a5f',
        sounds: ['./assets/alerte.wav'],
      }],
    ],
    extra: {
      eas: { projectId: 'your-eas-project-id' },
    },
  },
}
