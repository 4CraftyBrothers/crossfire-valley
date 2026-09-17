import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fourcraftybrothers.crossfirevalley',
  appName: 'Crossfire Valley',
  webDir: 'dist',
  backgroundColor: '#1b2430',
  android: {
    // Android 15 draws behind system bars; keep the WebView inside them so
    // the HUD and bottom bar aren't covered. The web CSS handles the rest.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#263140',
      overlaysWebView: false,
    },
  },
};

export default config;
