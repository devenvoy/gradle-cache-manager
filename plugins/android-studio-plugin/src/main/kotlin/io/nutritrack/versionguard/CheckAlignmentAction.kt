package io.nutritrack.versionguard

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages

class CheckAlignmentAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val baseline = BaselineService.getBaseline()

        if (baseline == null) {
            Messages.showWarningDialog(
                project,
                "Machine baseline could not be found.\nPlease run Gradle Cache Manager (localhost:8484) or ensure ~/.gradle/gcm-baseline.json exists.",
                "Gradle Version Guard"
            )
            return
        }

        val drifts = ProjectVersionChecker.checkProject(project, baseline)

        if (drifts.isEmpty()) {
            Messages.showInfoMessage(
                project,
                "All dependencies, Gradle wrapper, and properties are 100% aligned with your machine's shared cache baseline!\n\nZero duplicate storage waste.",
                "Gradle Version Guard — Fully Aligned"
            )
            return
        }

        val dialog = PreSyncDialog(project, drifts)
        if (dialog.showAndGet()) {
            val changes = VersionAligner.applyAlignment(project, drifts)
            Messages.showInfoMessage(
                project,
                "Successfully aligned ${changes.size} items to machine baseline!\n\nBackup copies (.bak) have been created.",
                "Gradle Version Guard"
            )
        }
    }
}
