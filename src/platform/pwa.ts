/* eslint-disable @typescript-eslint/no-explicit-any */
let deferred: any = null;
const listeners = new Set<(v: boolean) => void>();

export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l(true));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l(false));
  });
}

export const canInstall = () => !!deferred;

export function onInstallAvailability(cb: (v: boolean) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  deferred.prompt();
  const choice = await deferred.userChoice.catch(() => null);
  deferred = null;
  listeners.forEach((l) => l(false));
  return choice?.outcome === 'accepted';
}
