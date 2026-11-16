package gr.blueshield.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom native plugin: real Bluetooth state, root detection, root-only radio control.
        registerPlugin(BlueShieldNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
