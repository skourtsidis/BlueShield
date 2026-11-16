import type { DeviceDetails, ModuleId, NearbyDevice, PairedDevice, PairingRecord, Severity } from '../types';

/**
 * Real, state-based checks used by the Protection screen and by "Check now".
 * Every input comes from the Android OS (APK) or from the device's own data.
 * Patch thresholds are approximate: a device whose security patch is older than the
 * threshold most likely lacks the fix. Always confirm with the manufacturer.
 */

export interface ModuleStatus {
  /** true = exposure found, false = no exposure found, null = cannot be determined yet. */
  exposed: boolean | null;
  severity: Severity;
  headline: string;
  detail: string;
}

export interface CheckInput {
  radioKnown: boolean;
  radioOn: boolean;
  discoverable: boolean;
  root: boolean;
  device: DeviceDetails | null;
  paired: PairedDevice[];
  pairings: PairingRecord[] | null;
  nearby: NearbyDevice[];
  scanning: boolean;
  packetsPerSec: number;
  dosThreshold: number;
}

export const PATCH_THRESHOLDS = {
  blueborne: '2017-09-01',
  knob: '2019-10-01',
  bias: '2020-09-01',
  braktooth: '2021-09-01',
  classic: '2019-10-01',
} as const;

const unknown = (headline: string, detail: string): ModuleStatus => ({ exposed: null, severity: 'info', headline, detail });
const clear = (headline: string, detail: string): ModuleStatus => ({ exposed: false, severity: 'info', headline, detail });
const exposed = (severity: Severity, headline: string, detail: string): ModuleStatus => ({
  exposed: true,
  severity,
  headline,
  detail,
});

/** Returns true when the device's patch is older than the cutoff, false when newer, null when unknown. */
function patchOlder(input: CheckInput, cutoff: string): boolean | null {
  const patch = input.device?.securityPatch;
  if (!patch) return null;
  return patch < cutoff; // ISO dates (YYYY-MM-DD) compare correctly as strings
}

export function moduleStatus(id: ModuleId, i: CheckInput): ModuleStatus {
  if (!i.radioKnown) {
    return unknown('Requires the Android app', 'Bluetooth state and device data are read only inside the BlueShield Android app.');
  }
  const patchText = i.device
    ? `Security patch level: ${i.device.securityPatch || 'not reported'}.`
    : 'Device details are not available yet.';
  const radioOff = (headline: string) => clear(headline, 'The Bluetooth radio is off, so nothing can reach your phone over Bluetooth.');

  switch (id) {
    case 'sniffing': {
      if (!i.root) {
        return unknown('Needs root to inspect pairing keys', 'Without root, BlueShield cannot read how your paired devices were paired (legacy PIN vs. authenticated).');
      }
      if (!i.pairings) {
        return unknown('Pairing keys not analyzed yet', 'Open Devices and press "Analyze pairing keys" to read the stored key types.');
      }
      const weak = i.pairings.filter((p) => p.keyClass === 'legacy' || p.keyClass === 'ssp-unauth');
      if (weak.length) {
        return exposed(
          'medium',
          `${weak.length} weak pairing${weak.length === 1 ? '' : 's'} found`,
          `${weak.map((w) => w.name || w.address).join(', ')} use legacy or unauthenticated keys. Pair them again at home so the key gets man-in-the-middle protection.`,
        );
      }
      return clear('All stored pairings are authenticated', 'Stored link keys use authenticated or Secure Connections pairing.');
    }
    case 'bluejacking':
      if (!i.radioOn) return radioOff('Bluetooth is off');
      return i.discoverable
        ? exposed('medium', 'Phone is visible to nearby strangers', 'Discoverable mode lets anyone nearby send you unsolicited requests (Bluejacking / phishing).')
        : clear('Phone is hidden', 'Your phone is not discoverable to unknown scanners.');
    case 'bluesnarfing':
    case 'bluebugging': {
      if (!i.radioOn) return radioOff('Bluetooth is off');
      if (i.discoverable) {
        return exposed('high', 'Discoverable while Bluetooth is on', 'Discoverable mode makes these attacks easier to start. Turn visibility off in Devices.');
      }
      if (patchOlder(i, PATCH_THRESHOLDS.classic)) {
        return exposed('high', 'Security patch may be too old', `${patchText} Classic Bluetooth flaws of this era were fixed in later updates.`);
      }
      if (patchOlder(i, PATCH_THRESHOLDS.classic) === null) {
        return unknown('Patch level unknown', patchText);
      }
      return clear('No exposure detected', `${patchText} Connections still require a trusted, paired device.`);
    }
    case 'blueborne':
      if (!i.radioOn) return radioOff('Bluetooth is off');
      if (patchOlder(i, PATCH_THRESHOLDS.blueborne) === null) return unknown('Patch level unknown', patchText);
      return patchOlder(i, PATCH_THRESHOLDS.blueborne)
        ? exposed('high', 'Patch predates BlueBorne fixes', `${patchText} Install every system update your manufacturer offers.`)
        : clear('Patch is newer than BlueBorne fixes', patchText);
    case 'knob':
      if (!i.radioOn) return radioOff('Bluetooth is off');
      if (patchOlder(i, PATCH_THRESHOLDS.knob) === null) return unknown('Patch level unknown', patchText);
      return patchOlder(i, PATCH_THRESHOLDS.knob)
        ? exposed('high', 'Patch predates KNOB fixes', `${patchText} Keep Bluetooth off while not in use.`)
        : clear('Patch is newer than KNOB fixes', patchText);
    case 'bias':
      if (!i.radioOn) return radioOff('Bluetooth is off');
      if (!i.paired.length) return clear('No paired devices to impersonate', 'BIAS needs a saved (paired) device to copy. You have none.');
      if (patchOlder(i, PATCH_THRESHOLDS.bias) === null) return unknown('Patch level unknown', patchText);
      return patchOlder(i, PATCH_THRESHOLDS.bias)
        ? exposed('high', 'Patch predates BIAS fixes', `${patchText} Forget old or unused paired devices to reduce the risk.`)
        : clear('Patch is newer than BIAS fixes', patchText);
    case 'braktooth':
      if (!i.radioOn) return radioOff('Bluetooth is off');
      if (patchOlder(i, PATCH_THRESHOLDS.braktooth) === null) return unknown('Patch level unknown', patchText);
      return patchOlder(i, PATCH_THRESHOLDS.braktooth)
        ? exposed('high', 'Patch predates BrakTooth fixes', `${patchText} Chipset firmware fixes arrive only through system updates.`)
        : clear('Patch is newer than BrakTooth fixes', patchText);
    case 'tracking': {
      if (!i.scanning) return unknown('Live scan is off', 'Start a live scan in Radar to look for trackers around you.');
      const trackers = i.nearby.filter((d) => d.tags.includes('tracker'));
      if (!trackers.length) return clear('No trackers detected', 'No AirTag-, SmartTag- or Tile-style advertisements were seen in the last 30 seconds.');
      const persistent = trackers.filter((d) => d.lastSeen - d.firstSeen > 10 * 60000);
      return persistent.length
        ? exposed('high', 'A tracker keeps following you', `${persistent.length} tracker(s) have been near you for more than 10 minutes.`)
        : exposed('medium', 'Tracker detected nearby', `${trackers.length} tracker(s) are near you. Check whether they belong to you.`);
    }
    case 'dos':
      if (!i.scanning) return unknown('Live scan is off', 'Start a live scan in Radar to measure Bluetooth traffic around you.');
      return i.packetsPerSec > i.dosThreshold
        ? exposed('high', 'Advertisement flood detected', `${i.packetsPerSec} advertisements in one second (threshold ${i.dosThreshold}).`)
        : clear('Normal Bluetooth traffic', `${i.packetsPerSec} advertisements in the last second (threshold ${i.dosThreshold}).`);
    default:
      return unknown('Unknown module', '');
  }
}
