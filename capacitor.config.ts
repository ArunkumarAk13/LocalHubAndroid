import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localhub.app',
  appName: 'LocalHub',
  webDir: 'dist',
  server: {
    // Comment out this line for production builds
    // url: 'http://192.168.1.X:5173', // Replace with your local dev machine IP for testing
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["phone"],
      languageCode: "en",
      nativeAuth: {
        providers: ["phone"],
        permissions: {
          phone: ["android.permission.RECEIVE_SMS"]
        }
      }
    }
  }
};

export default config;
