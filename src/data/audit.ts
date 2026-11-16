export type Severity = "critical" | "high" | "medium" | "info";

export interface Finding {
  id: string;
  code: string;
  title: string;
  severity: Severity;
  category: "validation" | "integration" | "consistency";
  file: string;
  asked: string;
  found: string;
  impact: string;
  fix: string;
  fixedIn: string;
  status: "fixed" | "partial" | "documented";
}

export const FINDINGS: Finding[] = [
  {
    id: "F01",
    code: "VAL-01",
    title: "Όλα τα 10 protection modules είναι 100% simulation",
    severity: "critical",
    category: "validation",
    file: "src/store/sim.ts → generateAttack()",
    asked: "Πραγματική προστασία από Sniffing, Bluejacking, Bluesnarfing, Bluebugging, BlueBorne, KNOB, BIAS, BrakTooth, Tracking, DoS.",
    found: "Η generateAttack() παράγει επιθέσεις με Math.random() / weightedPick(). Η resolveAttack() αποφασίζει blocked/allowed με βάση μόνο το ON/OFF/AUTO switch — καμία κλήση σε Android API, κανένας έλεγχος πακέτων, κανένα block.",
    impact: "Ο χρήστης βλέπει '🛡️ Blocked attack' ενώ στην πραγματικότητα δεν μπλοκαρίστηκε τίποτα. Επικίνδυνη ψευδής αίσθηση ασφάλειας.",
    fix: "Χωρισμός σε REAL detectors (μόνο ό,τι το Android επιτρέπει: pairing monitor, bonded list, BLE scan, patch-level check) + σαφής σήμανση SIM για εκπαιδευτικά σενάρια. Κάθε event φέρει πεδίο dataSource: 'live' | 'sim'.",
    fixedIn: "SecurityMonitorService.kt + useStore.patch.ts",
    status: "fixed",
  },
  {
    id: "F02",
    code: "VAL-02",
    title: "Το tick() κατασκευάζει ψεύτικα πακέτα, RSSI, μπαταρία & κλειδιά",
    severity: "critical",
    category: "validation",
    file: "src/store/useStore.ts → tick()",
    asked: "Διαδραστικά και live γραφήματα με πραγματικά δεδομένα.",
    found: "Timeline πακέτων: connected.length * rand(6,14) + rand(28,42). RSSI: rssi + rand(-2.6, 2.6). Μπαταρία: level -= 0.0025. Κλειδιά KNOB: randInt. Όλα Math.random, ακόμα και όταν το UI γράφει LIVE.",
    impact: "Τα γραφήματα δεν μετρούν τίποτα. Ο χρήστης δεν μπορεί να διακρίνει επίθεση DoS από ησυχία.",
    fix: "Νέος σχηματισμός timeline ΜΟΝΟ από πραγματικά callbacks: BleScanCallback count/sec, bonded ACL events, BatteryManager. Αν δεν υπάρχει live πηγή, το γράφημα δείχνει 'NO LIVE DATA — connect native service' αντί για ψεύτικη καμπύλη.",
    fixedIn: "BleScannerService.kt + ble-fixed.ts",
    status: "fixed",
  },
  {
    id: "F03",
    code: "VAL-03",
    title: "Το radioOn είναι τοπικό boolean — δεν διαβάζει τον πραγματικό adapter",
    severity: "high",
    category: "validation",
    file: "src/store/useStore.ts → setRadioMode()",
    asked: "Κουμπιά ON/OFF/AUTO που να ανοιγοκλείνουν πραγματικά το Bluetooth.",
    found: "Χωρίς native (web/PWA) το radioOn απλά αλλάζει στο store. Με native, το btEnabled διαβάζεται μία φορά αλλά το AUTO idle-off δεν εκτελείται ποτέ — στέλνει μόνο toast. Δεν υπάρχει BroadcastReceiver για ACTION_STATE_CHANGED.",
    impact: "Το AUTO mode δεν κάνει τίποτα. Το UI λέει OFF ενώ το ραδιόφωνο παραμένει ανοιχτό.",
    fix: "BluetoothController.kt με BroadcastReceiver + isEnabled() polling + root path (svc bluetooth enable/disable). Χωρίς root: επίσημο intent για ON, άνοιγμα Settings για OFF (περιορισμός Android 13+). Το UI δείχνει πάντα την πραγματική κατάσταση adapter.",
    fixedIn: "BluetoothController.kt",
    status: "fixed",
  },
  {
    id: "F04",
    code: "VAL-04",
    title: "Δεν υπάρχει έλεγχος root — η απαίτηση αγνοήθηκε πλήρως",
    severity: "high",
    category: "validation",
    file: "— (αρχείο δεν υπάρχει)",
    asked: "Λειτουργία ελέγχου αν η συσκευή είναι rooted. Αν όχι, greyed-out με επεξήγηση. Αν ναι, η απενεργοποίηση να λειτουργεί.",
    found: "Καμία αναφορά σε root, su, Magisk σε όλο το repo. Το ANDROID_APK.md λέει απλά 'δεν επιτρέπεται' χωρίς εναλλακτική.",
    impact: "Σε rooted συσκευές χάνεται η μόνη οδός για πραγματικό programmatic OFF + αυτόματο reject pairing + hosts-level block.",
    fix: "Νέο RootChecker.kt (5 μέθοδοι ανίχνευσης + δοκιμή su -c id) + BlueShieldNative.checkRoot() bridge. Το UI κλειδώνει/ξεκλειδώνει δυναμικά τα privileged actions με badge 'ROOT REQUIRED' / 'ROOT ACTIVE'.",
    fixedIn: "RootChecker.kt + BlueShieldBridge.kt",
    status: "fixed",
  },
  {
    id: "F05",
    code: "INT-01",
    title: "Κανένα BroadcastReceiver για pairing / bond / discovery",
    severity: "high",
    category: "integration",
    file: "AndroidManifest.xml (ελλιπές — default Capacitor)",
    asked: "Απόρριψη άγνωστων αιτημάτων σύνδεσης, προειδοποίηση για pairing σε δημόσιο χώρο.",
    found: "Δεν δηλώνεται κανένας receiver για PAIRING_REQUEST, BOND_STATE_CHANGED, ACTION_FOUND, ACL_CONNECTED. Το 'Blocked pairing in public place' είναι απλό if (location==='public') στο pairNew().",
    impact: "Πραγματικά αιτήματα pairing περνούν απαρατήρητα. Η εφαρμογή δεν ξέρει καν ότι έγινε pairing.",
    fix: "PairingMonitorReceiver.kt + δηλώσεις στο Manifest με σωστά intent-filters & permissions. Κάθε πραγματικό pairing γράφει event με dataSource:'live' και —αν rooted + autoReject— εκτελεί abortBroadcast()/cancelBond.",
    fixedIn: "PairingMonitorReceiver.kt + AndroidManifest.xml",
    status: "fixed",
  },
  {
    id: "F06",
    code: "INT-02",
    title: "Χωρίς Foreground Service η προστασία πεθαίνει στο background",
    severity: "high",
    category: "integration",
    file: "— (υπηρεσία δεν υπάρχει)",
    asked: "Συνεχής προστασία, AUTO mode, ειδοποιήσεις.",
    found: "Όλη η λογική τρέχει στο WebView (setInterval tick). Μόλις κλείσει η οθόνη ή μπει battery optimization, το tick σταματά. Δεν υπάρχει FOREGROUND_SERVICE permission ούτε NotificationChannel.",
    impact: "AUTO, night schedule, tracker-follow alerts: ανενεργά όταν η εφαρμογή δεν είναι ανοιχτή — δηλαδή σχεδόν πάντα.",
    fix: "SecurityMonitorService.kt (foreground, STICKY) + BootReceiver. Το WebView γίνεται απλό dashboard· η λογική ζει σε Kotlin και στέλνει events μέσω bridge.",
    fixedIn: "SecurityMonitorService.kt",
    status: "fixed",
  },
  {
    id: "F07",
    code: "INT-03",
    title: "Το JS↔Native bridge μεταφέρει μόνο BLE scan — όλα τα άλλα μένουν στο WebView",
    severity: "high",
    category: "integration",
    file: "src/platform/ble.ts",
    asked: "Πλήρες λειτουργικό γραφικό περιβάλλον με πραγματικά δεδομένα.",
    found: "Χρησιμοποιείται μόνο @capacitor-community/bluetooth-le (BLE advertisements). Δεν υπάρχει γέφυρα για: adapter state, bonded list changes, battery, patch level, root, pairing events. Το bonded διαβάζεται μία φορά, χωρίς listener.",
    impact: "Αποσυνδεδεμένα δεδομένα: το UI δεν ενημερώνεται όταν αλλάζει κάτι στο σύστημα.",
    fix: "BlueShieldBridge.kt (@CapacitorPlugin) με 11 methods + 4 event listeners (btState, scanResult, pairingEvent, threatEvent). Νέο ble-fixed.ts που προτιμά πάντα το native bridge και πέφτει πίσω σε web μόνο με σαφή ένδειξη.",
    fixedIn: "BlueShieldBridge.kt + ble-fixed.ts",
    status: "fixed",
  },
  {
    id: "F08",
    code: "VAL-05",
    title: "Κανένας έλεγχος Security Patch Level για BlueBorne/KNOB/BIAS/BrakTooth",
    severity: "medium",
    category: "validation",
    file: "src/platform/system.ts → detectCapabilities()",
    asked: "Προστασία από BlueBorne, KNOB, BIAS, BrakTooth.",
    found: "Η μόνη 'προστασία' είναι το κουμπί markUpdatesChecked() που απλά αποθηκεύει timestamp ότι ο χρήστης 'έλεγξε' updates. Δεν διαβάζεται ποτέ το Build.VERSION.SECURITY_PATCH.",
    impact: "Ευάλωτη συσκευή (π.χ. patch 2019) εμφανίζεται 'προστατευμένη' επειδή το switch είναι ON.",
    fix: "VulnerabilityAssessor.kt: διαβάζει SECURITY_PATCH + SDK και αντιστοιχεί σε CVE matrix (BlueBorne <2017-09, KNOB <2020-02, BIAS <2020-05, BrakTooth <2022-03). Το module δείχνει PATCHED / VULNERABLE / UNKNOWN με ημερομηνία.",
    fixedIn: "VulnerabilityAssessor.kt",
    status: "fixed",
  },
  {
    id: "F09",
    code: "CON-01",
    title: "Ετικέτες LIVE/SIM ασυνεπείς — το UI ανακατεύει πραγματικά με ψεύτικα",
    severity: "critical",
    category: "consistency",
    file: "src/store/useStore.ts → addEvent(), ingested nearby",
    asked: "Σαφής διάκριση πραγματικού vs εκπαιδευτικού περιεχομένου.",
    found: "Το addEvent βάζει simulated:true by default. Το ingestLive() ανακατεύει live adverts με spawnDevice(FOLLOW_TRACKER) sim entries στον ίδιο πίνακα nearby χωρίς διάκριση. Το radar δείχνει sim συσκευές σαν πραγματικές.",
    impact: "Παραβίαση συνέπειας δεδομένων: ο χρήστης δεν ξέρει τι είναι αληθινό.",
    fix: "Υποχρεωτικό πεδίο origin σε κάθε entity + οπτικά badges (πράσινο LIVE / πορτοκαλί SIM) + φίλτρο 'Hide simulations' που κρύβει 100% τα sim entries. Κανένα sim event δεν επηρεάζει το security score όταν το φίλτρο είναι ON.",
    fixedIn: "useStore.patch.ts + ble-fixed.ts",
    status: "fixed",
  },
  {
    id: "F10",
    code: "CON-02",
    title: "Permissions: λείπουν δηλώσεις ανά API level, καμία διαχείριση runtime flow",
    severity: "high",
    category: "consistency",
    file: "android/app/src/main/AndroidManifest.xml (auto-generated)",
    asked: "Σωστή λειτουργία σε σύγχρονα Android.",
    found: "Το Capacitor manifest ζητά βασικά permissions αλλά λείπουν: BLUETOOTH_SCAN/BLUETOOTH_CONNECT με usesPermissionFlags NEVER_FOR_LOCATION, ACCESS_FINE_LOCATION με maxSdkVersion, FOREGROUND_SERVICE + foregroundServiceType:connectedDevice, POST_NOTIFICATIONS (API33), REQUEST_IGNORE_BATTERY_OPTIMIZATIONS. Δεν υπάρχει έλεγχος 'Bluetooth scanning' system setting ούτε Nearby devices rationale.",
    impact: "Σε Android 12+ το scan αποτυγχάνει σιωπηλά. Σε Android 13+ οι ειδοποιήσεις δεν εμφανίζονται. Σε όλα, το background σκοτώνεται.",
    fix: "Πλήρες διορθωμένο Manifest με σχόλια ανά API level + PermissionFlow.kt (rationale → request → settings fallback) + έλεγχος location-services ON για BLE scan σε API<31.",
    fixedIn: "AndroidManifest.xml + PermissionFlow.kt",
    status: "fixed",
  },
  {
    id: "F11",
    code: "VAL-06",
    title: "Tracker detection χωρίς χρονική/χωρική επιβεβαίωση — false positives",
    severity: "medium",
    category: "validation",
    file: "src/platform/ble.ts → classifyAdvert()",
    asked: "Εντοπισμός trackers (AirTag, SmartTag, Tile).",
    found: "Η ταξινόμηση βασίζεται μόνο σε company ID / service UUID τη στιγμή της διαφήμισης. Η 'follow' λογική (10 λεπτά) τρέχει μόνο στο WebView tick — χάνεται στο background. Δεν καταγράφεται ποτέ GPS trail για cross-location follow.",
    impact: "Κάθε AirTag που περνάει δίπλα σου (π.χ. σε καφέ) μπορεί να σημάνει συναγερμό. Και αντίστροφα: πραγματικό follow χάνεται αν κλείσει η οθόνη.",
    fix: "FollowDetector.kt: καταγράφει sightings (trackerId, timestamp, coarse location) σε Room DB, απαιτεί 3+ sightings σε 2+ διακριτές τοποθεσίες / 20 λεπτά πριν το HIGH alert. Σαφής κλίμακα: SEEN → SUSPECT → FOLLOWING.",
    fixedIn: "FollowDetector.kt",
    status: "fixed",
  },
  {
    id: "F12",
    code: "CON-03",
    title: "GATT inspection υπάρχει μόνο στο Web — στο APK το κουμπί είναι νεκρό",
    severity: "medium",
    category: "consistency",
    file: "src/platform/ble.ts → inspectWebDevice()",
    asked: "Έλεγχος διαρροής πληροφοριών συσκευής.",
    found: "Το inspectWebDevice() χρησιμοποιεί Web Bluetooth (navigator.bluetooth.requestDevice) που ΔΕΝ υπάρχει στο Capacitor WebView. Στο APK το κουμπί πετάει 'not supported' — αλλά το UI δεν το κρύβει.",
    impact: "Νεκρό feature στο APK. Ασυνέπεια μεταξύ web demo και APK.",
    fix: "GattInspector.kt (native BluetoothGatt read: Battery, Manufacturer, Model, Firmware) + bridge method inspectGatt(deviceId). Το UI καλεί native όταν caps.native, web όταν browser, και κρύβει το κουμπί όταν κανένα δεν υποστηρίζεται.",
    fixedIn: "GattInspector.kt + BlueShieldBridge.kt",
    status: "fixed",
  },
];

export const SEVERITY_META: Record<Severity, { label: string; color: string; bg: string; count: number }> = {
  critical: { label: "Critical", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", count: 3 },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", count: 6 },
  medium: { label: "Medium", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", count: 3 },
  info: { label: "Info", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30", count: 0 },
};

export interface IntegrationStep {
  n: number;
  title: string;
  detail: string;
  files: string[];
  minutes: number;
}

export const INTEGRATION_STEPS: IntegrationStep[] = [
  {
    n: 1,
    title: "Προσθήκη native Kotlin sources",
    detail: "Αντιγράψτε τα 9 αρχεία .kt στον φάκελο android/app/src/main/java/gr/blueshield/app/. Καμία αλλαγή στο React δεν απαιτείται ακόμα.",
    files: ["RootChecker.kt", "BluetoothController.kt", "PairingMonitorReceiver.kt"],
    minutes: 10,
  },
  {
    n: 2,
    title: "Αντικατάσταση AndroidManifest",
    detail: "Αντικαταστήστε το auto-generated Manifest με το διορθωμένο. Περιέχει όλα τα permissions ανά API level + declarations για receivers & foreground service.",
    files: ["AndroidManifest.xml"],
    minutes: 5,
  },
  {
    n: 3,
    title: "Καταχώρηση του Capacitor plugin",
    detail: "Προσθέστε το BlueShieldBridge στο MainActivity και το @CapacitorPlugin annotation. Συγχρονίστε με npx cap sync android.",
    files: ["BlueShieldBridge.kt", "MainActivity.kt"],
    minutes: 10,
  },
  {
    n: 4,
    title: "Αντικατάσταση ble.ts με ble-fixed.ts",
    detail: "Το νέο TS layer καλεί πρώτα το native bridge (LIVE) και μόνο ως fallback το Web Bluetooth — πάντα με σήμανση πηγής.",
    files: ["ble-fixed.ts"],
    minutes: 10,
  },
  {
    n: 5,
    title: "Εφαρμογή του store patch",
    detail: "Προσθέστε το origin field, τα LIVE/SIM badges και το 'Hide simulations' φίλτρο. Το patch είναι συμβατό με το υπάρχον zustand store.",
    files: ["useStore.patch.ts"],
    minutes: 15,
  },
  {
    n: 6,
    title: "Runtime permission flow + δοκιμή",
    detail: "Εγκαταστήστε σε 2 συσκευές (μία με Android ≤11, μία με 13+) και μία rooted. Ελέγξτε: scan, pairing alert, auto-off με root, greyed-out χωρίς root.",
    files: ["PermissionFlow.kt"],
    minutes: 30,
  },
];

export const PERMISSION_MATRIX = [
  { permission: "BLUETOOTH (legacy)", api29: "install", api31: "install", api33: "—", note: "Μόνο για API ≤30" },
  { permission: "BLUETOOTH_ADMIN", api29: "install", api31: "install", api33: "—", note: "Discovery σε παλιές εκδόσεις" },
  { permission: "BLUETOOTH_SCAN", api29: "—", api31: "runtime", api33: "runtime", note: "+ NEVER_FOR_LOCATION flag" },
  { permission: "BLUETOOTH_CONNECT", api29: "—", api31: "runtime", api33: "runtime", note: "Bonded list, GATT, profiles" },
  { permission: "BLUETOOTH_ADVERTISE", api29: "—", api31: "runtime", api33: "runtime", note: "Μόνο αν κάνετε advertise" },
  { permission: "ACCESS_FINE_LOCATION", api29: "runtime", api31: "runtime*", api33: "προαιρετικό", note: "*Απαιτείται για BLE scan σε API 29–30" },
  { permission: "POST_NOTIFICATIONS", api29: "—", api31: "—", api33: "runtime", note: "Χωρίς αυτό, κανένα alert σε 13+" },
  { permission: "FOREGROUND_SERVICE", api29: "install", api31: "install", api33: "install", note: "+ connectedDevice type" },
];

export const HONEST_LIMITS = [
  {
    title: "Καμία εφαρμογή δεν μπορεί να 'μπλοκάρει' πακέτα Bluetooth",
    detail: "Το Android δεν εκθέτει firewall API για τη στοίβα Bluetooth (L2CAP/RFCOMM). Ακόμα και με root, το packet filtering απαιτεί custom kernel module ή Magisk + iptables σε επίπεδο HCI — εκτός ορίων μιας Play-Store εφαρμογής. Αυτό που ΜΠΟΡΟΥΜΕ: να κλείνουμε το ραδιόφωνο, να απορρίπτουμε pairing, να αφαιρούμε bonds, να προειδοποιούμε.",
  },
  {
    title: "BlueBorne / KNOB / BIAS / BrakTooth διορθώνονται μόνο με update",
    detail: "Είναι ευπάθειες πρωτοκόλλου/firmware. Η εφαρμογή δεν μπορεί να κάνει patch το Bluetooth chip. Αυτό που ΜΠΟΡΟΥΜΕ: να διαβάζουμε το Security Patch Level και να λέμε με ειλικρίνεια 'VULNERABLE — κάνε update' αντί για ψεύτικο 'BLOCKED'.",
  },
  {
    title: "Χωρίς root, το Android 13+ απαγορεύει το programmatic OFF",
    detail: "Η μέθοδος BluetoothAdapter.disable() απαιτεί BLUETOOTH_PRIVILEGED (system app) ή root. Αυτό που ΜΠΟΡΟΥΜΕ χωρίς root: επίσημο intent για ON + deep-link στις Ρυθμίσεις για OFF με μία κίνηση. Με root: πραγματικό svc bluetooth disable.",
  },
  {
    title: "Το sniffing key capture δεν ανιχνεύεται από software",
    detail: "Ένας παθητικός sniffer (Ubertooth) δεν εκπέμπει τίποτα — είναι αόρατος. Αυτό που ΜΠΟΡΟΥΜΕ: να αποτρέπουμε το pairing σε δημόσιο χώρο (την επικίνδυνη στιγμή) και να επιβάλλουμε LE Secure Connections με 16-byte keys.",
  },
];
