🛡️ BlueShield
Bluetooth awareness, BLE scanning, and security education for Android.

BlueShield is an experimental Android and web project built with React and TypeScript. It helps users understand Bluetooth security risks and explore nearby Bluetooth Low Energy (BLE) devices through an accessible, interactive interface.

The project was developed with the assistance of artificial intelligence. Its Android APK is built using GitHub Actions and has been tested by the creator on an Android phone.

Important: BlueShield is not a certified security tool or a Bluetooth firewall. It does not replace Android security updates or device firmware updates. Its security capabilities have not been independently audited or verified.

🌐 Web Demo
Explore the BlueShield demo

The web demo showcases the application's interface. Bluetooth access differs between browsers and the Android APK; the demo does not establish that native Android features work.

✨ Interface and Features
10 Bluetooth security topics: Sniffing, Bluejacking, Bluesnarfing, Bluebugging, BlueBorne, KNOB, BIAS, BrakTooth, Tracking, and Denial of Service (DoS).
ON / OFF / AUTO controls for features presented in the interface.
Interactive charts and indicators for visualizing information and potential risks.
Nearby BLE device scanning in the Android APK through a native plugin, subject to the required permissions.
Radar-style interface and potential tracker discovery tools.
Beginner-friendly educational content: plain-language explanations, analogies, practical guidance, a glossary, and quizzes.
⚠️ Capabilities and Limitations
Please interpret the interface and its indicators carefully:

Enabling a control does not demonstrate that the corresponding attack is being blocked.
BLE scanning is not a capture of all Bluetooth traffic and does not, by itself, reveal connection encryption keys.
Charts should not be treated as actual network measurements unless their data sources have been verified. Some indicators may use simulated data.
Identification of AirTag, SmartTag, Tile, or other trackers requires separate validation. An unfamiliar BLE device is not, by itself, evidence of tracking.
Bluetooth signal strength does not provide an exact distance or geographic location.
BlueShield cannot patch vulnerabilities in Android, the Bluetooth stack, or a device's Bluetooth chipset.
Background operation depends on Android restrictions, permissions, and battery optimization settings.
📥 Download and Install the Android APK
Open this repository's Releases page.
Select the version you want to try.
Under Assets, download the .apk file.
Transfer it to your Android phone, or download it directly on the phone.
Open the APK and, if prompted, allow installation from that specific source.
Complete the installation.
Grant the required Bluetooth / Nearby devices permissions when requested.
Setting names vary by device and Android version. Some versions may require additional permissions or enabled location services for scanning.

Initial test versions are distributed as debug APKs, not production releases for Google Play. Only install files from sources you trust.

The automatically generated Source code archives on the Releases page contain the project source, not an installable Android application.

🏗️ Build an APK with GitHub Actions
The Android build workflow is located at:

.github/workflows/android-apk.yml

To build your own APK:

Upload the project to your own GitHub repository, preserving the directory structure.
Open Actions → Build Android APK (BlueShield).
Click Run workflow, select the branch, and confirm.
Wait for the workflow to finish successfully.
Open the completed run and download the BlueShield-APK artifact.
Extract the ZIP archive to obtain app-debug.apk.
The workflow also runs automatically when changes are pushed to the main or master branch.

See ANDROID_APK.md for additional build instructions.

Debug Signing Note
Debug APKs built on separate temporary GitHub runners may use different signing keys. As a result, a newer debug APK may not install over an existing version.

Production distribution requires a consistent, securely stored release signing key. Never commit private signing keys or passwords to a public repository.

🧰 Technology Stack
React
TypeScript
Vite
Capacitor
@capacitor-community/bluetooth-le
GitHub Actions for Android APK builds

🔒 Recommended Bluetooth Security Practices
Keep Android and your connected devices updated.
Turn off Bluetooth when you do not need it, and check any separate Bluetooth scanning setting.
Reject pairing requests you did not initiate.
Remove old or unfamiliar paired devices.
Use trusted accessories and secure pairing methods.
Respect other people's privacy when handling device discovery information.
BlueShield's educational content complements these practices; it does not replace them or guarantee protection against attacks.

🐛 Report a Problem
Open an Issue and include:

Phone model and Android version.
BlueShield version.
Steps to reproduce the problem.
Expected and actual behavior.
A screenshot, if useful.
Do not publish passwords, personal information, or identifiers belonging to other people's devices.

📌 Project Status
BlueShield is an experimental project under development.

Current priorities include:

Reviewing the AI-assisted code.
Clearly distinguishing real measurements from simulated data.
Validating Bluetooth behavior across different Android devices.
Verifying tracker identification and security-related claims.
Preparing consistently signed release builds.

📄 License
Check the repository's LICENSE file, if present, for the terms governing use of this project.

If no license has been provided, public access to the source code does not grant general permission to use, modify, or redistribute it.

Third-party dependencies remain subject to their respective licenses.
