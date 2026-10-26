package ir.bahar.school;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * بهار | سامانه مدیریت مدرسه — اپ اندروید (WebView)
 *
 * این اپ هیچ وابستگی بیرونی (androidx / material) ندارد تا در هر محیطی
 * حتی بدون دسترسی به dl.google.com بیلد شود.
 *
 * آدرس سرور بهار را در SERVER_URL وارد کنید.
 *   مثال اینترنتی:  https://bahar.example.ir
 *   مثال محلی/شبکه: http://192.168.1.10:3000
 */
public class MainActivity extends Activity {

    // ═══════════════ تنظیم اصلی ═══════════════
    private static final String SERVER_URL = "https://bahar.example.com";
    // ═══════════════════════════════════════════

    private static final int FILE_CHOOSER_REQUEST = 57001;

    private WebView webView;
    private ProgressBar progressBar;
    private View errorPane;
    private String loadedUrl;

    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progress);
        errorPane = findViewById(R.id.error_pane);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new BaharWebViewClient());
        webView.setWebChromeClient(new BaharChromeClient());
        webView.setDownloadListener(new BaharDownloadListener());

        findViewById(R.id.retry_button).setOnClickListener(v -> loadHome());

        // بازگرداندن وضعیت بعد از چرخش صفحه
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            loadedUrl = savedInstanceState.getString("loadedUrl", SERVER_URL);
        } else {
            loadHome();
        }
    }

    private void loadHome() {
        errorPane.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        loadedUrl = SERVER_URL;
        webView.loadUrl(SERVER_URL);
    }

    /* ─────── ناوبری و رفتار لینک‌ها ─────── */

    private class BaharWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl().toString());
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(url);
        }

        private boolean handleUrl(String url) {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme();
            // لینک‌های داخل سرور بهار → داخل اپ باز شود
            if (scheme.equals("http") || scheme.equals("https")) {
                String host = uri.getHost() == null ? "" : uri.getHost();
                String serverHost = Uri.parse(SERVER_URL).getHost();
                if (host.equals(serverHost)) {
                    return false; // داخل WebView
                }
            }
            // tel: / mailto: / لینک‌های خارجی → برنامه بیرونی
            openExternal(url);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            progressBar.setVisibility(View.VISIBLE);
            loadedUrl = url;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            progressBar.setVisibility(View.GONE);
        }

        @SuppressWarnings("deprecation")
        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // فقط خطای بارگذاری صفحه اصلی را نمایش بده (خطای منابع فرعی بی‌اهمیت است)
            if (failingUrl != null && failingUrl.equals(loadedUrl)
                    && (errorCode == ERROR_HOST_LOOKUP || errorCode == ERROR_CONNECT
                        || errorCode == ERROR_TIMEOUT || errorCode == ERROR_FILE_NOT_FOUND)) {
                showError();
            }
        }
    }

    private void openExternal(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show();
        }
    }

    private void showError() {
        webView.setVisibility(View.GONE);
        errorPane.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.GONE);
    }

    /* ─────── آپلود فایل (انتخاب فایل از داخل صفحات بهار) ─────── */

    private class BaharChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }
            filePathCallback = callback;
            try {
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
            } catch (ActivityNotFoundException e) {
                filePathCallback = null;
                Toast.makeText(MainActivity.this, R.string.no_app_for_file, Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            callback.invoke(origin, false, false);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /* ─────── دانلود فایل ─────── */

    private class BaharDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                String name = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                request.setMimeType(mimeType);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) {
                    request.addRequestHeader("Cookie", cookie);
                }
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                }
                Toast.makeText(MainActivity.this, R.string.download_started, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                openExternal(url);
            }
        }
    }

    /* ─────── دکمه بازگشت ─────── */

    private long lastBackPress = 0;

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (errorPane.getVisibility() == View.VISIBLE) {
                // روی صفحه خطا: دوباره بازگشت = خروج
                if (System.currentTimeMillis() - lastBackPress > 2000) {
                    lastBackPress = System.currentTimeMillis();
                    Toast.makeText(this, R.string.exit_hint, Toast.LENGTH_SHORT).show();
                } else {
                    finish();
                }
                return true;
            }
            if (webView.canGoBack()) {
                webView.goBack();
                return true;
            }
            if (System.currentTimeMillis() - lastBackPress > 2000) {
                lastBackPress = System.currentTimeMillis();
                Toast.makeText(this, R.string.exit_hint, Toast.LENGTH_SHORT).show();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    /* ─────── چرخش صفحه و چرخه حیات ─────── */

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
        outState.putString("loadedUrl", loadedUrl);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }
}
