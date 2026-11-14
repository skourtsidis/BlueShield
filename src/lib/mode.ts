import type { LocationCtx, Mode } from '../types';

/**
 * Effective state of a module, taking Master Protection into account:
 *  - Master OFF  → all modules disabled
 *  - Master AUTO → in public places all modules escalate to ON
 *  - Master ON   → each module operates as individually configured
 */
export function effectiveMode(master: Mode, mod: Mode, location: LocationCtx): Mode {
  if (master === 'off') return 'off';
  if (master === 'auto' && location === 'public') return 'on';
  return mod;
}

export const LOCATION_LABEL: Record<LocationCtx, string> = {
  home: 'Home',
  work: 'Work',
  public: 'Public place',
};
