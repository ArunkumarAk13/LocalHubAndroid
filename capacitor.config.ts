import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.co.buhlacol',
  appName: 'LocalHub',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
