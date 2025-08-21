import { App, Plugin, TFile } from 'obsidian';

export interface TasksPlugin extends Plugin {
	apiV1: {
		createTaskLineModal(): Promise<string>;
		editTaskLineModal(taskLine: string): Promise<string>;
		executeToggleTaskDoneCommand(line: string, path: string): string;
	};
	getTasks(): Task[];
	settings: Record<string, unknown>;
}

export interface Task {
	status: {
		symbol: string;
		name: string;
		type: string;
	};
	description: string;
	priority: string;
	tags: string[];
	createdDate: Date | null;
	startDate: Date | null;
	scheduledDate: Date | null;
	dueDate: Date | null;
	doneDate: Date | null;
	cancelledDate: Date | null;
	taskLocation: {
		path: string;
		lineNumber: number;
	};
	originalMarkdown: string;
	id: string;
}

export class TasksIntegration {
	private app: App;
	private tasksPlugin: TasksPlugin | null = null;

	constructor(app: App) {
		this.app = app;
		this.initializeTasksPlugin();
	}

	private initializeTasksPlugin() {
		// @ts-ignore - accessing internal plugin manager
		const plugins = this.app.plugins;
		if (plugins && plugins.plugins && plugins.plugins['obsidian-tasks-plugin']) {
			this.tasksPlugin = plugins.plugins['obsidian-tasks-plugin'] as TasksPlugin;
		}
	}

	isTasksPluginAvailable(): boolean {
		return this.tasksPlugin !== null && this.tasksPlugin.apiV1 !== undefined;
	}

	getTasksPlugin(): TasksPlugin | null {
		return this.tasksPlugin;
	}

	async getAllTasks(): Promise<Task[]> {
		if (!this.isTasksPluginAvailable()) {
			throw new Error('Tasks plugin is not available');
		}

		try {
			// Get tasks from the Tasks plugin's internal cache
			const tasksPlugin = this.getTasksPlugin();
			if (tasksPlugin && tasksPlugin.getTasks) {
				return tasksPlugin.getTasks();
			}
			return [];
		} catch (error) {
			console.error('Failed to get tasks from Tasks plugin:', error);
			return [];
		}
	}

	async createTask(): Promise<string> {
		if (!this.isTasksPluginAvailable() || !this.tasksPlugin) {
			throw new Error('Tasks plugin is not available');
		}

		return this.tasksPlugin.apiV1.createTaskLineModal();
	}

	async editTask(taskLine: string): Promise<string> {
		if (!this.isTasksPluginAvailable() || !this.tasksPlugin) {
			throw new Error('Tasks plugin is not available');
		}

		return this.tasksPlugin.apiV1.editTaskLineModal(taskLine);
	}

	async toggleTaskDone(taskLine: string, path: string): Promise<string> {
		if (!this.isTasksPluginAvailable() || !this.tasksPlugin) {
			throw new Error('Tasks plugin is not available');
		}

		return this.tasksPlugin.apiV1.executeToggleTaskDoneCommand(taskLine, path);
	}

	getStatusTypes(): string[] {
		// Default status types that can be extended based on Tasks plugin configuration
		return ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
	}

	groupTasksByStatus(tasks: Task[]): { [status: string]: Task[] } {
		const grouped: { [status: string]: Task[] } = {};
		
		// Initialize groups
		this.getStatusTypes().forEach(status => {
			grouped[status] = [];
		});

		// Group tasks
		tasks.forEach(task => {
			const statusType = this.mapStatusToType(task.status.type || task.status.symbol);
			if (grouped[statusType]) {
				grouped[statusType].push(task);
			} else {
				// Handle unknown status types
				if (!grouped['OTHER']) {
					grouped['OTHER'] = [];
				}
				grouped['OTHER'].push(task);
			}
		});

		return grouped;
	}

	private mapStatusToType(status: string): string {
		// Map Tasks plugin status symbols/types to our kanban columns
		switch (status.toLowerCase()) {
			case ' ':
			case 'todo':
				return 'TODO';
			case '/':
			case 'in_progress':
			case 'in-progress':
				return 'IN_PROGRESS';
			case 'x':
			case 'done':
				return 'DONE';
			case '-':
			case 'cancelled':
				return 'CANCELLED';
			default:
				return 'TODO';
		}
	}

	async updateTaskStatus(task: Task, newStatus: string): Promise<void> {
		if (!this.isTasksPluginAvailable()) {
			throw new Error('Tasks plugin is not available');
		}

		try {
			console.log('updateTaskStatus called:', { task: task.description, newStatus, taskId: task.id });
			
			const statusSymbol = this.getStatusSymbol(newStatus);
			console.log('Status symbol for', newStatus, ':', statusSymbol);
			
			// Get the file containing the task
			const file = this.app.vault.getAbstractFileByPath(task.taskLocation.path);
			console.log('File found:', file ? file.path : 'Not found');
			
			if (!file || !(file instanceof TFile)) {
				throw new Error(`File not found: ${task.taskLocation.path}`);
			}

			// Read the file content
			const content = await this.app.vault.read(file);
			console.log('File content preview:', content.substring(0, 200) + (content.length > 200 ? '...' : ''));
			
			const lines = content.split('\n');
			console.log('All lines in file:');
			lines.forEach((line, index) => {
				console.log(`Line ${index + 1}: "${line}"`);
			});
			
			// Find the actual task line by searching for the task description
			let actualLineIndex = -1;
			const taskDescription = task.description;
			
			console.log('Looking for task description:', `"${taskDescription}"`);
			
			// Search for a line containing the task description
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.includes(taskDescription) && line.match(/^\s*-\s*\[.*\]/)) {
					actualLineIndex = i;
					console.log('Found task on line:', i + 1, `"${line}"`);
					break;
				}
			}
			
			if (actualLineIndex === -1) {
				throw new Error(`Could not find task "${taskDescription}" in file`);
			}
			
			const originalLine = lines[actualLineIndex];
			console.log('Original line:', `"${originalLine}"`);
			
			// Update the task status in the line
			const updatedLine = this.updateTaskLineStatus(originalLine, statusSymbol);
			console.log('Updated line:', `"${updatedLine}"`);
			
			if (updatedLine !== originalLine) {
				// Update the line in the content
				lines[actualLineIndex] = updatedLine;
				const updatedContent = lines.join('\n');
				
				// Write back to the file
				await this.app.vault.modify(file, updatedContent);
				
				console.log('Successfully updated task status:', task.description, 'to', newStatus);
			} else {
				console.log('No changes needed - line already has correct status');
			}
			
		} catch (error) {
			console.error('Failed to update task status:', error);
			throw error;
		}
	}

	private updateTaskLineStatus(line: string, newStatusSymbol: string): string {
		// Match task format: - [x] task description or - [ ] task description
		const taskRegex = /^(\s*-\s*\[)[^\]]*(\]\s*.*)$/;
		const match = line.match(taskRegex);
		
		if (match) {
			// Replace the status symbol between the brackets
			return match[1] + newStatusSymbol + match[2];
		}
		
		// If it doesn't match the expected format, return unchanged
		return line;
	}

	private getStatusSymbol(statusType: string): string {
		switch (statusType) {
			case 'TODO':
				return ' ';
			case 'IN_PROGRESS':
				return '/';
			case 'DONE':
				return 'x';
			case 'CANCELLED':
				return '-';
			default:
				return ' ';
		}
	}
}