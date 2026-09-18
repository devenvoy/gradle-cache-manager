package io.nutritrack.versionguard

import com.intellij.openapi.project.Project
import java.io.File
import java.util.regex.Pattern

object ProjectVersionChecker {

    fun checkProject(project: Project, baseline: BaselineData): List<DriftItem> {
        val basePath = project.basePath ?: return emptyList()
        val baseDir = File(basePath)
        val drifts = mutableListOf<DriftItem>()

        // 1. Check libs.versions.toml
        val tomlFile = File(baseDir, "gradle/libs.versions.toml")
        if (tomlFile.exists()) {
            val projectVersions = parseTomlVersions(tomlFile)
            for ((key, currentVer) in projectVersions) {
                val baselineVer = baseline.versions[key]
                if (baselineVer != null && baselineVer != currentVer) {
                    drifts.add(
                        DriftItem(
                            key = key,
                            currentVersion = currentVer,
                            baselineVersion = baselineVer,
                            category = "Library",
                            selected = true
                        )
                    )
                }
            }
        }

        // 2. Check Gradle Wrapper
        val wrapperFile = File(baseDir, "gradle/wrapper/gradle-wrapper.properties")
        if (wrapperFile.exists() && baseline.wrapper != null && baseline.wrapper.version.isNotBlank()) {
            val currentWrapperVer = parseWrapperVersion(wrapperFile)
            if (currentWrapperVer.isNotBlank() && currentWrapperVer != baseline.wrapper.version) {
                drifts.add(
                    DriftItem(
                        key = "gradle-wrapper",
                        currentVersion = currentWrapperVer,
                        baselineVersion = baseline.wrapper.version,
                        category = "Wrapper",
                        selected = true
                    )
                )
            }
        }

        // 3. Check gradle.properties for recommended performance & caching flags
        val propsFile = File(baseDir, "gradle.properties")
        val existingProps = if (propsFile.exists()) parseProperties(propsFile) else emptyMap()

        val recommendedProps = listOf(
            "org.gradle.caching" to "true",
            "org.gradle.parallel" to "true"
        )
        for ((propKey, recommendedVal) in recommendedProps) {
            val currentVal = existingProps[propKey]
            if (currentVal != recommendedVal) {
                drifts.add(
                    DriftItem(
                        key = propKey,
                        currentVersion = currentVal ?: "(disabled/missing)",
                        baselineVersion = recommendedVal,
                        category = "Property",
                        selected = true
                    )
                )
            }
        }

        return drifts
    }

    private fun parseTomlVersions(file: File): Map<String, String> {
        val versions = mutableMapOf<String, String>()
        var inVersions = false
        file.forEachLine { rawLine ->
            val line = rawLine.trim()
            if (line.startsWith("[versions]")) {
                inVersions = true
            } else if (line.startsWith("[")) {
                inVersions = false
            } else if (inVersions && line.contains("=") && !line.startsWith("#")) {
                val parts = line.split("=", limit = 2)
                val k = parts[0].trim()
                val v = parts[1].trim().trim('"', '\'')
                if (k.isNotBlank() && v.isNotBlank()) {
                    versions[k] = v
                }
            }
        }
        return versions
    }

    private fun parseWrapperVersion(file: File): String {
        for (rawLine in file.readLines()) {
            val line = rawLine.trim()
            if (line.startsWith("distributionUrl")) {
                val matcher = Pattern.compile("gradle-([0-9.]+)-").matcher(line)
                if (matcher.find()) {
                    return matcher.group(1)
                }
            }
        }
        return ""
    }

    private fun parseProperties(file: File): Map<String, String> {
        val props = mutableMapOf<String, String>()
        for (rawLine in file.readLines()) {
            val line = rawLine.trim()
            if (line.isNotBlank() && !line.startsWith("#") && line.contains("=")) {
                val parts = line.split("=", limit = 2)
                props[parts[0].trim()] = parts[1].trim()
            }
        }
        return props
    }
}
