import { App, Notice, Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { KanbanQueryProcessor } from './src/KanbanQueryProcessor';
import { TasksIntegration } from './src/integration/TasksIntegration';
import { TasksKanbanSettings, DEFAULT_SETTINGS } from './src/TasksKanbanSettings';
import { TasksKanbanSettingTab } from './src/TasksKanbanSettingTab';

export default class TasksKanbanPlugin extends Plugin {
	tasksIntegration!: TasksIntegration;
	settings!: TasksKanbanSettings;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Initialize Tasks plugin integration
		this.tasksIntegration = new TasksIntegration(this.app);
		
		// Check if Tasks plugin is available
		if (!this.tasksIntegration.isTasksPluginAvailable()) {
			new Notice('Tasks Kanban: The Tasks plugin is required but not found. Please install and enable the Tasks plugin first.');
			return;
		}

		// Register tasks-kanban code block processor
		this.registerMarkdownCodeBlockProcessor('tasks-kanban', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const processor = new KanbanQueryProcessor(this.app, this.tasksIntegration, this.settings, source, el, ctx);
			processor.process();
		});

		// Add settings tab
		this.addSettingTab(new TasksKanbanSettingTab(this.app, this));
	}

	getTasksIntegration(): TasksIntegration {
		return this.tasksIntegration;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
