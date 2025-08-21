import { App, Notice, Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { KanbanQueryProcessor } from './src/KanbanQueryProcessor';
import { TasksIntegration } from './src/integration/TasksIntegration';

export default class TasksKanbanPlugin extends Plugin {
	tasksIntegration!: TasksIntegration;

	async onload() {
		// Initialize Tasks plugin integration
		this.tasksIntegration = new TasksIntegration(this.app);
		
		// Check if Tasks plugin is available
		if (!this.tasksIntegration.isTasksPluginAvailable()) {
			new Notice('Tasks Kanban: The Tasks plugin is required but not found. Please install and enable the Tasks plugin first.');
			return;
		}

		// Register tasks-kanban code block processor
		this.registerMarkdownCodeBlockProcessor('tasks-kanban', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const processor = new KanbanQueryProcessor(this.app, this.tasksIntegration, source, el, ctx);
			processor.process();
		});
	}

	getTasksIntegration(): TasksIntegration {
		return this.tasksIntegration;
	}
}
