import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DeviceDetails, KeyClass } from '../types';

/* Result shapes returned by the Android plugin (android/.../BlueShieldNativePlugin.java). */

export interface RootStatusNative {
  granted: boolean;
  suBinary: boolean;
  testKeys: boolean;
  message: string;
}

export interface BluetoothStateNative {
  hasBluetooth: boolean;
  hasBle: boolean;
  enabled: boolean;
  scanMode: 'discoverable' | 'connectable' | 'none' | 'unknown';
  discoverable: boolean;
  name: string;
}

export interface PermissionState {
  scan: boolean;
  connect: boolean;
  location: boolean;
  needsLocation: boolean;
  sdkInt: number;
}

export interface RadioResult {
  ok: boolean;
  enabled: boolean;
  message: string;
}

export interface BondedNative {
  address: string;
  name: string;
  transport: 'classic' | 'le' | 'dual' | 'unknown';
  majorClass: string;
}

export interface PairingNative {
  address: string;
  name: string;
  linkKeyType: number;
  le: boolean;
}

export interface PairingAnalysisNative {
  available: boolean;
  reason?: string;
  source?: string;
  devices: PairingNative[];
}

export interface BlueShieldNativePlugin {
  getDeviceInfo(): Promise<DeviceDetails & { buildTags: string }>;
  getRootStatus(): Promise<RootStatusNative>;
  getBluetoothState(): Promise<BluetoothStateNative>;
  requestPermissions(): Promise<PermissionState>;
  setRadio(options: { enabled: boolean }): Promise<RadioResult>;
  requestEnable(): Promise<{ launched: boolean; enabled: boolean }>;
  requestDiscoverable(options: { seconds: number }): Promise<{ launched: boolean }>;
  openBluetoothSettings(): Promise<void>;
  getBondedDevices(): Promise<{ devices: BondedNative[] }>;
  getConnectedDevices(): Promise<{ addresses: string[] }>;
  removeBond(options: { address: string }): Promise<{ ok: boolean }>;
  setDeviceName(options: { name: string }): Promise<{ ok: boolean; name: string }>;
  analyzePairings(): Promise<PairingAnalysisNative>;
}

/** Typed handle to the native plugin. Only call its methods when isNativeApp() is true. */
export const native = registerPlugin<BlueShieldNativePlugin>('BlueShieldNative');

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Maps an HCI link-key type (as stored by Android) to a security class.
 * 0,1,2,3,6 = legacy PIN-era keys; 4 = SSP P-192 without MITM protection;
 * 5 = SSP P-192 with MITM protection; 7 = Secure Connections P-256 without MITM protection;
 * 8 = Secure Connections P-256 with MITM protection.
 */
export function keyClassOf(linkKeyType: number): KeyClass {
  switch (linkKeyType) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 6:
      return 'legacy';
    case 4:
      return 'ssp-unauth';
    case 5:
      return 'ssp-auth';
    case 7:
      return 'sc-unauth';
    case 8:
      return 'sc-auth';
    default:
      return 'unknown';
  }
}
