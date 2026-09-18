package io.nutritrack.versionguard

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

class PreSyncStartupActivity : ProjectActivity {

    override suspend fun execute(project: Project) {
        project.basePath?.let { BaselineService.registerProject(project.name, it) }
        val baseline = BaselineService.getBaseline() ?: return
        val drifts = ProjectVersionChecker.checkProject(project, baseline)

        if (drifts.isNotEmpty()) {
            ApplicationManager.getApplication().invokeLater {
                if (!project.isDisposed) {
                    val dialog = PreSyncDialog(project, drifts)
                    if (dialog.showAndGet()) {
                        val changes = VersionAligner.applyAlignment(project, drifts)
                        val msg = "Aligned ${changes.size} items to machine baseline. Backup files (.bak) were created."
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("Gradle Version Guard")
                            ?.createNotification(msg, NotificationType.INFORMATION)
                            ?.notify(project)
                    }
                }
            }
        }
    }
}
