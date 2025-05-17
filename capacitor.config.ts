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
    }
  }
};

export default config;
