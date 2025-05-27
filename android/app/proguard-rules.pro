# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Keep your application class
-keep class com.localhub.app.** { *; }

# Keep Twilio classes
-keep class com.twilio.** { *; }
-keep class com.twilio.rest.** { *; }
-keep class com.twilio.exception.** { *; }

# Keep Retrofit classes
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Keep OkHttp classes
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Keep Gson classes
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep Android classes
-keep class android.support.v4.** { *; }
-keep class androidx.** { *; }
-keep class com.google.android.material.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep Parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    !private <fields>;
    !private <methods>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep XML-related classes
-keep class javax.xml.stream.** { *; }
-keep class javax.xml.namespace.** { *; }
-keep class javax.naming.** { *; }
-keep class org.codehaus.stax2.** { *; }

# Keep GSS-related classes
-keep class org.ietf.jgss.** { *; }

# Keep SLF4J classes
-keep class org.slf4j.** { *; }
-keep class org.slf4j.impl.** { *; }

# Keep Apache HTTP classes
-keep class org.apache.http.** { *; }
-keep class org.apache.http.conn.ssl.** { *; }
-keep class org.apache.http.impl.auth.** { *; }

# Keep Jackson XML classes
-keep class com.fasterxml.jackson.dataformat.xml.** { *; }
-keep class com.ctc.wstx.** { *; }

# Suppress warnings for missing Java SE and SLF4J classes (not present on Android)
-dontwarn javax.naming.**
-dontwarn javax.xml.stream.**
-dontwarn org.ietf.jgss.**
-dontwarn org.osgi.framework.**
-dontwarn org.slf4j.impl.**
-ignorewarnings
