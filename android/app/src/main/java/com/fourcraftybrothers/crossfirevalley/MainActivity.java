package com.fourcraftybrothers.crossfirevalley;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The system "font size" setting would otherwise scale the HUD and
        // menus out of their layout; the game sizes its own text.
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
