import type { LocationCtx, Mode } from '../types';

/**
 * Πραγματική (ενεργή) κατάσταση μιας μονάδας, λαμβάνοντας υπόψη την κεντρική προστασία:
 *  - Κεντρική OFF  → όλες οι μονάδες ανενεργές
 *  - Κεντρική AUTO → σε δημόσιους χώρους όλες ανεβαίνουν σε ON
 *  - Κεντρική ON   → κάθε μονάδα όπως την έχετε ρυθμίσει
 */
export function effectiveMode(master: Mode, mod: Mode, location: LocationCtx): Mode {
  if (master === 'off') return 'off';
  if (master === 'auto' && location === 'public') return 'on';
  return mod;
}

export const LOCATION_LABEL: Record<LocationCtx, string> = {
  home: 'Σπίτι',
  work: 'Εργασία',
  public: 'Δημόσιος χώρος',
};
