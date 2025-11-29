export {};

declare global {
  type FitBuddyToastVariant = 'success' | 'info' | 'warning' | 'error';

  interface FitBuddyNotificationOptions {
    title?: string;
    message: string;
    variant?: FitBuddyToastVariant;
    durationMs?: number;
  }

  interface Window {
    showFitBuddyNotification?: (opts: FitBuddyNotificationOptions) => void;
  }
}
