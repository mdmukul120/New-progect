# NovaCut — keep WebView JS interfaces
-keepclassmembers class com.novacut.studio.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
