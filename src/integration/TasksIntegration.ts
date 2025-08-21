import { App, Plugin, TFile } from 'obsidian';
import { getSettings } from '../../vendor/obsidian-tasks/src/Config/Settings';

/**
 * Interface for the Obsidian Tasks plugin
 * Provides access to the Tasks plugin API and task data
 */
export interface TasksPlugin extends Plugin {
	apiV1: {
		createTaskLineModal(): Promise<string>;
		editTaskLineModal(taskLine: string): Promise<string>;
		executeToggleTaskDoneCommand(line: string, path: string): string;
	};
	getTasks(): Task[];
	settings: Record<string, unknown>;
}

/**
 * Task object interface matching the Tasks plugin Task model
 * Contains all task properties needed for kanban rendering and manipulation
 */
export interface Task {
	status: {
		symbol: string;
		name: string;
		type: string;
	};
	description: string;
	priority: string;
	tags: string[];
	createdDate: Date | string | null;
	startDate: Date | string | null;
	scheduledDate: Date | string | null;
	dueDate: Date | string | null;
	doneDate: Date | string | null;
	cancelledDate: Date | string | null;
	taskLocation: {
		path: string;
		lineNumber: number;
	};
	originalMarkdown: string;
	id: string;
}

/**
 * Integration layer for communicating with the Obsidian Tasks plugin
 * Handles task retrieval, status updates, and file operations
 */
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
		// Get status types from Tasks plugin settings if available
		if (this.tasksPlugin && this.tasksPlugin.settings) {
			// @ts-ignore - accessing internal settings
			const settings = this.tasksPlugin.settings as any;
			const coreStatuses = settings.statusSettings?.coreStatuses || [];
			const customStatuses = settings.statusSettings?.customStatuses || [];
			const allStatuses = [...coreStatuses, ...customStatuses];
			
			if (allStatuses.length > 0) {
				return allStatuses.map((status: any) => status.type || status.name || 'UNKNOWN');
			}
		}
		
		// Fallback to default status types
		return ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
	}

	groupTasksByStatus(tasks: Task[]): { [status: string]: Task[] } {
		const grouped: { [status: string]: Task[] } = {};
		
		// Get all available status types from Tasks plugin
		const allStatusTypes = this.getAllAvailableStatusTypes();
		
		// Initialize groups for all status types
		allStatusTypes.forEach(status => {
			grouped[status] = [];
		});

		// Group tasks
		tasks.forEach(task => {
			const statusType = task.status.type || task.status.name || this.mapStatusToType(task.status.symbol);
			if (!grouped[statusType]) {
				grouped[statusType] = [];
			}
			grouped[statusType].push(task);
		});

		return grouped;
	}

	/**
	 * Get all available status types including custom ones from Tasks plugin
	 */
	private getAllAvailableStatusTypes(): string[] {
		if (this.tasksPlugin && this.tasksPlugin.settings) {
			// @ts-ignore - accessing internal settings
			const settings = this.tasksPlugin.settings as any;
			const coreStatuses = settings.statusSettings?.coreStatuses || [];
			const customStatuses = settings.statusSettings?.customStatuses || [];
			const allStatuses = [...coreStatuses, ...customStatuses];
			
			if (allStatuses.length > 0) {
				return allStatuses.map((status: any) => status.type || status.name || 'UNKNOWN');
			}
		}
		
		// Fallback to default status types
		return ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
	}

	private mapStatusToType(status: string): string {
		// Check if Tasks plugin has custom status mappings
		if (this.tasksPlugin && this.tasksPlugin.settings) {
			// @ts-ignore - accessing internal settings
			const settings = this.tasksPlugin.settings as any;
			const coreStatuses = settings.statusSettings?.coreStatuses || [];
			const customStatuses = settings.statusSettings?.customStatuses || [];
			const allStatuses = [...coreStatuses, ...customStatuses];
			
			const matchingStatus = allStatuses.find((s: any) => s.symbol === status);
			if (matchingStatus) {
				return matchingStatus.type || matchingStatus.name || status;
			}
		}
		
		// Fallback to default mapping
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
				return status.toUpperCase();
		}
	}

	/**
	 * Updates a task's status by modifying the source file
	 * Uses description-based search for reliable task identification
	 */
	async updateTaskStatus(task: Task, newStatus: string): Promise<void> {
		if (!this.isTasksPluginAvailable()) {
			throw new Error('Tasks plugin is not available');
		}

		try {
			const statusSymbol = this.getStatusSymbol(newStatus);
			
			// Get the file containing the task
			const file = this.app.vault.getAbstractFileByPath(task.taskLocation.path);
			
			if (!file || !(file instanceof TFile)) {
				throw new Error(`File not found: ${task.taskLocation.path}`);
			}

			// Read the file content
			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			
			// Find the actual task line by searching for the task description
			// Find the actual task line by searching for the task description
			let actualLineIndex = -1;
			const taskDescription = task.description;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.includes(taskDescription) && line.match(/^\s*-\s*\[.*\]/)) {
					actualLineIndex = i;
					break;
				}
			}
			
			if (actualLineIndex === -1) {
				throw new Error(`Could not find task "${taskDescription}" in file`);
			}
			
			const originalLine = lines[actualLineIndex];
			
			// Update the task status in the line
			const updatedLine = this.updateTaskLineStatus(originalLine, statusSymbol);
			
			if (updatedLine !== originalLine) {
				// Update the line in the content
				lines[actualLineIndex] = updatedLine;
				const updatedContent = lines.join('\n');
				
				// Write back to the file
				await this.app.vault.modify(file, updatedContent);
			}
			
		} catch (error) {
			console.error('Failed to update task status:', error);
			throw error;
		}
	}

	/**
	 * Updates the status symbol in a task line using regex replacement
	 */
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

	/**
	 * Maps status types to their markdown symbols
	 */
	private getStatusSymbol(statusType: string): string {
		// Check if Tasks plugin has custom status mappings
		try {
			const settings = getSettings();
			const coreStatuses = settings.statusSettings?.coreStatuses || [];
			const customStatuses = settings.statusSettings?.customStatuses || [];
			const allStatuses = [...coreStatuses, ...customStatuses];
			
			const matchingStatus = allStatuses.find((s: any) => 
				s.type === statusType || s.name === statusType || s.symbol === statusType
			);
			if (matchingStatus) {
				return matchingStatus.symbol;
			}
		} catch (error) {
			console.error('Error getting Tasks plugin settings in getStatusSymbol:', error);
		}
		
		// Fallback to default mapping
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