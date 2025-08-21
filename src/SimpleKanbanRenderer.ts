import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from 'obsidian';
import { TasksIntegration, type Task } from './integration/TasksIntegration';
import { SimpleQueryParser } from './SimpleQueryParser';

/**
 * Renders inline kanban boards within markdown files
 * Extends MarkdownRenderChild to integrate with Obsidian's rendering pipeline
 * Supports drag & drop, auto-refresh, and multiple grouping strategies
 */
export class SimpleKanbanRenderer extends MarkdownRenderChild {
    private app: App;
    private tasksIntegration: TasksIntegration;
    private source: string;
    private queryParser: SimpleQueryParser;
    private refreshTimeout: NodeJS.Timeout | null = null;
    private isUpdating = false;

    constructor(
        app: App,
        tasksIntegration: TasksIntegration,
        source: string,
        container: HTMLElement,
        context: MarkdownPostProcessorContext
    ) {
        super(container);
        this.app = app;
        this.tasksIntegration = tasksIntegration;
        this.source = source;
        this.queryParser = new SimpleQueryParser(source);
    }

    async onload() {
        try {
            await this.render();
            this.setupAutoRefresh();
        } catch (error) {
            console.error('Kanban render error:', error);
            this.containerEl.createDiv().innerHTML = `<pre>Error rendering kanban: ${error}</pre>`;
        }
    }

    /**
     * Sets up file system event listeners for automatic board refresh
     */
    private setupAutoRefresh() {
        // Listen for file changes to auto-refresh the kanban board
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                // Only refresh if a markdown file was modified and we're not currently updating
                if (file instanceof TFile && file.extension === 'md' && !this.isUpdating) {
                    // Debounce the refresh to avoid too many updates
                    this.debouncedRender(300);
                }
            })
        );

        // Also listen for file renames and deletions
        this.registerEvent(
            this.app.vault.on('rename', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.debouncedRender(200);
                }
            })
        );

        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                if (file instanceof TFile && file.extension === 'md') {
                    this.debouncedRender(200);
                }
            })
        );
    }

    /**
     * Debounced render to prevent multiple rapid refreshes
     */
    private debouncedRender(delay = 200) {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }
        this.refreshTimeout = setTimeout(() => {
            this.render();
            this.refreshTimeout = null;
        }, delay);
    }


    private async render() {
        // Get all tasks from the Tasks plugin
        const allTasks = await this.tasksIntegration.getAllTasks();
        
        // Apply query filtering using the parser
        const filteredTasks = this.queryParser.filterTasks(allTasks);
        
        // Group tasks based on query grouping or default to status
        const groupedTasks = this.groupTasks(filteredTasks);
        
        // Render the kanban board
        this.renderKanbanBoard(groupedTasks);
    }

    private groupTasks(tasks: Task[]): { [key: string]: Task[] } {
        const groupBy = this.queryParser.getGroupBy();
        
        // Default to status grouping if none specified
        if (!groupBy || groupBy === 'status') {
            return this.tasksIntegration.groupTasksByStatus(tasks);
        }
        
        // Handle other grouping types
        const grouped: { [key: string]: Task[] } = {};
        
        for (const task of tasks) {
            let groupKey = 'Other';
            
            switch (groupBy) {
                case 'path': {
                    // Group by file path
                    const pathParts = task.taskLocation.path.split('/');
                    groupKey = pathParts[pathParts.length - 1] || 'Root';
                    break;
                }
                    
                case 'priority':
                    groupKey = task.priority || 'None';
                    break;
                    
                case 'folder': {
                    // Group by folder
                    const folderParts = task.taskLocation.path.split('/');
                    groupKey = folderParts.length > 1 ? folderParts[folderParts.length - 2] : 'Root';
                    break;
                }
                    
                default:
                    // Fallback to status grouping
                    return this.tasksIntegration.groupTasksByStatus(tasks);
            }
            
            if (!grouped[groupKey]) {
                grouped[groupKey] = [];
            }
            grouped[groupKey].push(task);
        }
        
        return grouped;
    }

    private getColumnOrder(groupedTasks: { [key: string]: Task[] }): string[] {
        const groupBy = this.queryParser.getGroupBy();
        const availableColumns = Object.keys(groupedTasks);
        
        if (!groupBy || groupBy === 'status') {
            // For status grouping, use logical order
            const statusOrder = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
            const orderedColumns: string[] = [];
            
            // Add columns in preferred order if they exist
            for (const status of statusOrder) {
                if (availableColumns.includes(status)) {
                    orderedColumns.push(status);
                }
            }
            
            // Add any other columns that weren't in the standard order
            for (const column of availableColumns) {
                if (!orderedColumns.includes(column)) {
                    orderedColumns.push(column);
                }
            }
            
            return orderedColumns;
        }
        
        if (groupBy === 'priority') {
            // For priority grouping, use priority order
            const priorityOrder = ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'None'];
            const orderedColumns: string[] = [];
            
            for (const priority of priorityOrder) {
                if (availableColumns.includes(priority)) {
                    orderedColumns.push(priority);
                }
            }
            
            // Add any other columns
            for (const column of availableColumns) {
                if (!orderedColumns.includes(column)) {
                    orderedColumns.push(column);
                }
            }
            
            return orderedColumns;
        }
        
        // For other grouping types (path, folder, etc.), sort alphabetically
        return availableColumns.sort();
    }

    /**
     * Renders the complete kanban board with columns and task cards
     */
    private renderKanbanBoard(groupedTasks: { [status: string]: Task[] }) {
        // Clear container
        this.containerEl.empty();
        
        // Create kanban board container
        const boardContainer = this.containerEl.createDiv('kanban-board plugin-tasks-kanban-board');
        
        // Add subtle refresh button inside the board
        const refreshButton = boardContainer.createEl('button', {
            cls: 'kanban-refresh-button',
            text: '↻'
        });
        refreshButton.addEventListener('click', () => {
            this.render();
        });
        
        // Get column order based on grouping type
        const columnOrder = this.getColumnOrder(groupedTasks);
        
        // Render each column
        for (const columnKey of columnOrder) {
            const tasks = groupedTasks[columnKey] || [];
            this.renderColumn(boardContainer, columnKey, tasks);
        }
        
        // Add task count
        const totalTasks = Object.values(groupedTasks).reduce((sum, tasks) => sum + tasks.length, 0);
        if (totalTasks > 0) {
            const countDiv = this.containerEl.createDiv('plugin-tasks-kanban-count');
            countDiv.textContent = `${totalTasks} task${totalTasks === 1 ? '' : 's'}`;
        }
    }

    private renderColumn(boardContainer: HTMLElement, status: string, tasks: Task[]) {
        // Create column container
        const column = boardContainer.createDiv('kanban-column plugin-tasks-kanban-column');
        
        // Create column header
        const header = column.createDiv('kanban-column-header plugin-tasks-kanban-column-header');
        header.textContent = this.getColumnTitle(status);
        
        // Add task count to header
        if (tasks.length > 0) {
            const countSpan = header.createSpan('kanban-task-count');
            countSpan.textContent = ` (${tasks.length})`;
        }
        
        // Create column content
        const content = column.createDiv('kanban-column-content plugin-tasks-kanban-column-content');
        
        // Set up drop zone
        this.setupDropZone(content, status);
        
        // Render tasks
        for (const task of tasks) {
            this.renderTaskCard(content, task);
        }
    }

    private renderTaskCard(columnContent: HTMLElement, task: Task) {
        // Create card container
        const card = columnContent.createDiv('kanban-card plugin-tasks-kanban-card');
        // Use a more reliable task ID for DOM selection
        const reliableTaskId = `${task.taskLocation.path}:${task.taskLocation.lineNumber}:${task.description.slice(0, 50)}`;
        card.dataset.taskId = reliableTaskId;
        
        
        // Make card draggable
        card.draggable = true;
        this.setupCardDragHandlers(card, task);
        
        // Create card content
        const cardContent = card.createDiv('kanban-card-content');
        
        // Add task description
        const description = cardContent.createDiv('kanban-card-description');
        description.textContent = task.description;
        
        // Add metadata
        this.renderTaskMetadata(cardContent, task);
        
        // Add actions
        this.renderTaskActions(cardContent, task);
    }

    private renderTaskMetadata(cardContent: HTMLElement, task: Task) {
        const metadata = cardContent.createDiv('kanban-card-metadata');
        
        // Add due date if set
        if (task.dueDate) {
            const dueDate = metadata.createSpan('kanban-card-due-date');
            dueDate.textContent = `Due: ${task.dueDate.toDateString()}`;
        }
        
        // Add tags if present
        if (task.tags && task.tags.length > 0) {
            const tagsContainer = metadata.createDiv('kanban-card-tags');
            for (const tag of task.tags) {
                const tagSpan = tagsContainer.createSpan('kanban-card-tag');
                tagSpan.textContent = tag;
            }
        }
    }

    private renderTaskActions(cardContent: HTMLElement, task: Task) {
        // Add small edit emoji button
        const editButton = cardContent.createEl('button', {
            cls: 'kanban-card-edit',
            text: '✏️'
        });
        editButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await this.tasksIntegration.editTask(task.originalMarkdown);
            } catch (error) {
                console.error('Error editing task:', error);
            }
        });
    }

    private setupCardDragHandlers(card: HTMLElement, task: Task) {
        card.addEventListener('dragstart', (e) => {
            if (e.dataTransfer) {
                
                // Store both the task ID and the current column (group) it's in
                const currentColumn = this.getTaskColumn(task);
                // Create a unique identifier using path + line number + description  
                // Access the private properties from the actual task object
                const taskLocationExt = task.taskLocation as Record<string, unknown>;
                const taskPath = (taskLocationExt._tasksFile as { path?: string })?.path || task.taskLocation.path;
                const taskLineNumber = (taskLocationExt._lineNumber as number) || task.taskLocation.lineNumber;
                
                
                const uniqueId = `${taskPath || 'unknown'}:${taskLineNumber || 0}:${task.description.slice(0, 50) || 'no-desc'}`;
                const dragData = {
                    taskId: uniqueId,
                    originalColumn: currentColumn,
                    originalStatusType: task.status.type,
                    taskDescription: task.description, // Add for debugging
                    taskPath: taskPath,
                    taskLineNumber: taskLineNumber
                };
                
                
                e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                card.classList.add('dragging');
            }
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
    }

    private getTaskColumn(task: Task): string {
        const groupBy = this.queryParser.getGroupBy();
        
        switch (groupBy) {
            case 'path': {
                const pathParts = task.taskLocation.path.split('/');
                return pathParts[pathParts.length - 1] || 'Root';
            }
                
            case 'priority':
                return task.priority || 'None';
                
            case 'folder': {
                const folderParts = task.taskLocation.path.split('/');
                return folderParts.length > 1 ? folderParts[folderParts.length - 2] : 'Root';
            }
                
            default: // status grouping
                return task.status.type;
        }
    }

    /**
     * Configures drag & drop handlers for a column
     */
    private setupDropZone(content: HTMLElement, targetColumn: string) {
        content.addEventListener('dragover', (e) => {
            e.preventDefault();
            content.classList.add('drag-over');
        });
        
        content.addEventListener('dragleave', () => {
            content.classList.remove('drag-over');
        });
        
        content.addEventListener('drop', async (e) => {
            e.preventDefault();
            content.classList.remove('drag-over');
            
            const data = e.dataTransfer?.getData('text/plain');
            
            if (data) {
                try {
                    const dragData = JSON.parse(data);
                    
                    const { taskId, originalColumn, taskPath, taskLineNumber, taskDescription } = dragData;
                    
                    
                    // Don't do anything if dropped on the same column
                    if (originalColumn === targetColumn) {
                        return;
                    }
                    
                    if (!taskPath || !taskLineNumber) {
                        return;
                    }
                    
                    // Create a task object with the info we need for updating
                    const taskForUpdate = {
                        id: taskId,
                        description: taskDescription,
                        taskLocation: {
                            path: taskPath,
                            lineNumber: taskLineNumber
                        }
                    };
                    
                    
                    if (taskForUpdate) {
                        // Only handle status-based drag and drop for now
                        // Other grouping types (path, priority, folder) don't have meaningful drag operations
                        const groupBy = this.queryParser.getGroupBy();
                        
                        
                        if (!groupBy || groupBy === 'status') {
                            // Convert column name to status type for updating
                            const targetStatusType = this.mapColumnToStatusType(targetColumn);
                            if (targetStatusType) {
                                // Prevent auto-refresh during this update
                                this.isUpdating = true;
                                
                                try {
                                    await this.tasksIntegration.updateTaskStatus(taskForUpdate as Task, targetStatusType);
                                    // Do a clean refresh after successful update
                                    this.debouncedRender(200);
                                } catch (error) {
                                    console.error('Error updating task status:', error);
                                    // If update failed, still refresh to ensure consistent state
                                    this.debouncedRender(100);
                                } finally {
                                    // Allow auto-refresh again after update is complete
                                    setTimeout(() => {
                                        this.isUpdating = false;
                                    }, 1000);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error handling drop:', error);
                }
            }
        });
    }

    private mapColumnToStatusType(columnName: string): string | null {
        // Map column display names back to status types
        switch (columnName) {
            case 'TODO':
            case 'To Do':
                return 'TODO';
            case 'IN_PROGRESS':
            case 'In Progress':
                return 'IN_PROGRESS';
            case 'DONE':
            case 'Done':
                return 'DONE';
            case 'CANCELLED':
            case 'Cancelled':
                return 'CANCELLED';
            default:
                return columnName; // Assume it's already a status type
        }
    }

    private getColumnTitle(status: string): string {
        switch (status) {
            case 'TODO': return 'To Do';
            case 'IN_PROGRESS': return 'In Progress';
            case 'DONE': return 'Done';
            case 'CANCELLED': return 'Cancelled';
            default: return status;
        }
    }
}