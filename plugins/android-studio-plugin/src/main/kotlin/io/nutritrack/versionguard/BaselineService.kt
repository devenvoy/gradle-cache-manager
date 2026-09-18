package io.nutritrack.versionguard

import com.google.gson.Gson
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

object BaselineService {

    private val gson = Gson()
    private val localBaselineFile = File(System.getProperty("user.home"), ".gradle/gcm-baseline.json")

    /**
     * Retrieve the machine golden baseline.
     * Tries the local daemon at http://localhost:8484/api/baseline first.
     * If the daemon is unreachable, falls back to reading ~/.gradle/gcm-baseline.json directly.
     */
    fun getBaseline(): BaselineData? {
        // 1. Try local server API
        try {
            val url = URL("http://localhost:8484/api/baseline")
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 1500
            conn.readTimeout = 1500
            conn.requestMethod = "GET"
            if (conn.responseCode == 200) {
                val json = conn.inputStream.bufferedReader().use { it.readText() }
                return gson.fromJson(json, BaselineData::class.java)
            }
        } catch (_: Exception) {
            // Server offline, fall back to file
        }

        // 2. Read local ~/.gradle/gcm-baseline.json
        if (localBaselineFile.exists()) {
            try {
                val json = localBaselineFile.readText()
                return gson.fromJson(json, BaselineData::class.java)
            } catch (_: Exception) {
            }
        }

        return null
    }

    /**
     * Notify Gradle Cache Manager daemon about this project so it is dynamically registered.
     */
    fun registerProject(name: String, path: String) {
        Thread {
            try {
                val url = URL("http://localhost:8484/api/projects/register")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 1500
                conn.readTimeout = 1500
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                val payload = gson.toJson(mapOf("name" to name, "path" to path))
                conn.outputStream.use { it.write(payload.toByteArray()) }
                conn.responseCode
            } catch (_: Exception) {
            }
        }.start()
    }
}
