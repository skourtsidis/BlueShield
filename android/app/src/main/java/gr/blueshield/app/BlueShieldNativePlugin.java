package gr.blueshield.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * BlueShield native bridge. Every value returned here is read from the operating system.
 * Operations that need superuser rights (su) report "not available" when root is missing,
 * so the web layer can grey them out instead of pretending they worked.
 */
@CapacitorPlugin(
    name = "BlueShieldNative",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetoothScan"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetoothConnect"),
        @Permission(
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION },
            alias = "location"
        )
    }
)
public class BlueShieldNativePlugin extends Plugin {

    private static final String[] SU_PATHS = {
        "/system/bin/su",
        "/system/xbin/su",
        "/sbin/su",
        "/su/bin/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/data/local/su",
        "/system/sd/xbin/su",
        "/system/bin/failsafe/su",
        "/system/xbin/daemonsu",
    };

    private static final int MAX_OUTPUT_CHARS = 1000000;

    private final ExecutorService worker = Executors.newCachedThreadPool();

    private static final class CommandResult {
        final int exitCode;
        final String output;

        CommandResult(int exitCode, String output) {
            this.exitCode = exitCode;
            this.output = output;
        }
    }

    /* ----------------------------- helpers ----------------------------- */

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    private boolean granted(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasScanPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || granted(Manifest.permission.BLUETOOTH_SCAN);
    }

    private boolean hasConnectPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || granted(Manifest.permission.BLUETOOTH_CONNECT);
    }

    private boolean hasLocationPermission() {
        return granted(Manifest.permission.ACCESS_FINE_LOCATION) || granted(Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    private static boolean isEnabledSafe(BluetoothAdapter adapter) {
        try {
            return adapter.isEnabled();
        } catch (SecurityException e) {
            return false;
        }
    }

    private static boolean waitForState(BluetoothAdapter adapter, boolean target, long timeoutMs) {
        long end = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < end) {
            if (isEnabledSafe(adapter) == target) return true;
            try {
                Thread.sleep(250);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }
        return isEnabledSafe(adapter) == target;
    }

    private JSObject permissionJson() {
        JSObject o = new JSObject();
        o.put("scan", hasScanPermission());
        o.put("connect", hasConnectPermission());
        o.put("location", hasLocationPermission());
        o.put("needsLocation", Build.VERSION.SDK_INT < Build.VERSION_CODES.S);
        o.put("sdkInt", Build.VERSION.SDK_INT);
        return o;
    }

    private String safeName(BluetoothDevice device) {
        if (!hasConnectPermission()) return "";
        try {
            String n = device.getName();
            return n == null ? "" : n;
        } catch (SecurityException e) {
            return "";
        }
    }

    private String transportOf(BluetoothDevice device) {
        if (!hasConnectPermission()) return "unknown";
        try {
            switch (device.getType()) {
                case BluetoothDevice.DEVICE_TYPE_CLASSIC:
                    return "classic";
                case BluetoothDevice.DEVICE_TYPE_LE:
                    return "le";
                case BluetoothDevice.DEVICE_TYPE_DUAL:
                    return "dual";
                default:
                    return "unknown";
            }
        } catch (SecurityException e) {
            return "unknown";
        }
    }

    private String majorClassOf(BluetoothDevice device) {
        if (!hasConnectPermission()) return "unknown";
        try {
            BluetoothClass cls = device.getBluetoothClass();
            if (cls == null) return "unknown";
            switch (cls.getMajorDeviceClass()) {
                case BluetoothClass.Device.Major.AUDIO_VIDEO:
                    return "audio";
                case BluetoothClass.Device.Major.PHONE:
                    return "phone";
                case BluetoothClass.Device.Major.COMPUTER:
                    return "computer";
                case BluetoothClass.Device.Major.WEARABLE:
                    return "wearable";
                case BluetoothClass.Device.Major.PERIPHERAL:
                    return "peripheral";
                case BluetoothClass.Device.Major.HEALTH:
                    return "health";
                case BluetoothClass.Device.Major.IMAGING:
                    return "imaging";
                case BluetoothClass.Device.Major.NETWORKING:
                    return "network";
                case BluetoothClass.Device.Major.TOY:
                    return "toy";
                default:
                    return "unknown";
            }
        } catch (SecurityException e) {
            return "unknown";
        }
    }

    /**
     * Runs a command and collects its output. The output is read on a separate thread so that a
     * blocked superuser prompt can never stall the caller beyond the timeout.
     */
    private static CommandResult run(String[] command, long timeoutMs) {
        final Process process;
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.redirectErrorStream(true);
            process = builder.start();
        } catch (Exception e) {
            return null;
        }
        final StringBuffer out = new StringBuffer();
        Thread reader = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    if (out.length() < MAX_OUTPUT_CHARS) out.append(line).append('\n');
                }
            } catch (Exception ignored) {
                // stream closed
            }
        });
        reader.setDaemon(true);
        reader.start();
        try {
            boolean finished = process.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new CommandResult(-1, out.toString());
            }
            reader.join(1500);
            return new CommandResult(process.exitValue(), out.toString());
        } catch (InterruptedException e) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private static String snippet(String text) {
        if (text == null) return "";
        String t = text.trim().replace('\n', ' ');
        return t.length() > 160 ? t.substring(0, 160) + "…" : t;
    }

    /* ----------------------------- device & root ----------------------------- */

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject o = new JSObject();
        o.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        o.put("brand", Build.BRAND == null ? "" : Build.BRAND);
        o.put("model", Build.MODEL == null ? "" : Build.MODEL);
        o.put("androidVersion", Build.VERSION.RELEASE == null ? "" : Build.VERSION.RELEASE);
        o.put("sdkInt", Build.VERSION.SDK_INT);
        o.put("securityPatch", Build.VERSION.SECURITY_PATCH == null ? "" : Build.VERSION.SECURITY_PATCH);
        o.put("buildTags", Build.TAGS == null ? "" : Build.TAGS);
        call.resolve(o);
    }

    /** Real root check: a su binary must exist AND answer with uid=0. */
    @PluginMethod
    public void getRootStatus(PluginCall call) {
        worker.execute(() -> {
            boolean suBinary = false;
            for (String path : SU_PATHS) {
                if (new File(path).exists()) {
                    suBinary = true;
                    break;
                }
            }
            boolean testKeys = Build.TAGS != null && Build.TAGS.contains("test-keys");
            CommandResult id = run(new String[] { "su", "-c", "id" }, 6000);
            boolean granted = id != null && id.output.contains("uid=0");
            String message;
            if (granted) {
                message = "Root access granted (su returned uid=0).";
            } else if (id == null && !suBinary) {
                message = "No su binary found. This device is not rooted.";
            } else if (id == null) {
                message = "A su binary exists but could not be executed.";
            } else if (id.exitCode == -1) {
                message = "The root request timed out. Open your superuser manager and try again.";
            } else {
                message = "Root access was denied by the superuser manager.";
            }
            JSObject o = new JSObject();
            o.put("granted", granted);
            o.put("suBinary", suBinary);
            o.put("testKeys", testKeys);
            o.put("message", message);
            call.resolve(o);
        });
    }

    /* ----------------------------- bluetooth state ----------------------------- */

    @PluginMethod
    public void getBluetoothState(PluginCall call) {
        JSObject o = new JSObject();
        boolean hasBt = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH);
        boolean hasBle = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        BluetoothAdapter adapter = adapter();
        boolean enabled = false;
        String scanMode = "unknown";
        String name = "";
        if (adapter != null) {
            enabled = isEnabledSafe(adapter);
            try {
                int mode = adapter.getScanMode();
                if (mode == BluetoothAdapter.SCAN_MODE_CONNECTABLE_DISCOVERABLE) scanMode = "discoverable";
                else if (mode == BluetoothAdapter.SCAN_MODE_CONNECTABLE) scanMode = "connectable";
                else if (mode == BluetoothAdapter.SCAN_MODE_NONE) scanMode = "none";
            } catch (SecurityException ignored) {
                scanMode = "unknown";
            }
            if (hasConnectPermission()) {
                try {
                    String n = adapter.getName();
                    name = n == null ? "" : n;
                } catch (SecurityException ignored) {
                    name = "";
                }
            }
        }
        o.put("hasBluetooth", hasBt && adapter != null);
        o.put("hasBle", hasBle);
        o.put("enabled", enabled);
        o.put("scanMode", scanMode);
        o.put("discoverable", "discoverable".equals(scanMode));
        o.put("name", name);
        call.resolve(o);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        List<String> aliases = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasScanPermission()) aliases.add("bluetoothScan");
            if (!hasConnectPermission()) aliases.add("bluetoothConnect");
        } else if (!hasLocationPermission()) {
            aliases.add("location");
        }
        if (aliases.isEmpty()) {
            call.resolve(permissionJson());
            return;
        }
        requestPermissionForAliases(aliases.toArray(new String[0]), call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        call.resolve(permissionJson());
    }

    /** Turns Bluetooth on/off. Turning it OFF (and ON when rooted) needs root: it runs svc via su. */
    @PluginMethod
    public void setRadio(PluginCall call) {
        Boolean requested = call.getBoolean("enabled");
        if (requested == null) {
            call.reject("Missing 'enabled' value.");
            return;
        }
        final boolean enable = requested;
        final BluetoothAdapter adapter = adapter();
        worker.execute(() -> {
            JSObject o = new JSObject();
            if (adapter == null) {
                o.put("ok", false);
                o.put("enabled", false);
                o.put("message", "This device has no Bluetooth adapter.");
                call.resolve(o);
                return;
            }
            if (isEnabledSafe(adapter) == enable) {
                o.put("ok", true);
                o.put("enabled", enable);
                o.put("message", "Bluetooth is already " + (enable ? "on" : "off") + ".");
                call.resolve(o);
                return;
            }
            String verb = enable ? "enable" : "disable";
            String[][] attempts = {
                { "su", "-c", "svc bluetooth " + verb },
                { "su", "-c", "cmd bluetooth_manager " + verb },
            };
            CommandResult last = null;
            for (String[] attempt : attempts) {
                last = run(attempt, 8000);
                if (waitForState(adapter, enable, 6000)) break;
            }
            boolean now = isEnabledSafe(adapter);
            o.put("ok", now == enable);
            o.put("enabled", now);
            if (now == enable) {
                o.put("message", "Bluetooth turned " + (enable ? "on" : "off") + " with root access.");
            } else if (last == null) {
                o.put("message", "Root (su) is not available, so Bluetooth was not changed.");
            } else {
                o.put("message", "The root command did not change Bluetooth. Output: " + snippet(last.output));
            }
            call.resolve(o);
        });
    }

    /** Non-root: opens the official Android dialog that asks the user to turn Bluetooth on. */
    @PluginMethod
    public void requestEnable(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        JSObject o = new JSObject();
        if (adapter == null) {
            call.reject("This device has no Bluetooth adapter.");
            return;
        }
        if (isEnabledSafe(adapter)) {
            o.put("launched", false);
            o.put("enabled", true);
            call.resolve(o);
            return;
        }
        if (!hasConnectPermission()) {
            call.reject("The Nearby devices permission is required first.");
            return;
        }
        try {
            getActivity().startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
            o.put("launched", true);
            o.put("enabled", false);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not open the Bluetooth dialog: " + e.getMessage());
        }
    }

    /** Non-root: asks the user to make the phone discoverable for a limited time (system dialog). */
    @PluginMethod
    public void requestDiscoverable(PluginCall call) {
        Integer requested = call.getInt("seconds");
        int seconds = requested == null ? 60 : Math.max(1, Math.min(requested, 3600));
        Intent intent = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
        intent.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, seconds);
        try {
            getActivity().startActivity(intent);
            JSObject o = new JSObject();
            o.put("launched", true);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not open the discoverable dialog: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open Bluetooth settings: " + e.getMessage());
        }
    }

    /* ----------------------------- paired & connected devices ----------------------------- */

    @PluginMethod
    public void getBondedDevices(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("This device has no Bluetooth adapter.");
            return;
        }
        if (!hasConnectPermission()) {
            call.reject("The Nearby devices permission is required to list paired devices.");
            return;
        }
        JSArray list = new JSArray();
        try {
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                JSObject o = new JSObject();
                o.put("address", device.getAddress());
                o.put("name", safeName(device));
                o.put("transport", transportOf(device));
                o.put("majorClass", majorClassOf(device));
                list.put(o);
            }
        } catch (SecurityException e) {
            call.reject("Permission denied while reading paired devices.");
            return;
        }
        JSObject result = new JSObject();
        result.put("devices", list);
        call.resolve(result);
    }

    /** Classic (headset/A2DP) and BLE (GATT) connections that are active right now. */
    @PluginMethod
    public void getConnectedDevices(PluginCall call) {
        final BluetoothAdapter adapter = adapter();
        final Set<String> found = new HashSet<>();
        final AtomicBoolean finished = new AtomicBoolean(false);
        final Runnable finish = () -> {
            if (!finished.compareAndSet(false, true)) return;
            JSArray list = new JSArray();
            for (String address : found) list.put(address);
            JSObject o = new JSObject();
            o.put("addresses", list);
            call.resolve(o);
        };
        if (adapter == null || !isEnabledSafe(adapter) || !hasConnectPermission()) {
            finish.run();
            return;
        }
        try {
            BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            for (BluetoothDevice device : manager.getConnectedDevices(BluetoothProfile.GATT)) {
                found.add(device.getAddress());
            }
        } catch (Exception ignored) {
            // BLE connections are optional information
        }
        final AtomicInteger pending = new AtomicInteger(2);
        for (int profile : new int[] { BluetoothProfile.HEADSET, BluetoothProfile.A2DP }) {
            boolean requested = adapter.getProfileProxy(
                getContext(),
                new BluetoothProfile.ServiceListener() {
                    @Override
                    public void onServiceConnected(int p, BluetoothProfile proxy) {
                        try {
                            for (BluetoothDevice device : proxy.getConnectedDevices()) {
                                found.add(device.getAddress());
                            }
                        } catch (Exception ignored) {
                            // ignore individual profile failures
                        } finally {
                            adapter.closeProfileProxy(p, proxy);
                        }
                        if (pending.decrementAndGet() == 0) finish.run();
                    }

                    @Override
                    public void onServiceDisconnected(int p) {
                        if (pending.decrementAndGet() == 0) finish.run();
                    }
                },
                profile
            );
            if (!requested && pending.decrementAndGet() == 0) finish.run();
        }
        new Handler(Looper.getMainLooper()).postDelayed(finish, 2500);
    }

    /** Removes the pairing (bond) with a device. Used for stale or unknown accessories. */
    @PluginMethod
    public void removeBond(PluginCall call) {
        String address = call.getString("address");
        BluetoothAdapter adapter = adapter();
        if (adapter == null || address == null) {
            call.reject("Missing device address.");
            return;
        }
        if (!hasConnectPermission()) {
            call.reject("The Nearby devices permission is required to remove a pairing.");
            return;
        }
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            boolean ok = device.removeBond();
            JSObject o = new JSObject();
            o.put("ok", ok);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not remove the pairing: " + e.getMessage());
        }
    }

    /** Renames the Bluetooth adapter (the name other devices see). */
    @PluginMethod
    public void setDeviceName(PluginCall call) {
        String name = call.getString("name");
        BluetoothAdapter adapter = adapter();
        if (adapter == null || name == null || name.trim().isEmpty()) {
            call.reject("Invalid device name.");
            return;
        }
        if (!hasConnectPermission()) {
            call.reject("The Nearby devices permission is required to rename the device.");
            return;
        }
        try {
            boolean ok = adapter.setName(name.trim());
            String current = adapter.getName();
            JSObject o = new JSObject();
            o.put("ok", ok);
            o.put("name", current == null ? "" : current);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not rename the device: " + e.getMessage());
        }
    }

    /**
     * Root only: reads the stored pairing database and reports the link-key type of each paired
     * device. Key values are never read into the result. Types (HCI): 0,1,2,3,6 legacy PIN-era keys;
     * 4 and 5 SSP P-192 (unauthenticated / authenticated); 7 and 8 Secure Connections P-256.
     */
    @PluginMethod
    public void analyzePairings(PluginCall call) {
        worker.execute(() -> {
            String[] paths = { "/data/misc/bluedroid/bt_config.conf", "/data/misc/bluetooth/bt_config.conf" };
            String text = null;
            String source = null;
            for (String path : paths) {
                CommandResult r = run(new String[] { "su", "-c", "cat " + path }, 8000);
                if (r != null && r.exitCode == 0 && r.output.contains("[")) {
                    text = r.output;
                    source = path;
                    break;
                }
            }
            JSObject o = new JSObject();
            if (text == null) {
                o.put("available", false);
                o.put("reason", "Root access is required to read the stored pairing database.");
                o.put("devices", new JSArray());
                call.resolve(o);
                return;
            }
            JSArray devices = new JSArray();
            JSObject current = null;
            for (String raw : text.split("\n")) {
                String line = raw.trim();
                if (line.startsWith("[") && line.endsWith("]")) {
                    if (current != null) devices.put(current);
                    String id = line.substring(1, line.length() - 1);
                    if (id.matches("([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}")) {
                        current = new JSObject();
                        current.put("address", id.toUpperCase());
                        current.put("name", "");
                        current.put("linkKeyType", -1);
                        current.put("le", false);
                    } else {
                        current = null;
                    }
                    continue;
                }
                if (current == null) continue;
                int eq = line.indexOf('=');
                if (eq <= 0) continue;
                String key = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();
                if (key.equals("Name")) {
                    current.put("name", value);
                } else if (key.equals("LinkKeyType")) {
                    try {
                        current.put("linkKeyType", Integer.parseInt(value));
                    } catch (NumberFormatException ignored) {
                        // leave default
                    }
                } else if (key.startsWith("LE_KEY_")) {
                    current.put("le", true);
                }
            }
            if (current != null) devices.put(current);
            o.put("available", true);
            o.put("source", source);
            o.put("devices", devices);
            call.resolve(o);
        });
    }
}
