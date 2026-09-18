package io.nutritrack.versionguard

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.table.JBTable
import com.intellij.util.ui.JBUI
import java.awt.BorderLayout
import java.awt.Dimension
import java.awt.FlowLayout
import javax.swing.*
import javax.swing.table.AbstractTableModel

class PreSyncDialog(
    private val project: Project,
    val drifts: List<DriftItem>
) : DialogWrapper(project, true) {

    private lateinit var table: JBTable
    private val tableModel = DriftTableModel(drifts)

    init {
        title = "Gradle Version Guard — Machine Baseline Drift Detected"
        setOKButtonText("⚡ Align Selected & Sync")
        setCancelButtonText("Skip (Keep Current)")
        init()
    }

    override fun createCenterPanel(): JComponent {
        val root = JPanel(BorderLayout(0, 12))
        root.border = JBUI.Borders.empty(8)
        root.preferredSize = Dimension(650, 420)

        // 1. Header Banner
        val headerPanel = JPanel(BorderLayout(0, 4))
        val titleLabel = JBLabel("<html><strong>⚠️ Machine Baseline Version Mismatches Detected</strong></html>")
        titleLabel.font = titleLabel.font.deriveFont(14f)
        val descLabel = JBLabel("<html>This project uses versions that differ from your machine's shared cache baseline.<br>" +
                "Aligning these versions forces Gradle to reuse cached dependencies, saving disk storage and build time.</html>")
        descLabel.foreground = JBUI.CurrentTheme.Label.disabledForeground()

        headerPanel.add(titleLabel, BorderLayout.NORTH)
        headerPanel.add(descLabel, BorderLayout.SOUTH)
        root.add(headerPanel, BorderLayout.NORTH)

        // 2. Table
        table = JBTable(tableModel)
        table.rowHeight = 28
        table.columnModel.getColumn(0).maxWidth = 50
        table.columnModel.getColumn(0).headerValue = "Apply"
        table.columnModel.getColumn(1).headerValue = "Component / Key"
        table.columnModel.getColumn(2).headerValue = "Project Version"
        table.columnModel.getColumn(3).headerValue = "Machine Baseline"
        table.columnModel.getColumn(4).headerValue = "Category"

        val scrollPane = JBScrollPane(table)
        root.add(scrollPane, BorderLayout.CENTER)

        // 3. Selection Buttons
        val selectionPanel = JPanel(FlowLayout(FlowLayout.LEFT, 8, 0))
        val selectAllBtn = JButton("Select All").apply {
            addActionListener {
                drifts.forEach { it.selected = true }
                tableModel.fireTableDataChanged()
            }
        }
        val deselectAllBtn = JButton("Deselect All").apply {
            addActionListener {
                drifts.forEach { it.selected = false }
                tableModel.fireTableDataChanged()
            }
        }
        selectionPanel.add(selectAllBtn)
        selectionPanel.add(deselectAllBtn)
        root.add(selectionPanel, BorderLayout.SOUTH)

        return root
    }

    inner class DriftTableModel(private val items: List<DriftItem>) : AbstractTableModel() {
        private val columnNames = arrayOf("Apply", "Component", "Current", "Baseline", "Type")

        override fun getRowCount(): Int = items.size
        override fun getColumnCount(): Int = columnNames.size
        override fun getColumnName(col: Int): String = columnNames[col]

        override fun getColumnClass(col: Int): Class<*> = when (col) {
            0 -> java.lang.Boolean::class.java
            else -> String::class.java
        }

        override fun isCellEditable(row: Int, col: Int): Boolean = col == 0

        override fun getValueAt(row: Int, col: Int): Any {
            val item = items[row]
            return when (col) {
                0 -> item.selected
                1 -> item.key
                2 -> item.currentVersion
                3 -> item.baselineVersion
                4 -> item.category
                else -> ""
            }
        }

        override fun setValueAt(value: Any?, row: Int, col: Int) {
            if (col == 0 && value is Boolean) {
                items[row].selected = value
                fireTableCellUpdated(row, col)
            }
        }
    }
}
