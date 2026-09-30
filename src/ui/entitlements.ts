import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * The one-time "full game" unlock.
 *
 * Free forever: Act I, Boot Camp, skirmish on Crossfire Valley, and local
 * two-player on any map. The unlock opens everything else, including
 * future Books. See docs/MONETIZATION.md for turning the store on.
 *
 * The store is RevenueCat's native plugin, reached through Capacitor's
 * plugin registry so nothing breaks while it isn't installed: every store
 * call fails soft to "not available yet".
 */

/** Store product and RevenueCat entitlement ids (set up by hand in each console). */
export const PRODUCT_ID = 'crossfire_unlock';
export const ENTITLEMENT_ID = 'full_game';

/** Missions 0..FREE_MISSIONS-1 (Act I) are free. */
export const FREE_MISSIONS = 12;

const OWNED_KEY = 'crossfire-valley-unlocked';
const DEV_KEY = 'crossfire-valley-dev-unlock';

/** The Settings switch that fakes ownership: dev server and the debug APK only. */
export const devToggleAvailable: boolean = import.meta.env.DEV || import.meta.env.VITE_DEV_UNLOCK === '1';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function isUnlocked(): boolean {
  return readFlag(OWNED_KEY) || (devToggleAvailable && readFlag(DEV_KEY));
}

export function devUnlocked(): boolean {
  return devToggleAvailable && readFlag(DEV_KEY);
}

export function setDevUnlock(on: boolean): void {
  if (devToggleAvailable) writeFlag(DEV_KEY, on);
}

// ----- what the free tier covers (pure, so it can be tested) ---------------

export function missionNeedsUnlock(index: number, unlocked: boolean): boolean {
  return !unlocked && index >= FREE_MISSIONS;
}

/**
 * Skirmish gating: the default map is always free, and so is local
 * two-player on any map. Other maps against the computer or by link, and
 * custom maps, need the unlock.
 */
export function skirmishNeedsUnlock(isDefaultMap: boolean, opponent: 'ai' | 'hotseat' | 'pvp', unlocked: boolean): boolean {
  return !unlocked && !isDefaultMap && opponent !== 'hotseat';
}

// ----- the store ---------------------------------------------------------

interface StorePackage {
  identifier: string;
  product: { identifier: string; priceString: string };
}

interface CustomerInfo {
  entitlements?: { active?: Record<string, unknown> };
}

/** The slice of @revenuecat/purchases-capacitor this app uses. */
interface PurchasesPlugin {
  configure(options: { apiKey: string }): Promise<void>;
  getOfferings(): Promise<unknown>;
  purchasePackage(options: { aPackage: StorePackage }): Promise<{ customerInfo?: CustomerInfo }>;
  restorePurchases(): Promise<{ customerInfo?: CustomerInfo }>;
  getCustomerInfo(): Promise<{ customerInfo?: CustomerInfo }>;
}

const Purchases = registerPlugin<PurchasesPlugin>('Purchases');

export type StoreState =
  | { status: 'ready'; price: string; pkg: StorePackage }
  | { status: 'unavailable'; reason: string };

function apiKey(): string {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return import.meta.env.VITE_REVENUECAT_IOS_KEY ?? '';
  if (platform === 'android') return import.meta.env.VITE_REVENUECAT_ANDROID_KEY ?? '';
  return '';
}

let configured: Promise<boolean> | null = null;

function storeReady(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !apiKey() || !Capacitor.isPluginAvailable('Purchases')) {
    return Promise.resolve(false);
  }
  configured ??= Purchases.configure({ apiKey: apiKey() }).then(
    () => true,
    (err) => {
      console.warn('Store setup failed:', err);
      return false;
    },
  );
  return configured;
}

function applyCustomerInfo(info: CustomerInfo | undefined): boolean {
  const owned = Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]);
  if (owned) writeFlag(OWNED_KEY, true);
  return owned;
}

/** Finds the unlock package in the current offering, whatever shape the plugin returns. */
function findPackage(offerings: unknown): StorePackage | null {
  const o = offerings as { current?: { availablePackages?: StorePackage[] } } | null;
  const pkgs = o?.current?.availablePackages ?? [];
  return pkgs.find((p) => p.product?.identifier === PRODUCT_ID) ?? pkgs[0] ?? null;
}

export async function loadStore(): Promise<StoreState> {
  if (!Capacitor.isNativePlatform()) {
    return { status: 'unavailable', reason: 'The unlock is sold in the iPhone and Android apps.' };
  }
  if (!(await storeReady())) return { status: 'unavailable', reason: 'Purchases are not available yet.' };
  try {
    const pkg = findPackage(await Purchases.getOfferings());
    if (!pkg) return { status: 'unavailable', reason: 'The unlock is not on sale yet.' };
    return { status: 'ready', price: pkg.product.priceString, pkg };
  } catch (err) {
    console.warn('Could not load the store:', err);
    return { status: 'unavailable', reason: "Couldn't reach the store. Check your connection." };
  }
}

/** Resolves true when the purchase went through and the game is unlocked. */
export async function buyUnlock(pkg: StorePackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return applyCustomerInfo(customerInfo);
  } catch (err) {
    // Includes the player cancelling the store sheet.
    console.warn('Purchase did not complete:', err);
    return false;
  }
}

/** Resolves true if a previous purchase was found and restored. */
export async function restoreUnlock(): Promise<boolean> {
  if (!(await storeReady())) return false;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return applyCustomerInfo(customerInfo);
  } catch (err) {
    console.warn('Restore failed:', err);
    return false;
  }
}

/** Quietly picks up a purchase made on another device or before a reinstall. */
export async function refreshUnlock(): Promise<void> {
  if (isUnlocked() || !(await storeReady())) return;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    applyCustomerInfo(customerInfo);
  } catch {
    /* offline: try again next launch */
  }
}
