import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

/** True inside the Android/iOS app; false in a browser or PWA. */
export const isNative = Capacitor.isNativePlatform();

export async function initNative(): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') await StatusBar.setBackgroundColor({ color: '#263140' });
  } catch (err) {
    console.warn('Status bar setup failed:', err);
  }
}

export function onBackButton(handler: () => void): void {
  if (!isNative) return;
  void CapApp.addListener('backButton', handler);
}

export function exitApp(): void {
  if (isNative) void CapApp.exitApp();
}

function impact(style: ImpactStyle): void {
  if (!isNative) return;
  void Haptics.impact({ style }).catch(() => {});
}

function notify(type: NotificationType): void {
  if (!isNative) return;
  void Haptics.notification({ type }).catch(() => {});
}

export const haptic = {
  light: () => impact(ImpactStyle.Light),
  medium: () => impact(ImpactStyle.Medium),
  heavy: () => impact(ImpactStyle.Heavy),
  success: () => notify(NotificationType.Success),
  warning: () => notify(NotificationType.Warning),
};
