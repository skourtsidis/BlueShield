import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useStore } from '../store/useStore';
import { getSystemInfo, haversine, startBattery } from '../platform/system';
import { nativeInit } from '../platform/ble';
import type { Screen } from '../types';

/**
 * Boots the live engine: 1-second tick, native Bluetooth polling (2 s), connected and bonded
 * devices (5 s), root check, device details, battery, OS info, GPS places and the Android back button.
 */
export function useEngine() {
  useEffect(() => {
    const st = useStore.getState();
    const tickIv = window.setInterval(() => useStore.getState().tick(), 1000);
    const nativeIv = window.setInterval(() => void useStore.getState().refreshNative(), 2000);
    const slowIv = window.setInterval(() => {
      void useStore.getState().refreshConnected();
      void useStore.getState().refreshBonded();
    }, 5000);
    let disposed = false;
    let stopBattery: (() => void) | null = null;

    void st.checkRoot();
    void st.loadDeviceDetails();
    void st.refreshNative();
    void st.refreshConnected();
    void st.refreshBonded();

    getSystemInfo()
      .then((i) => useStore.getState().setSysInfo(i))
      .catch(() => undefined);
    startBattery((l, c) => useStore.getState().setBatteryLive(l, c)).then((stop) => {
      if (disposed) stop?.();
      else stopBattery = stop;
    });

    if (st.caps.native) {
      void nativeInit((en) => useStore.getState().setLive({ btEnabled: en }));
    }

    let backHandle: { remove: () => Promise<void> } | null = null;
    if (st.caps.native) {
      // Android back button: closes overlays first, then returns Home, then exits the app
      CapApp.addListener('backButton', () => {
        const s = useStore.getState();
        if (s.pendingRequest) return;
        if (s.help) return s.closeHelp();
        if (s.selectedDevice) return s.selectDevice(null);
        if (s.sheet) return s.openSheet(null);
        if (s.screen !== 'home') {
          useStore.setState({ screen: 'home' });
          return;
        }
        void CapApp.exitApp();
      })
        .then((h) => {
          if (disposed) void h.remove();
          else backHandle = h;
        })
        .catch(() => undefined);
    }

    try {
      window.history.replaceState({ screen: useStore.getState().screen }, '');
    } catch {
      /* ignore */
    }
    const onPop = (e: PopStateEvent) => {
      const s = useStore.getState();
      if (s.help) s.closeHelp();
      if (s.sheet) s.openSheet(null);
      const screen = ((e.state && e.state.screen) || 'home') as Screen;
      useStore.setState({ screen });
    };
    window.addEventListener('popstate', onPop);

    return () => {
      disposed = true;
      window.clearInterval(tickIv);
      window.clearInterval(nativeIv);
      window.clearInterval(slowIv);
      stopBattery?.();
      void backHandle?.remove();
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const useGps = useStore((s) => s.settings.useGps);
  const places = useStore((s) => s.trustedPlaces);
  useEffect(() => {
    if (!useGps || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        const inside = places.find((pl) => pl.lat != null && pl.lon != null && haversine(pos, { lat: pl.lat, lon: pl.lon }) <= pl.radius);
        const loc = inside ? inside.kind : 'public';
        const s = useStore.getState();
        if (s.location !== loc) s.setLocation(loc, 'GPS');
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [useGps, places]);
}
