import { App, PluginSettingTab, Setting } from 'obsidian';
import TasksKanbanPlugin from '../main';

/**
 * Settings tab for Tasks Kanban plugin
 * Allows users to customize what metadata is displayed on task cards
 */
export class TasksKanbanSettingTab extends PluginSettingTab {
    plugin: TasksKanbanPlugin;

    constructor(app: App, plugin: TasksKanbanPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Header
        containerEl.createEl('h2', { text: 'Tasks Kanban Settings' });
        
        // Description
        containerEl.createEl('p', { 
            text: 'Configure which metadata elements are displayed on your kanban task cards.'
        });

        // Display Options Section
        containerEl.createEl('h3', { text: 'Display Options' });

        new Setting(containerEl)
            .setName('Show tags')
            .setDesc('Display task tags on cards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.tags)
                .onChange(async (value) => {
                    this.plugin.settings.display.tags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show priority')
            .setDesc('Display task priority on cards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.priority)
                .onChange(async (value) => {
                    this.plugin.settings.display.priority = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show due date')
            .setDesc('Display task due dates on cards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.dueDate)
                .onChange(async (value) => {
                    this.plugin.settings.display.dueDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show created date')
            .setDesc('Display when the task was created')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.createdDate)
                .onChange(async (value) => {
                    this.plugin.settings.display.createdDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show start date')
            .setDesc('Display task start dates on cards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.startDate)
                .onChange(async (value) => {
                    this.plugin.settings.display.startDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show scheduled date')
            .setDesc('Display task scheduled dates on cards')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.scheduledDate)
                .onChange(async (value) => {
                    this.plugin.settings.display.scheduledDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show done date')
            .setDesc('Display when the task was completed')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.doneDate)
                .onChange(async (value) => {
                    this.plugin.settings.display.doneDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show task path')
            .setDesc('Display the file path where the task is located')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.taskPath)
                .onChange(async (value) => {
                    this.plugin.settings.display.taskPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show project info')
            .setDesc('Display project/folder information derived from task path')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.display.projectInfo)
                .onChange(async (value) => {
                    this.plugin.settings.display.projectInfo = value;
                    await this.plugin.saveSettings();
                }));

        // Format Options Section
        containerEl.createEl('h3', { text: 'Format Options' });

        new Setting(containerEl)
            .setName('Date format')
            .setDesc('Choose how dates are displayed')
            .addDropdown(dropdown => dropdown
                .addOption('short', 'Short (12/31/2023)')
                .addOption('medium', 'Medium (Dec 31, 2023)')
                .addOption('long', 'Long (December 31, 2023)')
                .setValue(this.plugin.settings.format.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.format.dateFormat = value as 'short' | 'medium' | 'long';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show date labels')
            .setDesc('Show labels like "Due:", "Created:" before dates')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.format.showDateLabels)
                .onChange(async (value) => {
                    this.plugin.settings.format.showDateLabels = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Compact tags')
            .setDesc('Display tags in a more compact format')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.format.compactTags)
                .onChange(async (value) => {
                    this.plugin.settings.format.compactTags = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Priority style')
            .setDesc('Choose how task priority is displayed')
            .addDropdown(dropdown => dropdown
                .addOption('text', 'Text (High, Medium, Low)')
                .addOption('emoji', 'Emoji (🔴 🟡 🔵)')
                .addOption('color', 'Color indicator')
                .setValue(this.plugin.settings.format.priorityStyle)
                .onChange(async (value) => {
                    this.plugin.settings.format.priorityStyle = value as 'text' | 'emoji' | 'color';
                    await this.plugin.saveSettings();
                }));

        // Project Configuration Section
        containerEl.createEl('h3', { text: 'Project Configuration' });
        
        containerEl.createEl('p', { 
            text: 'Configure how project information is extracted and displayed.'
        });

        new Setting(containerEl)
            .setName('Project source')
            .setDesc('Where to get project information from')
            .addDropdown(dropdown => dropdown
                .addOption('frontmatter', 'Frontmatter only')
                .addOption('path', 'File path only')
                .addOption('both', 'Frontmatter first, fallback to path')
                .setValue(this.plugin.settings.project.source)
                .onChange(async (value) => {
                    this.plugin.settings.project.source = value as 'frontmatter' | 'path' | 'both';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Frontmatter key')
            .setDesc('Which frontmatter property to read for project name')
            .addText(text => text
                .setPlaceholder('project')
                .setValue(this.plugin.settings.project.frontmatterKey)
                .onChange(async (value) => {
                    this.plugin.settings.project.frontmatterKey = value || 'project';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Path segment')
            .setDesc('Which folder in the path to use as project (0=first, -1=last, -2=second from end)')
            .addText(text => text
                .setPlaceholder('0')
                .setValue(String(this.plugin.settings.project.pathSegment))
                .onChange(async (value) => {
                    const num = parseInt(value) || 0;
                    this.plugin.settings.project.pathSegment = num;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Fallback to path')
            .setDesc('If frontmatter project is not found, try extracting from path')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.project.fallbackToPath)
                .onChange(async (value) => {
                    this.plugin.settings.project.fallbackToPath = value;
                    await this.plugin.saveSettings();
                }));

        // Status Column Order Section
        containerEl.createEl('h3', { text: 'Status Column Order' });
        
        containerEl.createEl('p', { 
            text: 'Customize the order of status columns in kanban boards. Leave empty to use Tasks plugin default order.'
        });

        new Setting(containerEl)
            .setName('Status column order')
            .setDesc('Comma-separated list of status types (e.g., TODO,IN_PROGRESS,DONE,CANCELLED)')
            .addText(text => text
                .setPlaceholder('TODO,IN_PROGRESS,DONE,CANCELLED')
                .setValue(this.plugin.settings.statusOrder.join(','))
                .onChange(async (value) => {
                    this.plugin.settings.statusOrder = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                }));
    }
}