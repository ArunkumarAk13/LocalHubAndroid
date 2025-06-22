declare global {
  interface Window {
    MainActivity?: {
      setExternalUserId: (userId: string) => void;
      clearNotifications: () => void;
    };
  }
}

export {}; 