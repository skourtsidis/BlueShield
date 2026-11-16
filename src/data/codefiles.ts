export interface CodeFile {
  id: string;
  name: string;
  lang: "kotlin" | "xml" | "typescript";
  path: string;
  fixes: string[];
  summary: string;
  code: string;
}

export const CODE_FILES: CodeFile[] = [
  {
    id: "manifest",
    name: "AndroidManifest.xml",
    lang: "xml",
    path: "android/app/src/main/AndroidManifest.xml",
    fixes: ["F10 · CON-02", "F05 · INT-01", "F06 · INT-02"],
    summary: "Πλήρες manifest με permissions ανά API level, foreground service, receivers και query intents. Αντικαθιστά το auto-generated της Capacitor.",
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- ===== Bluetooth — legacy (API <= 30) ===== -->
    <uses-permission android:name="android.permission.BLUETOOTH"
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"
        android:maxSdkVersion="30" />

    <!-- ===== Bluetooth — modern runtime (API 31+) ===== -->
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

    <!-- Location: REQUIRED for BLE scan on API 29-30,
         optional (coarse follow detection) on 31+ -->
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"
        android:maxSdkVersion="32" />

    <!-- Foreground protection service -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    <!-- Notifications (runtime on API 33+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <!-- Boot + battery -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

    <application
        android:label="BlueShield"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/AppTheme">

        <activity android:name=".MainActivity"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Real-time protection: foreground service -->
        <service
            android:name=".SecurityMonitorService"
            android:exported="false"
            android:foregroundServiceType="connectedDevice" />

        <!-- BLE scanner (bound to the monitor service) -->
        <service
            android:name=".BleScannerService"
            android:exported="false"
            android:foregroundServiceType="connectedDevice" />

        <!-- REAL pairing / bond / discovery events (fix F05) -->
        <receiver android:name=".PairingMonitorReceiver"
            android:exported="true">
            <intent-filter android:priority="999">
                <action android:name="android.bluetooth.device.action.PAIRING_REQUEST" />
                <action android:name="android.bluetooth.device.action.BOND_STATE_CHANGED" />
                <action android:name="android.bluetooth.device.action.FOUND" />
                <action android:name="android.bluetooth.adapter.action.DISCOVERY_FINISHED" />
                <action android:name="android.bluetooth.device.action.ACL_CONNECTED" />
                <action android:name="android.bluetooth.device.action.ACL_DISCONNECTED" />
            </intent-filter>
        </receiver>

        <!-- Adapter ON/OFF tracking (fix F03) -->
        <receiver android:name=".BluetoothStateReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.bluetooth.adapter.action.STATE_CHANGED" />
            </intent-filter>
        </receiver>

        <!-- Restart protection after reboot -->
        <receiver android:name=".BootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>`,
  },
  {
    id: "root",
    name: "RootChecker.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/RootChecker.kt",
    fixes: ["F04 · VAL-04"],
    summary: "Έλεγχος root με 5 ανεξάρτητες μεθόδους + δοκιμή πραγματικής παραχώρησης su. Αποτέλεσμα: NOT_ROOTED / ROOTED / ROOT_GRANTED.",
    code: `package gr.blueshield.app

import android.content.pm.PackageManager
import android.os.Build
import java.io.File

/** Root detection with 5 independent signals + live su grant test.
 *  Result drives which UI actions are enabled vs greyed-out. */
object RootChecker {

    enum class RootState {
        NOT_ROOTED,       // No root signs -> privileged actions greyed out
        ROOTED_NO_GRANT,  // su exists but user denied / no grant yet
        ROOT_GRANTED      // su -c id succeeded -> full control available
    }

    private val SU_PATHS = listOf(
        "/system/bin/su", "/system/xbin/su",
        "/sbin/su", "/su/bin/su",
        "/data/local/xbin/su", "/data/local/bin/su",
        "/system/sd/xbin/su", "/magisk/.core/bin/su"
    )
    private val ROOT_PACKAGES = listOf(
        "com.topjohnwu.magisk", "eu.chainfire.supersu",
        "com.koushikdutta.superuser", "com.noshufou.android.su"
    )

    /** Fast check: is the device rooted at all? */
    fun isDeviceRooted(pm: PackageManager): Boolean {
        // 1) test-keys build (engineering / custom ROM)
        if (Build.TAGS?.contains("test-keys") == true) return true
        // 2) su binary on disk
        if (SU_PATHS.any { File(it).exists() }) return true
        // 3) root manager app installed
        if (ROOT_PACKAGES.any { pkg ->
                try { pm.getPackageInfo(pkg, 0); true }
                catch (_: Exception) { false }
            }) return true
        // 4) 'which su' resolvable
        try {
            val p = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val out = p.inputStream.bufferedReader().readText()
            if (out.contains("su")) return true
        } catch (_: Exception) { }
        // 5) live grant test also implies rooted
        return isRootGranted()
    }

    /** Slow check (~300ms): can we ACTUALLY run commands as root? */
    fun isRootGranted(): Boolean {
        return try {
            val p = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
            val out = p.inputStream.bufferedReader().readText()
            p.waitFor()
            out.contains("uid=0")
        } catch (_: Exception) { false }
    }

    /** Full state for the UI layer. Call off the main thread. */
    fun check(pm: PackageManager): RootState {
        if (isRootGranted()) return RootState.ROOT_GRANTED
        if (isDeviceRooted(pm)) return RootState.ROOTED_NO_GRANT
        return RootState.NOT_ROOTED
    }

    /** Run a shell command, escalating to su when granted. */
    fun exec(cmd: String, asRoot: Boolean): String {
        val p = if (asRoot)
            Runtime.getRuntime().exec(arrayOf("su", "-c", cmd))
        else
            Runtime.getRuntime().exec(cmd)
        val out = p.inputStream.bufferedReader().readText()
        p.waitFor()
        return out.trim()
    }
}`,
  },
  {
    id: "btcontroller",
    name: "BluetoothController.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/BluetoothController.kt",
    fixes: ["F03 · VAL-03", "F04 · VAL-04"],
    summary: "Ο μόνος αληθινός διακόπτης Bluetooth. Με root εκτελεί svc commands· χωρίς root χρησιμοποιεί τα επίσημα intents. Ποτέ δεν ψεύδεται για την κατάσταση.",
    code: `package gr.blueshield.app

import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

/** Single source of truth for the Bluetooth radio.
 *  FIX F03: every read goes to the REAL adapter, never to a local boolean. */
class BluetoothController(private val ctx: Context) {

    companion object {
        const val REQ_ENABLE_BT = 9001
        const val ACTION_OPEN_BT_SETTINGS = Settings.ACTION_BLUETOOTH_SETTINGS
    }

    private val manager = ctx.getSystemService(BluetoothManager::class.java)
    val adapter: BluetoothAdapter? get() = manager?.adapter

    data class RadioState(
        val supported: Boolean,
        val enabled: Boolean,      // REAL adapter state
        val discoverable: Boolean,
        val rootState: RootChecker.RootState,
        val canProgrammaticOff: Boolean // true only with root / system app
    )

    fun getState(): RadioState {
        val a = adapter
        val root = RootChecker.check(ctx.packageManager)
        return RadioState(
            supported = a != null,
            enabled = a?.isEnabled == true,
            discoverable = a?.scanMode ==
                BluetoothAdapter.SCAN_MODE_CONNECTABLE_DISCOVERABLE,
            rootState = root,
            canProgrammaticOff = root == RootChecker.RootState.ROOT_GRANTED
        )
    }

    /** Turn ON: official system dialog (works without root). */
    fun requestEnable(activity: Activity) {
        val intent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
        activity.startActivityForResult(intent, REQ_ENABLE_BT)
    }

    /** Turn OFF — the honest implementation:
     *  - ROOT_GRANTED  -> real 'svc bluetooth disable' (instant, silent)
     *  - otherwise     -> open system BT settings (Android 13+ forbids
     *                     programmatic disable for normal apps).
     *  Returns true only if the radio was REALLY switched. */
    fun setEnabled(enabled: Boolean): SetResult {
        val a = adapter ?: return SetResult.NO_ADAPTER
        if ((a.isEnabled) == enabled) return SetResult.ALREADY
        val root = RootChecker.check(ctx.packageManager)

        if (root == RootChecker.RootState.ROOT_GRANTED) {
            return try {
                val cmd = if (enabled) "svc bluetooth enable"
                          else "svc bluetooth disable"
                RootChecker.exec(cmd, asRoot = true)
                Thread.sleep(600)
                if (a.isEnabled == enabled) SetResult.OK_ROOT
                else SetResult.FAILED
            } catch (_: Exception) { SetResult.FAILED }
        }
        // Non-root path
        if (enabled) {
            // Only the user-facing dialog can enable BT
            return SetResult.NEEDS_USER_INTENT
        }
        // Disable without root: impossible on API 33+ -> settings fallback
        return try {
            @Suppress("DEPRECATION")
            if (Build.VERSION.SDK_INT < 33) {
                @SuppressLint("MissingPermission")
                val ok = a.disable() // works on API <= 32
                if (ok) SetResult.OK_LEGACY else SetResult.NEEDS_SETTINGS
            } else SetResult.NEEDS_SETTINGS
        } catch (_: SecurityException) { SetResult.NEEDS_SETTINGS }
    }

    /** Open system Bluetooth settings (1-tap OFF for non-root users). */
    fun openSystemSettings() {
        ctx.startActivity(Intent(ACTION_OPEN_BT_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }

    @SuppressLint("MissingPermission")
    fun bondedDevices(): List<BondedInfo> =
        adapter?.bondedDevices?.map {
            BondedInfo(it.address, it.name ?: "Unnamed", it.type, it.bondState)
        } ?: emptyList()

    /** Remove a bond. Needs BLUETOOTH_CONNECT; on some ROMs needs root. */
    @SuppressLint("MissingPermission")
    fun removeBond(address: String): Boolean {
        val dev: BluetoothDevice = adapter?.getRemoteDevice(address) ?: return false
        return try {
            val m = dev.javaClass.getMethod("removeBond")
            m.invoke(dev) as Boolean
        } catch (_: Exception) { false }
    }

    enum class SetResult {
        OK_ROOT, OK_LEGACY, ALREADY,
        NEEDS_USER_INTENT, NEEDS_SETTINGS,
        NO_ADAPTER, FAILED
    }

    data class BondedInfo(
        val address: String, val name: String,
        val type: Int, val bondState: Int
    )
}`,
  },
  {
    id: "scanner",
    name: "BleScannerService.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/BleScannerService.kt",
    fixes: ["F02 · VAL-02", "F07 · INT-03"],
    summary: "Πραγματικό BLE scanning με BluetoothLeScanner. Στέλνει RSSI, manufacturer data και service UUIDs — η μόνη πηγή για το radar και τα γραφήματα.",
    code: `package gr.blueshield.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/** REAL BLE scanner. Replaces ALL simulated 'nearby devices'.
 *  Every advert is broadcast to the bridge as a live event. */
class BleScannerService : Service() {

    companion object {
        const val CH = "blueshield_scan"
        const val ACTION_ADVERT = "gr.blueshield.ADVERT"
        const val ACTION_STATS = "gr.blueshield.SCAN_STATS"
        var running = false; private set
    }

    private var scanner: BluetoothLeScanner? = null
    private var packetsThisSecond = 0
    private var lastStatsAt = 0L

    @SuppressLint("MissingPermission")
    private val callback = object : ScanCallback() {
        override fun onScanResult(type: Int, r: ScanResult) {
            packetsThisSecond++
            val rec = r.scanRecord ?: return
            // Forward REAL advert to bridge / monitor
            val i = Intent(ACTION_ADVERT).apply {
                setPackage(packageName)
                putExtra("address", r.device.address)
                putExtra("name", r.device.name ?: rec.deviceName)
                putExtra("rssi", r.rssi)
                putExtra("txPower", r.txPower)
                putExtra("mfrKeys", rec.manufacturerSpecificData?.let { keys ->
                    IntArray(keys.size()) { k -> keys.keyAt(k) }
                })
                putExtra("uuids", rec.serviceUuids?.map { it.toString() }
                    ?.toTypedArray())
                putExtra("ts", System.currentTimeMillis())
            }
            sendBroadcast(i)
            emitStatsIfDue()
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            results.forEach { onScanResult(ScanSettings.CALLBACK_TYPE_ALL_MATCHES, it) }
        }

        override fun onScanFailed(code: Int) {
            sendBroadcast(Intent(ACTION_STATS).apply {
                setPackage(packageName); putExtra("error", code)
            })
        }
    }

    private fun emitStatsIfDue() {
        val now = System.currentTimeMillis()
        if (now - lastStatsAt >= 1000) {
            val pps = packetsThisSecond
            packetsThisSecond = 0; lastStatsAt = now
            sendBroadcast(Intent(ACTION_STATS).apply {
                setPackage(packageName)
                putExtra("pps", pps) // REAL packets/sec for the chart
            })
        }
    }

    @SuppressLint("MissingPermission")
    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CH, "BlueShield scan", NotificationManager.IMPORTANCE_LOW))
        val n: Notification = NotificationCompat.Builder(this, CH)
            .setContentTitle("BlueShield scanning")
            .setContentText("Listening for BLE advertisements…")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .build()
        startForeground(11, n)

        val adapter = getSystemService(BluetoothManager::class.java)
            ?.adapter
        scanner = adapter?.bluetoothLeScanner
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setReportDelay(0)
            .apply {
                if (Build.VERSION.SDK_INT >= 26)
                    setPhy(ScanSettings.PHY_LE_ALL_SUPPORTED)
            }.build()
        scanner?.startScan(null, settings, callback)
        running = true
    }

    @SuppressLint("MissingPermission")
    override fun onDestroy() {
        try { scanner?.stopScan(callback) } catch (_: Exception) {}
        running = false
        super.onDestroy()
    }

    override fun onBind(i: Intent?): IBinder? = null
}`,
  },
  {
    id: "pairing",
    name: "PairingMonitorReceiver.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/PairingMonitorReceiver.kt",
    fixes: ["F05 · INT-01"],
    summary: "Πραγματική παρακολούθηση pairing/bond/ACL events. Προαιρετικό auto-reject αγνώστων αιτημάτων όταν επιτρέπεται.",
    code: `package gr.blueshield.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** REAL pairing monitor. Every event here is dataSource='live'.
 *  Fixes F05: the app finally KNOWS when pairing happens. */
class PairingMonitorReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_THREAT = "gr.blueshield.THREAT"
    }

    @SuppressLint("MissingPermission")
    override fun onReceive(ctx: Context, intent: Intent) {
        val dev: BluetoothDevice? =
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        val prefs = ctx.getSharedPreferences("blueshield", Context.MODE_PRIVATE)
        val autoReject = prefs.getBoolean("autoRejectUnknown", false)
        val trustedOnly = prefs.getBoolean("pairingOnlyTrusted", false)
        val location = prefs.getString("locationCtx", "home") ?: "home"

        fun emit(kind: String, title: String, desc: String, sev: String) {
            ctx.sendBroadcast(Intent(ACTION_THREAT).apply {
                setPackage(ctx.packageName)
                putExtra("kind", kind)
                putExtra("title", title)
                putExtra("desc", desc)
                putExtra("sev", sev)
                putExtra("device", dev?.name ?: "Unknown")
                putExtra("mac", dev?.address ?: "")
                putExtra("ts", System.currentTimeMillis())
            })
        }

        when (intent.action) {
            BluetoothDevice.ACTION_PAIRING_REQUEST -> {
                val variant = intent.getIntExtra(
                    BluetoothDevice.EXTRA_PAIRING_VARIANT, -1)
                val inPublic = location == "public"
                // Attempt auto-reject for unknown devices in public places
                if ((autoReject || (trustedOnly && inPublic))) {
                    try {
                        abortBroadcast() // needs high-priority receiver
                        val m = dev?.javaClass?.getMethod(
                            "cancelPairing")
                        if (m?.invoke(dev) == true) {
                            emit("pairing", "Pairing auto-rejected (LIVE)",
                                "Blocked pairing request from " +
                                "\${dev?.name} in a public place.", "high")
                            return
                        }
                    } catch (_: Exception) {}
                }
                emit("pairing", "Pairing request (LIVE)",
                    "Device \${dev?.name} (\${dev?.address}) " +
                    "requests pairing (variant \$variant)." +
                    if (inPublic) " You are in a PUBLIC place — " +
                        "keys could be sniffed!" else "", "high")
            }
            BluetoothDevice.ACTION_BOND_STATE_CHANGED -> {
                val state = intent.getIntExtra(
                    BluetoothDevice.EXTRA_BOND_STATE, -1)
                val prev = intent.getIntExtra(
                    BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE, -1)
                if (state == BluetoothDevice.BOND_BONDED)
                    emit("bond", "New bond created (LIVE)",
                        "\${dev?.name} is now bonded. Verify you " +
                        "initiated this.", "medium")
                else if (prev == BluetoothDevice.BOND_BONDED &&
                         state == BluetoothDevice.BOND_NONE)
                    emit("bond", "Bond removed (LIVE)",
                        "\${dev?.name} was unpaired.", "info")
            }
            BluetoothDevice.ACTION_ACL_CONNECTED ->
                emit("acl", "Device connected (LIVE)",
                    "\${dev?.name} opened an ACL link.", "info")
            BluetoothDevice.ACTION_ACL_DISCONNECTED ->
                emit("acl", "Device disconnected (LIVE)",
                    "\${dev?.name} closed its ACL link.", "info")
            BluetoothDevice.ACTION_FOUND ->
                emit("found", "Classic device found (LIVE)",
                    "\${dev?.name} (\${dev?.address}) is " +
                    "discoverable nearby.", "info")
        }
    }
}`,
  },
  {
    id: "monitor",
    name: "SecurityMonitorService.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/SecurityMonitorService.kt",
    fixes: ["F06 · INT-02", "F03 · VAL-03", "F02 · VAL-02"],
    summary: "Foreground service: η καρδιά της πραγματικής προστασίας. Idle auto-off (πραγματικό με root), DoS heuristics, battery drain, notifications.",
    code: `package gr.blueshield.app

import android.annotation.SuppressLint
import android.app.*
import android.bluetooth.BluetoothAdapter
import android.content.*
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/** Always-on protection engine. This is what makes AUTO mode REAL.
 *  The WebView becomes a dashboard; decisions happen HERE. */
class SecurityMonitorService : Service() {

    companion object {
        const val CH = "blueshield_protect"
        const val ACTION_NOTIFY_OFF = "gr.blueshield.NOTIFY_OFF"
        var running = false; private set
    }

    private lateinit var bt: BluetoothController
    private var lastActivity = System.currentTimeMillis()
    private var autoOffNotified = false
    private var ppsWindow = ArrayDeque<Int>()
    private var lastBattery = -1; private var lastBatteryAt = 0L

    private val threats = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent) {
            lastActivity = System.currentTimeMillis()
        }
    }
    private val stats = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent) {
            val pps = i.getIntExtra("pps", 0)
            ppsWindow.addLast(pps); if (ppsWindow.size > 10) ppsWindow.removeFirst()
            checkFlood(pps)
        }
    }
    private val btState = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent) {
            if (i.action == BluetoothAdapter.ACTION_STATE_CHANGED) {
                val st = i.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1)
                if (st == BluetoothAdapter.STATE_ON)
                    lastActivity = System.currentTimeMillis()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        bt = BluetoothController(this)
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(
            CH, "BlueShield protection", NotificationManager.IMPORTANCE_LOW))
        startForeground(21, NotificationCompat.Builder(this, CH)
            .setContentTitle("BlueShield protection active")
            .setContentText("Monitoring Bluetooth threats…")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .build())
        registerReceiver(threats, IntentFilter(PairingMonitorReceiver.ACTION_THREAT),
            RECEIVER_NOT_EXPORTED)
        registerReceiver(stats, IntentFilter(BleScannerService.ACTION_STATS),
            RECEIVER_NOT_EXPORTED)
        registerReceiver(btState, IntentFilter(
            BluetoothAdapter.ACTION_STATE_CHANGED), RECEIVER_EXPORTED)
        startService(Intent(this, BleScannerService::class.java))
        running = true
        Thread(watchdog).start()
    }

    /** Watchdog: idle auto-off + battery drain (runs every 30s). */
    private val watchdog = Runnable {
        while (running) {
            try { Thread.sleep(30_000) } catch (_: Exception) { break }
            val prefs = getSharedPreferences("blueshield", MODE_PRIVATE)
            if (prefs.getString("radioMode", "on") != "auto") continue
            val s = bt.getState()
            if (!s.enabled) { autoOffNotified = false; continue }
            val idleMin = prefs.getInt("autoOffMinutes", 10)
            val idle = System.currentTimeMillis() - lastActivity >
                    idleMin * 60_000L
            // Any bonded device connected? -> not idle
            val connected = bt.bondedDevices().isNotEmpty() &&
                    lastActivity > System.currentTimeMillis() - 60_000
            if (idle && !connected) {
                if (s.rootState == RootChecker.RootState.ROOT_GRANTED) {
                    // REAL programmatic OFF (rooted only)
                    bt.setEnabled(false)
                    notify("Bluetooth turned OFF (AUTO + root)",
                        "Idle for \$idleMin min — radio disabled.")
                } else if (!autoOffNotified) {
                    autoOffNotified = true
                    notify("Recommended: turn Bluetooth off",
                        "Idle for \$idleMin min. Tap to open settings " +
                        "(Android 13+ needs one manual tap).",
                        openSettings = true)
                }
            }
            checkBatteryDrain()
        }
    }

    /** DoS heuristic: sustained > threshold pps for 10s. */
    private fun checkFlood(pps: Int) {
        val prefs = getSharedPreferences("blueshield", MODE_PRIVATE)
        val thr = prefs.getInt("dosThreshold", 300)
        if (ppsWindow.size >= 10 && ppsWindow.average() > thr) {
            notify("Possible BLE flood (LIVE)",
                "Sustained \${ppsWindow.average().toInt()} packets/sec. " +
                "Consider turning Bluetooth off.")
            ppsWindow.clear()
        }
    }

    private fun checkBatteryDrain() {
        val bm = getSystemService(BatteryManager::class.java)
        val lvl = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val now = System.currentTimeMillis()
        if (lastBattery >= 0 && lastBatteryAt > 0) {
            val dtMin = (now - lastBatteryAt) / 60000.0
            val dropPerHour = (lastBattery - lvl) / dtMin * 60
            if (dropPerHour > 15 && bt.getState().enabled)
                notify("Abnormal battery drain (LIVE)",
                    "Losing ~\${dropPerHour.toInt()}%/h with Bluetooth " +
                    "on — possible Bluesmack flood.")
        }
        lastBattery = lvl; lastBatteryAt = now
    }

    @SuppressLint("MissingPermission")
    private fun notify(title: String, text: String, openSettings: Boolean = false) {
        val nm = getSystemService(NotificationManager::class.java)
        val intent = if (openSettings)
            Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS)
        else packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(this, title.hashCode(),
            intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) return
        nm.notify(title.hashCode(), NotificationCompat.Builder(this, CH)
            .setContentTitle(title).setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentIntent(pi).setAutoCancel(true).build())
    }

    override fun onStartCommand(i: Intent?, f: Int, id: Int): Int =
        START_STICKY

    override fun onDestroy() {
        running = false
        try {
            unregisterReceiver(threats); unregisterReceiver(stats)
            unregisterReceiver(btState)
        } catch (_: Exception) {}
        super.onDestroy()
    }

    override fun onBind(i: Intent?): IBinder? = null
}`,
  },
  {
    id: "vuln",
    name: "VulnerabilityAssessor.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/VulnerabilityAssessor.kt",
    fixes: ["F08 · VAL-05"],
    summary: "Ειλικρινής έλεγχος BlueBorne/KNOB/BIAS/BrakTooth μέσω Security Patch Level. Λέει PATCHED ή VULNERABLE — ποτέ ψεύτικο BLOCKED.",
    code: `package gr.blueshield.app

import android.os.Build
import java.time.LocalDate

/** Honest firmware-vulnerability assessment.
 *  These CVEs can ONLY be fixed by system updates —
 *  so we report patch status instead of fake 'blocks'. */
object VulnerabilityAssessor {

    data class Verdict(
        val id: String,            // "blueborne"
        val cve: String,           // "CVE-2017-0781…"
        val status: Status,        // PATCHED / VULNERABLE / UNKNOWN
        val fixedAfter: String,    // patch level that fixed it
        val devicePatch: String,   // this device's patch level
        val advice: String
    )
    enum class Status { PATCHED, VULNERABLE, UNKNOWN }

    // Earliest Android SPL containing each fix (conservative).
    private val FIXED = mapOf(
        "blueborne" to "2017-09-01",  // CVE-2017-0781/0782/0783/0785
        "knob"      to "2020-02-01",  // min entropy enforced
        "bias"      to "2020-06-01",  // auth checks hardened
        "braktooth" to "2022-03-01"   // BlueDroid + chip FW
    )
    private val CVE = mapOf(
        "blueborne" to "CVE-2017-0781…0785",
        "knob" to "CVE-2019-9506",
        "bias" to "CVE-2020-10135",
        "braktooth" to "CVE-2021-32320… (BrakTooth set)"
    )

    fun assess(): List<Verdict> {
        val spl = try { Build.VERSION.SECURITY_PATCH } // "2024-11-05"
                  catch (_: Exception) { "unknown" }
        return FIXED.map { (id, fixedAfter) ->
            val st = comparePatch(spl, fixedAfter)
            Verdict(
                id = id, cve = CVE[id] ?: "",
                status = st, fixedAfter = fixedAfter, devicePatch = spl,
                advice = when (st) {
                    Status.PATCHED -> "Your patch level includes the " +
                        "official fix. Keep auto-updates on."
                    Status.VULNERABLE -> "VULNERABLE: update Android " +
                        "immediately. Until then, keep Bluetooth OFF " +
                        "in public places."
                    Status.UNKNOWN -> "Could not read patch level. " +
                        "Check Settings → About → Security update."
                }
            )
        }
    }

    private fun comparePatch(device: String, fixed: String): Status {
        return try {
            val d = LocalDate.parse(device.take(10))
            val f = LocalDate.parse(fixed)
            if (!d.isBefore(f)) Status.PATCHED else Status.VULNERABLE
        } catch (_: Exception) { Status.UNKNOWN }
    }
}`,
  },
  {
    id: "bridge",
    name: "BlueShieldBridge.kt",
    lang: "kotlin",
    path: "android/app/src/main/java/gr/blueshield/app/BlueShieldBridge.kt",
    fixes: ["F07 · INT-03", "F04 · VAL-04", "F12 · CON-03"],
    summary: "Capacitor plugin: η γέφυρα JS↔Native. 11 methods + live event listeners. Καταχωρείται στο MainActivity.",
    code: `package gr.blueshield.app

import android.content.*
import android.os.Build
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod

/** Capacitor bridge: exposes REAL native data to the React UI.
 *  Register in MainActivity: registerPlugin(BlueShieldBridge::class.java) */
@CapacitorPlugin(name = "BlueShieldNative")
class BlueShieldBridge : Plugin() {

    private val bt by lazy { BluetoothController(context) }
    private var receiversOn = false

    private val advert = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent) {
            val r = JSObject().apply {
                put("address", i.getStringExtra("address"))
                put("name", i.getStringExtra("name"))
                put("rssi", i.getIntExtra("rssi", -100))
                put("ts", i.getLongExtra("ts", 0))
            }
            notifyListeners("scanResult", r)
        }
    }
    private val threat = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent) {
            notifyListeners("threatEvent", JSObject().apply {
                put("kind", i.getStringExtra("kind"))
                put("title", i.getStringExtra("title"))
                put("desc", i.getStringExtra("desc"))
                put("sev", i.getStringExtra("sev"))
                put("device", i.getStringExtra("device"))
                put("ts", i.getLongExtra("ts", 0))
            })
        }
    }

    override fun load() {
        if (!receiversOn) {
            context.registerReceiver(advert,
                IntentFilter(BleScannerService.ACTION_ADVERT),
                Context.RECEIVER_NOT_EXPORTED)
            context.registerReceiver(threat,
                IntentFilter(PairingMonitorReceiver.ACTION_THREAT),
                Context.RECEIVER_NOT_EXPORTED)
            receiversOn = true
        }
    }

    @PluginMethod
    fun checkRoot(call: PluginCall) {
        Thread {
            val s = RootChecker.check(context.packageManager)
            call.resolve(JSObject().apply {
                put("state", s.name)
                put("rooted", s != RootChecker.RootState.NOT_ROOTED)
                put("granted", s == RootChecker.RootState.ROOT_GRANTED)
            })
        }.start()
    }

    @PluginMethod
    fun getRadioState(call: PluginCall) {
        val s = bt.getState()
        call.resolve(JSObject().apply {
            put("supported", s.supported)
            put("enabled", s.enabled) // REAL adapter state
            put("discoverable", s.discoverable)
            put("canProgrammaticOff", s.canProgrammaticOff)
            put("rootState", s.rootState.name)
        })
    }

    @PluginMethod
    fun setBluetoothEnabled(call: PluginCall) {
        val want = call.getBoolean("enabled") ?: return call.reject("need enabled")
        Thread {
            when (bt.setEnabled(want)) {
                BluetoothController.SetResult.OK_ROOT ->
                    call.resolve(JSObject().put("method", "root"))
                BluetoothController.SetResult.OK_LEGACY ->
                    call.resolve(JSObject().put("method", "legacy"))
                BluetoothController.SetResult.NEEDS_SETTINGS -> {
                    bt.openSystemSettings()
                    call.resolve(JSObject().put("method", "settings"))
                }
                BluetoothController.SetResult.NEEDS_USER_INTENT ->
                    call.resolve(JSObject().put("method", "needIntent"))
                else -> call.resolve(JSObject().put("method", "noop"))
            }
        }.start()
    }

    @PluginMethod
    fun getBonded(call: PluginCall) {
        try {
            val arr = JSArray(bt.bondedDevices().map { d ->
                JSObject().apply {
                    put("address", d.address); put("name", d.name)
                }
            })
            call.resolve(JSObject().put("devices", arr))
        } catch (e: SecurityException) { call.reject("BLUETOOTH_CONNECT missing") }
    }

    @PluginMethod
    fun removeBond(call: PluginCall) {
        val a = call.getString("address") ?: return call.reject("need address")
        call.resolve(JSObject().put("ok", bt.removeBond(a)))
    }

    @PluginMethod
    fun startProtection(call: PluginCall) {
        context.startForegroundService(
            Intent(context, SecurityMonitorService::class.java))
        call.resolve()
    }

    @PluginMethod
    fun getPatchVerdicts(call: PluginCall) {
        val arr = JSArray(VulnerabilityAssessor.assess().map { v ->
            JSObject().apply {
                put("id", v.id); put("cve", v.cve)
                put("status", v.status.name)
                put("devicePatch", v.devicePatch)
                put("advice", v.advice)
            }
        })
        call.resolve(JSObject().apply {
            put("patch", try { Build.VERSION.SECURITY_PATCH }
                catch (_: Exception) { "unknown" })
            put("verdicts", arr)
        })
    }

    @PluginMethod
    fun openBluetoothSettings(call: PluginCall) {
        bt.openSystemSettings(); call.resolve()
    }
}`,
  },
  {
    id: "blefixed",
    name: "ble-fixed.ts",
    lang: "typescript",
    path: "src/platform/ble-fixed.ts  (replaces ble.ts)",
    fixes: ["F09 · CON-01", "F07 · INT-03", "F02 · VAL-02"],
    summary: "Νέο TypeScript layer: προτιμά πάντα το native bridge, επισημαίνει κάθε datum με origin: live|sim και απαγορεύει ψεύτικα δεδομένα στο LIVE mode.",
    code: `import { Capacitor, registerPlugin } from '@capacitor/core';

/** Every datum in the UI MUST carry its origin. */
export type Origin = 'live' | 'sim';
export interface LiveAdvert {
  id: string; name: string | null; rssi: number;
  origin: Origin; t: number;
}

interface NativeBridge {
  checkRoot(): Promise<{ state: string; rooted: boolean; granted: boolean }>;
  getRadioState(): Promise<{ enabled: boolean; discoverable: boolean;
    canProgrammaticOff: boolean; rootState: string }>;
  setBluetoothEnabled(o: { enabled: boolean }): Promise<{ method: string }>;
  getBonded(): Promise<{ devices: { address: string; name: string }[] }>;
  removeBond(o: { address: string }): Promise<{ ok: boolean }>;
  startProtection(): Promise<void>;
  getPatchVerdicts(): Promise<{ patch: string;
    verdicts: { id: string; status: string; advice: string }[] }>;
  openBluetoothSettings(): Promise<void>;
  addListener(e: 'scanResult', f: (d: any) => void): Promise<any>;
  addListener(e: 'threatEvent', f: (d: any) => void): Promise<any>;
}
const Native = Capacitor.isNativePlatform()
  ? registerPlugin<NativeBridge>('BlueShieldNative') : null;

export const hasNative = () => Native != null;

/** Root state -> drives greyed-out UI (requirement). */
export type RootUI = 'active' | 'required' | 'denied';
export async function getRootUI(): Promise<{
  ui: RootUI; label: string; canAutoOff: boolean;
}> {
  if (!Native) return { ui: 'required',
    label: 'Native bridge unavailable (web preview)',
    canAutoOff: false };
  const r = await Native.checkRoot();
  if (r.granted) return { ui: 'active',
    label: 'ROOT ACTIVE — full radio control available',
    canAutoOff: true };
  if (r.rooted) return { ui: 'denied',
    label: 'Rooted but not granted — grant su to BlueShield',
    canAutoOff: false };
  return { ui: 'required',
    label: 'Auto-OFF unavailable (greyed out) — requires root. ' +
           'You can still turn Bluetooth off manually via Settings.',
    canAutoOff: false };
}

/** REAL radio read — never a local boolean. */
export async function readRadio(): Promise<{
  enabled: boolean; discoverable: boolean; origin: Origin;
}> {
  if (!Native) return { enabled: false, discoverable: false, origin: 'sim' };
  const s = await Native.getRadioState();
  return { enabled: s.enabled, discoverable: s.discoverable, origin: 'live' };
}

/** Honest setter: returns HOW it was done so UI tells the truth. */
export async function setRadio(enabled: boolean): Promise<{
  method: 'root' | 'legacy' | 'settings' | 'needIntent' | 'noop';
  message: string;
}> {
  if (!Native) return { method: 'noop',
    message: 'Web preview: radio control needs the APK.' };
  const r = await Native.setBluetoothEnabled({ enabled });
  const m = r.method as any;
  const message = m === 'root'
    ? (enabled ? 'Bluetooth ON (root)' : 'Bluetooth OFF (root) — real switch ✓')
    : m === 'settings'
    ? 'Opened system Bluetooth settings — finish with one tap ' +
      '(Android 13+ restriction, no root)'
    : m === 'needIntent'
    ? 'Confirm the system dialog to enable Bluetooth.'
    : 'No change needed.';
  return { method: m, message };
}

// Live advert buffer — ONLY filled by native callbacks.
// When empty and scanning, charts show "waiting for data", NEVER fake curves.
const buf = new Map<string, LiveAdvert>();
export function attachLiveListeners(onThreat: (t: any) => void) {
  Native?.addListener('scanResult', (d) => {
    buf.set(d.address, { id: d.address, name: d.name ?? null,
      rssi: d.rssi, origin: 'live', t: Date.now() });
  });
  Native?.addListener('threatEvent', (t) =>
    onThreat({ ...t, origin: 'live' as Origin }));
}
export function drainLive(): LiveAdvert[] {
  const a = [...buf.values()]; buf.clear(); return a;
}

export { Native as BlueShieldNative };`,
  },
  {
    id: "storepatch",
    name: "useStore.patch.ts",
    lang: "typescript",
    path: "src/store/useStore.patch.ts  (apply to useStore.ts)",
    fixes: ["F09 · CON-01", "F01 · VAL-01"],
    summary: "Patch κανόνων συνέπειας: υποχρεωτικό origin, φίλτρο Hide simulations, πραγματικό security score μόνο από live events.",
    code: `// ============================================================
 // BlueShield consistency patch — apply to src/store/useStore.ts
 // Rule 1: NOTHING renders without an explicit origin.
 // Rule 2: Simulations NEVER affect the security score when hidden.
 // Rule 3: Charts render ONLY live-fed series.
 // ============================================================

export type Origin = 'live' | 'sim';

// 1) Extend the event + device types:
interface PatchedEvent {
  origin: Origin;          // REQUIRED — replaces loose 'simulated?'
  moduleId: string | null;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  // ... rest unchanged
}

// 2) addEvent: default origin = 'sim' (safe default),
//    native bridge events pass origin: 'live' explicitly.
function addEvent(e: PatchedEvent & { origin?: Origin }) {
  const origin: Origin = e.origin ?? 'sim';
  // store with origin...
}

// 3) Security score counts ONLY live events when
//    settings.hideSimulations === true (default true in APK):
function score(events: PatchedEvent[], hideSim: boolean): number {
  const pool = hideSim ? events.filter((e) => e.origin === 'live') : events;
  if (!pool.length) return 100; // no live threats seen
  const w = { info: 0, low: 1, medium: 3, high: 7, critical: 12 };
  const penalty = pool.reduce((s, e) =>
    s + (w[e.severity] ?? 0), 0);
  return Math.max(5, 100 - penalty);
}

// 4) Radar: two separate arrays — never merged silently.
interface RadarState {
  liveDevices: LiveDevice[];   // from drainLive()
  simDevices: SimDevice[];     // from sim.ts, ONLY if !hideSimulations
}
// Render: live = cyan dots, sim = amber dots with "SIM" tag.

// 5) Timeline chart: feed ONLY from native pps broadcasts.
//    If no live sample for >3s -> show gap + "NO LIVE DATA"
//    instead of interpolating fake points.

// 6) Settings addition:
interface SettingsPatch {
  hideSimulations: boolean;  // default: true on APK, false on web demo
  autoRejectUnknown: boolean;
  pairingOnlyTrusted: boolean;
}

// 7) Module verdicts for firmware CVEs come from
//    Native.getPatchVerdicts() — display PATCHED/VULNERABLE
//    badges; the ON/OFF switch becomes "monitor + advise",
//    never "block".`,
  },
];
