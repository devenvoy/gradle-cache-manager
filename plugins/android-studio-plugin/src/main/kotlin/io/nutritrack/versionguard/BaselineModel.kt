package io.nutritrack.versionguard

data class BaselineData(
    val updated_at: String? = null,
    val versions: Map<String, String> = emptyMap(),
    val wrapper: WrapperBaseline? = null,
    val properties: Map<String, String> = emptyMap()
)

data class WrapperBaseline(
    val version: String = "",
    val type: String = "bin",
    val url: String = ""
)

data class DriftItem(
    val key: String,
    val currentVersion: String,
    val baselineVersion: String,
    val category: String, // "Library", "Wrapper", "Property"
    var selected: Boolean = true
)
