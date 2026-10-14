plugins {
    id("com.android.application") version "8.7.3" apply false
}

// This folder lives in OneDrive, which locks build files while it syncs them and
// breaks the build. Build in the system temp folder instead.
allprojects {
    layout.buildDirectory.set(
        file("${System.getProperty("java.io.tmpdir")}/lamppanel-build/${project.name}")
    )
}
