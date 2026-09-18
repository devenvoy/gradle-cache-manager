package io.nutritrack.versionguard

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import java.io.File

object VersionAligner {

    fun applyAlignment(project: Project, selectedDrifts: List<DriftItem>): List<String> {
        val basePath = project.basePath ?: return emptyList()
        val baseDir = File(basePath)
        val changes = mutableListOf<String>()

        val libDrifts = selectedDrifts.filter { it.category == "Library" && it.selected }
        val wrapperDrifts = selectedDrifts.filter { it.category == "Wrapper" && it.selected }
        val propDrifts = selectedDrifts.filter { it.category == "Property" && it.selected }

        val timestamp = System.currentTimeMillis()

        // 1. Update libs.versions.toml
        if (libDrifts.isNotEmpty()) {
            val tomlFile = File(baseDir, "gradle/libs.versions.toml")
            if (tomlFile.exists()) {
                val bakFile = File(tomlFile.parentFile, "${tomlFile.name}.bak.$timestamp")
                tomlFile.copyTo(bakFile, overwrite = true)

                val targetMap = libDrifts.associate { it.key to it.baselineVersion }
                val lines = tomlFile.readLines()
                val newLines = mutableListOf<String>()
                var inVersions = false

                for (line in lines) {
                    val stripped = line.trim()
                    if (stripped.startsWith("[versions]")) {
                        inVersions = true
                        newLines.add(line)
                        continue
                    } else if (stripped.startsWith("[")) {
                        inVersions = false
                    }

                    if (inVersions && stripped.contains("=") && !stripped.startsWith("#")) {
                        val parts = stripped.split("=", limit = 2)
                        val k = parts[0].trim()
                        if (targetMap.containsKey(k)) {
                            val newVer = targetMap[k]!!
                            val quote = if (line.contains("\"")) "\"" else "'"
                            newLines.add("$k = $quote$newVer$quote")
                            changes.add("libs.versions.toml: $k -> $newVer")
                        } else {
                            newLines.add(line)
                        }
                    } else {
                        newLines.add(line)
                    }
                }
                tomlFile.writeText(newLines.joinToString("\n") + "\n")
            }
        }

        // 2. Update gradle-wrapper.properties
        if (wrapperDrifts.isNotEmpty()) {
            val wrapperFile = File(baseDir, "gradle/wrapper/gradle-wrapper.properties")
            if (wrapperFile.exists()) {
                val targetWrapper = wrapperDrifts.first().baselineVersion
                val bakFile = File(wrapperFile.parentFile, "${wrapperFile.name}.bak.$timestamp")
                wrapperFile.copyTo(bakFile, overwrite = true)

                val newLines = wrapperFile.readLines().map { line ->
                    if (line.trim().startsWith("distributionUrl")) {
                        "distributionUrl=https\\://services.gradle.org/distributions/gradle-$targetWrapper-bin.zip"
                    } else {
                        line
                    }
                }
                wrapperFile.writeText(newLines.joinToString("\n") + "\n")
                changes.add("gradle-wrapper.properties: updated to $targetWrapper")
            }
        }

        // 3. Update gradle.properties
        if (propDrifts.isNotEmpty()) {
            val propsFile = File(baseDir, "gradle.properties")
            val bakFile = File(propsFile.parentFile, "${propsFile.name}.bak.$timestamp")
            if (propsFile.exists()) {
                propsFile.copyTo(bakFile, overwrite = true)
            }

            val existingLines = if (propsFile.exists()) propsFile.readLines() else emptyList()
            val existingKeys = mutableSetOf<String>()
            val updatedLines = mutableListOf<String>()

            val targetProps = propDrifts.associate { it.key to it.baselineVersion }

            for (line in existingLines) {
                val stripped = line.trim()
                if (stripped.isNotBlank() && !stripped.startsWith("#") && stripped.contains("=")) {
                    val k = stripped.split("=", limit = 2)[0].trim()
                    existingKeys.add(k)
                    if (targetProps.containsKey(k)) {
                        updatedLines.add("$k=${targetProps[k]}")
                        changes.add("gradle.properties: $k=${targetProps[k]}")
                    } else {
                        updatedLines.add(line)
                    }
                } else {
                    updatedLines.add(line)
                }
            }

            for ((k, v) in targetProps) {
                if (!existingKeys.contains(k)) {
                    updatedLines.add("$k=$v")
                    changes.add("gradle.properties: added $k=$v")
                }
            }

            propsFile.writeText(updatedLines.joinToString("\n") + "\n")
        }

        // Refresh Virtual File System so Android Studio detects external file modifications
        LocalFileSystem.getInstance().refresh(true)

        return changes
    }
}
