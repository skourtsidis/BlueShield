# BlueShield — Δημιουργία εφαρμογής Android (APK)

Το BlueShield είναι γραμμένο σε React + TypeScript και περιέχει **έτοιμο project Capacitor 8**
με το plugin **@capacitor-community/bluetooth-le** για πραγματική πρόσβαση στο Bluetooth του κινητού.
Από τον ίδιο κώδικα βγαίνει και εφαρμογή web (PWA) και εφαρμογή Android (APK).

---

## Τρόπος 1 — Αυτόματα με GitHub (χωρίς να εγκαταστήσετε τίποτα) ⭐ προτείνεται

1. Φτιάξτε δωρεάν λογαριασμό στο <https://github.com> και ένα νέο repository.
2. Ανεβάστε **όλα** τα αρχεία του project (μαζί με τον φάκελο `.github`).
3. Ανοίξτε την καρτέλα **Actions** → **Build Android APK (BlueShield)** → **Run workflow**.
4. Μετά από ~5–8 λεπτά, ανοίξτε την εκτέλεση που ολοκληρώθηκε και κατεβάστε το **BlueShield-APK** (αρχείο zip).
5. Αποσυμπιέστε το και μεταφέρετε το `app-debug.apk` στο κινητό σας.
6. Ανοίξτε το αρχείο στο κινητό → επιτρέψτε την «Εγκατάσταση από άγνωστες πηγές» → **Εγκατάσταση**.

## Τρόπος 2 — Στον υπολογιστή σας με Android Studio

Χρειάζεστε: **Node.js 22+**, **Android Studio** (με Android SDK) και **JDK 21**.

```bash
npm install
npm run build
npx cap add android          # μόνο την πρώτη φορά
npx cap sync android
npx @capacitor/assets generate --android   # προαιρετικά: εικονίδιο & splash από τον φάκελο assets/
npx cap open android         # ανοίγει το Android Studio
```

Στο Android Studio: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
Εναλλακτικά από τερματικό: `cd android && ./gradlew assembleDebug`
→ το APK βρίσκεται στο `android/app/build/outputs/apk/debug/app-debug.apk`.

> Για διανομή στο Google Play χρειάζεται υπογεγραμμένο release build (`./gradlew bundleRelease` με keystore).

## Τρόπος 3 — Ως εφαρμογή web (PWA), χωρίς APK

Ανεβάστε τον φάκελο `dist/` σε οποιαδήποτε φιλοξενία HTTPS (π.χ. Netlify, GitHub Pages, Vercel), ανοίξτε τη
διεύθυνση με **Chrome στο Android** και πατήστε **⋮ → Εγκατάσταση εφαρμογής**. Η εφαρμογή λειτουργεί και offline.
Από τη διεύθυνση PWA μπορείτε επίσης να βγάλετε APK/AAB μέσω του <https://www.pwabuilder.com>.

---

## Τι λειτουργεί πραγματικά σε κάθε έκδοση

| Λειτουργία | APK (Android) | Chrome (web) |
|---|---|---|
| Πραγματική κατάσταση Bluetooth (ON/OFF) & ειδοποίηση αλλαγών | ✅ | — |
| Ενεργοποίηση Bluetooth με το επίσημο παράθυρο του συστήματος | ✅ | — |
| Άνοιγμα ρυθμίσεων Bluetooth (για απενεργοποίηση / διαγραφή συσκευών) | ✅ | — |
| Πραγματική σάρωση BLE, ραντάρ, RSSI, «Εντοπισμός» | ✅ | ⚠️ μόνο με `chrome://flags/#enable-experimental-web-platform-features` |
| Ανίχνευση trackers (AirTag/Find My, SmartTag, Tile, Google Find My Device) & beacons | ✅ | ⚠️ όπως παραπάνω |
| Λίστα πραγματικών συζευγμένων συσκευών | ✅ | — |
| Επιθεώρηση διαρροής πληροφοριών συσκευής BLE (GATT) | — | ✅ (Web Bluetooth) |
| Μπαταρία & ρυθμός αποφόρτισης | ✅ | ✅ |
| Έκδοση Android / μοντέλο | ✅ | ✅ |
| Κουμπί «πίσω» του Android | ✅ | ✅ (ιστορικό browser) |
| Εκπαιδευτική προσομοίωση επιθέσεων & εργαστήριο | ✅ | ✅ |

## Περιορισμοί του Android (με ειλικρίνεια)

- Από το **Android 13 (API 33)** οι εφαρμογές **δεν επιτρέπεται** να κλείνουν μόνες τους το Bluetooth.
  Στη λειτουργία AUTO, το BlueShield σας ειδοποιεί όταν πρέπει να κλείσει και ανοίγει τις σωστές ρυθμίσεις.
- Καμία εφαρμογή **χωρίς root** δεν μπορεί να «μπλοκάρει» πακέτα μέσα στη στοίβα Bluetooth του Android
  ή να διαβάσει την κίνησή της. Οι ευπάθειες BlueBorne/KNOB/BIAS/BrakTooth διορθώνονται **μόνο με ενημερώσεις
  λογισμικού** — γι’ αυτό η εφαρμογή ελέγχει την έκδοση του συστήματος και σας υπενθυμίζει τις ενημερώσεις.
- Τα στοιχεία με την ετικέτα **ΠΡΟΣΟΜΟΙΩΣΗ** μέσα στην εφαρμογή είναι εκπαιδευτικά σενάρια (μπορούν να
  απενεργοποιηθούν από Ρυθμίσεις → Προσομοίωση). Τα στοιχεία **LIVE** είναι πραγματικά δεδομένα.

## Δικαιώματα που ζητά η εφαρμογή

- **Συσκευές σε κοντινή απόσταση** (BLUETOOTH_SCAN / BLUETOOTH_CONNECT) — για σάρωση και ανάγνωση συζευγμένων συσκευών.
- **Τοποθεσία** — απαιτείται από το Android για σάρωση BLE σε παλαιότερες εκδόσεις, και προαιρετικά για τις «έμπιστες τοποθεσίες».
- Κανένα δεδομένο δεν φεύγει από τη συσκευή· όλα αποθηκεύονται τοπικά.

## Δομή του κώδικα

```
src/
  App.tsx                 κέλυφος εφαρμογής & πλοήγηση
  screens/                Αρχική, Ραντάρ, Προστασία, Συσκευές, Οδηγός, Ρυθμίσεις, Συμβάντα
  components/             UI (διακόπτες ON/OFF/AUTO, sheets), γραφήματα, έλεγχος ασφαλείας, onboarding
  store/useStore.ts       κατάσταση, λογική ON/OFF/AUTO, αυτοματισμοί, μηχανή live δεδομένων
  store/sim.ts            εκπαιδευτικά σενάρια επιθέσεων & συσκευών
  platform/ble.ts         native Bluetooth LE (Capacitor) & Web Bluetooth, αναγνώριση trackers
  platform/system.ts      έκδοση συστήματος, μπαταρία, ειδοποιήσεις, δόνηση, GPS
  data/                   κείμενα μονάδων, λεξικό, κουίζ, κανόνες
assets/                   πηγαία εικονίδια/splash για το APK
capacitor.config.json     ρυθμίσεις Capacitor (appId: gr.blueshield.app)
.github/workflows/        αυτόματη δημιουργία APK
```
