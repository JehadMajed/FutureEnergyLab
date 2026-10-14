package sa.edu.psau.fel.lamppanel;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.splashscreen.SplashScreen;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.util.Arrays;
import java.util.List;

/**
 * Lamp Panel: the phone interface of the Digital Twin (BuildConfig.SITE_URL, the site's
 * /app/ page) in a full-screen WebView.
 *
 * The page is loaded live, so every update to it reaches the app without a new APK.
 * Around it the app adds: a splash screen, pull to refresh, an offline screen that
 * reconnects by itself, launcher shortcuts to the app's sections, back navigation
 * through them, haptics, full-screen camera video, and external links in a Custom Tab.
 */
public class MainActivity extends Activity {

    private static final String OFFLINE_URL = "file:///android_asset/offline.html";
    private static final List<String> TABS = Arrays.asList("live", "records", "simulate", "control");
    private static final long SPLASH_MAX_MS = 4000;
    private static final int BRAND = 0xFF006C6B;
    private static final long OFFLINE_RETRY_MS = 10_000;
    private static final String TAG = "LampPanel";

    private WebView web;
    private SwipeRefreshLayout swipe;
    private ProgressBar progress;
    private FrameLayout fullscreen;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private ConnectivityManager.NetworkCallback networkCallback;

    private final long startedAt = SystemClock.uptimeMillis();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean firstLoadDone;
    private boolean showingOffline;          // the offline screen is (being) shown
    private boolean loadingSiteFromOffline;  // a retry from the offline screen is in flight
    private boolean mainFrameFailed;         // the current main-frame load failed
    private boolean clearHistoryOnLoad;
    private boolean resumed;
    private String pendingTab;

    // Updated from the page through the JavaScript bridge (binder thread).
    private volatile boolean pageAtTop = true;
    private volatile boolean touchOnInteractive;
    private volatile String activeTab = "live";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        // Keep the splash up until the page has drawn, but never longer than SPLASH_MAX_MS.
        splash.setKeepOnScreenCondition(() ->
                !firstLoadDone && SystemClock.uptimeMillis() - startedAt < SPLASH_MAX_MS);

        buildLayout();
        configureWebView();
        watchNetwork();

        pendingTab = tabFrom(getIntent());
        if (isOnline()) {
            web.loadUrl(BuildConfig.SITE_URL);
        } else {
            showOffline();
        }
    }

    // ── layout ──────────────────────────────────────────────────────────────

    private void buildLayout() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);   // behind the status and navigation bars

        web = new WebView(this);
        swipe = new SwipeRefreshLayout(this);
        swipe.addView(web, new ViewGroup.LayoutParams(-1, -1));
        swipe.setColorSchemeColors(BRAND);
        swipe.setOnRefreshListener(this::reloadSite);
        // Only pull to refresh from the very top of the page, and never while the
        // finger is on the 3D model, a chart canvas, a slider or the camera.
        swipe.setOnChildScrollUpCallback((parent, child) ->
                !pageAtTop || touchOnInteractive || web.getScrollY() > 0);
        root.addView(swipe, new FrameLayout.LayoutParams(-1, -1));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(false);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(BRAND));
        progress.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.TRANSPARENT));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP);
        root.addView(progress, lp);

        fullscreen = new FrameLayout(this);
        fullscreen.setBackgroundColor(Color.BLACK);
        fullscreen.setVisibility(View.GONE);
        root.addView(fullscreen, new FrameLayout.LayoutParams(-1, -1));

        setContentView(root);
        applyEdgeToEdge(root);
    }

    /** Draw behind the system bars and pad the content so nothing sits under them. */
    @SuppressWarnings("deprecation")
    private void applyEdgeToEdge(View root) {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(light, light);
            }
        } else {
            root.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                left = i.left; top = i.top; right = i.right; bottom = i.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            swipe.setPadding(left, top, right, bottom);
            ((FrameLayout.LayoutParams) progress.getLayoutParams()).topMargin = top;
            progress.requestLayout();
            return insets;
        });
    }

    // ── WebView ─────────────────────────────────────────────────────────────

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);               // the site caches the last reading in localStorage
        s.setMediaPlaybackRequiresUserGesture(false); // muted camera stream autoplays
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " LampPanelApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true); // camera iframe

        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Bridge(), "LampPanelApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(Uri.parse(url)));
    }

    private boolean isSiteUrl(Uri uri) {
        Uri site = Uri.parse(BuildConfig.SITE_URL);
        return "https".equals(uri.getScheme()) && site.getHost() != null
                && site.getHost().equalsIgnoreCase(uri.getHost());
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            Uri uri = request.getUrl();
            if (isSiteUrl(uri) || OFFLINE_URL.equals(uri.toString())) return false;
            openExternal(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            progress.setVisibility(View.VISIBLE);
            pageAtTop = true;
            touchOnInteractive = false;
            if (!OFFLINE_URL.equals(url)) mainFrameFailed = false;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.i(TAG, "onPageFinished " + url + " failed=" + mainFrameFailed);
            progress.setVisibility(View.GONE);
            swipe.setRefreshing(false);
            firstLoadDone = true;
            if (OFFLINE_URL.equals(url)) return;
            // WebView also reports "finished" for a load that failed, after onReceivedError.
            // That is not the site: the offline screen is (or is about to be) up.
            if (mainFrameFailed) return;
            loadingSiteFromOffline = false;
            showingOffline = false;
            handler.removeCallbacks(offlineRetry);
            if (clearHistoryOnLoad) {
                clearHistoryOnLoad = false;
                view.clearHistory();
            }
            view.evaluateJavascript(BRIDGE_JS, null);
            if (pendingTab != null) {
                openTab(pendingTab);
                pendingTab = null;
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            Log.w(TAG, "main frame error " + error.getErrorCode() + " " + error.getDescription()
                    + " for " + request.getUrl());
            mainFrameFailed();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && response.getStatusCode() >= 500) mainFrameFailed();
        }

        /** The failed page has replaced whatever was on screen, so (re)load the offline screen. */
        private void mainFrameFailed() {
            mainFrameFailed = true;
            showingOffline = false;
            showOffline();
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The page's renderer died (out of memory, usually during the 3D view).
            // Start again rather than let the whole app crash.
            recreate();
            return true;
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progress.setProgress(newProgress);
            if (newProgress >= 100) progress.setVisibility(View.GONE);
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            // Full-screen video (the camera feed's full-screen button).
            if (customView != null) { callback.onCustomViewHidden(); return; }
            customView = view;
            customViewCallback = callback;
            fullscreen.addView(view, new FrameLayout.LayoutParams(-1, -1));
            fullscreen.setVisibility(View.VISIBLE);
            setSystemBarsHidden(true);
        }

        @Override
        public void onHideCustomView() {
            exitFullscreen();
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            request.deny();   // the site never needs the phone's camera or microphone
        }
    }

    /** Called by the page. Everything here is safe for any page to call. */
    private class Bridge {
        @JavascriptInterface
        public void onScroll(boolean atTop) { pageAtTop = atTop; }

        @JavascriptInterface
        public void onTouch(boolean interactive) { touchOnInteractive = interactive; }

        @JavascriptInterface
        public void onTab(String tab) { if (TABS.contains(tab)) activeTab = tab; }

        @JavascriptInterface
        public void retry() { runOnUiThread(MainActivity.this::reloadSite); }
    }

    // Injected after each page load: reports the scroll position and touches on
    // interactive elements, for pull to refresh. The /app/ page reports its own
    // section changes through onTab.
    private static final String BRIDGE_JS =
            "(function(){if(window.__lampPanelApp||!window.LampPanelApp)return;window.__lampPanelApp=1;"
            + "var A=window.LampPanelApp;"
            + "function top(){A.onScroll((window.scrollY||document.documentElement.scrollTop||0)<=0);}"
            + "window.addEventListener('scroll',top,{passive:true});top();"
            + "document.addEventListener('touchstart',function(e){var t=e.target;"
            + "A.onTouch(!!(t&&t.closest&&t.closest('model-viewer,canvas,iframe,video,input,select,textarea,.chart-scroll,.chips,.board,.scen-row,.sheet')));},"
            + "{passive:true,capture:true});})();";

    // ── navigation ──────────────────────────────────────────────────────────

    private void openTab(String tab) {
        if (!TABS.contains(tab)) return;
        activeTab = tab;
        web.evaluateJavascript("window.lampApp&&window.lampApp.go('" + tab + "')", null);
    }

    private static String tabFrom(Intent intent) {
        String tab = intent == null ? null : intent.getStringExtra("tab");
        return TABS.contains(tab) ? tab : null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String tab = tabFrom(intent);
        if (tab == null) return;
        if (firstLoadDone && !showingOffline) openTab(tab); else pendingTab = tab;
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (customView != null) { exitFullscreen(); return; }
        if (web.canGoBack()) { web.goBack(); return; }
        if (!showingOffline && !"live".equals(activeTab)) { openTab("live"); return; }
        super.onBackPressed();
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        try {
            if ("http".equals(scheme) || "https".equals(scheme)) {
                new CustomTabsIntent.Builder()
                        .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder()
                                .setToolbarColor(BRAND).build())
                        .setShowTitle(true)
                        .build()
                        .launchUrl(this, uri);
            } else {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            }
        } catch (ActivityNotFoundException ignored) {
            // No app can open it; stay on the page.
        }
    }

    // ── offline handling ────────────────────────────────────────────────────

    private void reloadSite() {
        Log.i(TAG, "reloadSite online=" + isOnline() + " offlineScreen=" + showingOffline);
        if (!isOnline()) { swipe.setRefreshing(false); showOffline(); return; }
        if (showingOffline) {
            // Leave the offline screen up until the site has actually loaded;
            // a failed attempt then lands back on it without flicker.
            clearHistoryOnLoad = true;
            loadingSiteFromOffline = true;
            web.loadUrl(BuildConfig.SITE_URL);
        } else {
            web.reload();
        }
    }

    private void showOffline() {
        Log.i(TAG, "showOffline (already=" + showingOffline + ")");
        loadingSiteFromOffline = false;
        swipe.setRefreshing(false);
        if (!showingOffline) {
            showingOffline = true;
            web.loadUrl(OFFLINE_URL);
        }
        scheduleOfflineRetry();
    }

    /** While the offline screen is up, try again every OFFLINE_RETRY_MS. */
    private void scheduleOfflineRetry() {
        handler.removeCallbacks(offlineRetry);
        handler.postDelayed(offlineRetry, OFFLINE_RETRY_MS);
    }

    private final Runnable offlineRetry = () -> {
        if (showingOffline && !loadingSiteFromOffline && resumed) reloadSite();
        else if (showingOffline) scheduleOfflineRetry();
    };

    private boolean isOnline() {
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm == null) return true;
        NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    /** Reconnect by itself when the network comes back while the offline screen is up. */
    private void watchNetwork() {
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                // VALIDATED: Android has confirmed this network really reaches the internet.
                if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) return;
                runOnUiThread(() -> {
                    if (showingOffline && !loadingSiteFromOffline) reloadSite();
                });
            }
        };
        cm.registerDefaultNetworkCallback(networkCallback);
    }

    // ── full screen ─────────────────────────────────────────────────────────

    private void exitFullscreen() {
        if (customView == null) return;
        fullscreen.removeView(customView);
        fullscreen.setVisibility(View.GONE);
        customView = null;
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
        setSystemBarsHidden(false);
    }

    @SuppressWarnings("deprecation")
    private void setSystemBarsHidden(boolean hidden) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c == null) return;
            if (hidden) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else {
                c.show(WindowInsets.Type.systemBars());
            }
        } else {
            View d = getWindow().getDecorView();
            int base = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            d.setSystemUiVisibility(hidden
                    ? base | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    : base | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    // ── lifecycle ───────────────────────────────────────────────────────────

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        web.onResume();
        web.resumeTimers();
        if (showingOffline) scheduleOfflineRetry();
    }

    @Override
    protected void onPause() {
        resumed = false;
        // Stop the page's timers and live charts in the background to save battery;
        // the site reconnects to the live feed when the app comes back.
        web.onPause();
        web.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (networkCallback != null) {
            ConnectivityManager cm = getSystemService(ConnectivityManager.class);
            if (cm != null) cm.unregisterNetworkCallback(networkCallback);
        }
        if (web != null) {
            web.removeJavascriptInterface("LampPanelApp");
            ((ViewGroup) web.getParent()).removeView(web);
            web.destroy();
        }
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
