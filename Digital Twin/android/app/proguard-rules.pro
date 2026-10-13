# Methods called from the page's JavaScript must keep their names.
-keepclassmembers class sa.edu.psau.fel.lamppanel.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
