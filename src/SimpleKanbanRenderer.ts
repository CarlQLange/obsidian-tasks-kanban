import { App, MarkdownPostProcessorContext, MarkdownRenderChild, TFile } from 'obsidian';
import { TasksIntegration, type Task } from './integration/TasksIntegration';
import { TasksQueryProcessor } from './TasksQueryProcessor';
import { TasksKanbanSettings, PRIORITY_DISPLAY } from './TasksKanbanSettings';
import { getSettings } from '../vendor/obsidian-tasks/src/Config/Settings';

/**
 * Renders inline kanban boards within markdown files
 * Extends MarkdownRenderChild to integrate with Obsidian's rendering pipeline
 * Supports drag & drop, auto-refresh, and multiple grouping strategies
 */
export class SimpleKanbanRenderer extends MarkdownRenderChild {
    private app: App;
    private tasksIntegration: TasksIntegration;
    private settings: TasksKanbanSettings;
    private source: string;
    private queryProcessor: TasksQueryProcessor;
    private context: MarkdownPostProcessorContext;
    private refreshTimeout: NodeJS.Timeout | null = null;
    private isUpdating = false;

    constructor(
        app: App,
        tasksIntegration: TasksIntegration,
        settings: TasksKanbanSettings,
        source: string,
        container: HTMLElement,
        context: MarkdownPostProcessorContext
    ) {
        super(container);
        this.app = app;
        this.tasksIntegration = tasksIntegration;
        this.settings = settings;
        this.source = source;
        this.queryProcessor = new TasksQueryProcessor(app, tasksIntegration, settings);
        this.context = context;
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
        try {
            // Get file path from context for placeholder resolution
            const filePath = this.context.sourcePath;
            
            // Execute query using the Tasks plugin Query system
            const queryResult = await this.queryProcessor.executeQuery(this.source, filePath);
            
            if (queryResult.error) {
                this.showError(`Query error: ${queryResult.error}`);
                return;
            }
            
            // Render the kanban board - either with swim lanes or traditional columns
            if (queryResult.isDualGrouping && queryResult.swimLanes) {
                this.renderSwimLaneBoard(queryResult.swimLanes);
            } else {
                this.renderKanbanBoard(queryResult.groupedTasks);
            }
            
        } catch (error) {
            console.error('Error rendering kanban board:', error);
            this.showError(`Failed to render kanban board: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private showError(message: string) {
        this.containerEl.empty();
        const errorDiv = this.containerEl.createDiv('kanban-error');
        errorDiv.textContent = message;
        errorDiv.style.color = 'var(--text-error)';
        errorDiv.style.padding = '1rem';
        errorDiv.style.border = '1px solid var(--background-modifier-border)';
        errorDiv.style.borderRadius = 'var(--radius-s)';
        errorDiv.style.background = 'var(--background-secondary)';
    }



    private getColumnOrder(groupedTasks: { [key: string]: Task[] }, groupBy: string = 'status'): string[] {
        const availableColumns = Object.keys(groupedTasks);
        
        if (!groupBy || groupBy === 'status') {
            // Use custom status order from settings, or get all available statuses from Tasks plugin
            const statusOrder = this.settings.statusOrder.length > 0 
                ? this.settings.statusOrder 
                : this.tasksIntegration.getStatusTypes();
            
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
        
        // Get column order based on grouping type - default to status since query processor handles grouping
        const columnOrder = this.getColumnOrder(groupedTasks, 'status');
        
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

    /**
     * Render kanban board with swim lanes for dual grouping
     */
    private renderSwimLaneBoard(swimLanes: { [swimLane: string]: { [column: string]: Task[] } }) {
        // Clear container
        this.containerEl.empty();
        
        // Create swim lane board container
        const boardContainer = this.containerEl.createDiv('kanban-board kanban-swimlanes plugin-tasks-kanban-board');
        
        // Add refresh button
        const refreshButton = boardContainer.createEl('button', {
            cls: 'kanban-refresh-button',
            text: '↻'
        });
        refreshButton.addEventListener('click', () => {
            this.render();
        });
        
        // Get sorted swim lane names
        const swimLaneNames = Object.keys(swimLanes).sort();
        
        // Get ordered column names from first swim lane (all should have same columns)
        const firstSwimLane = swimLanes[swimLaneNames[0]];
        const columnOrder = firstSwimLane ? this.getColumnOrder(firstSwimLane, 'status') : [];
        
        // Render column headers
        this.renderSwimLaneHeaders(boardContainer, columnOrder);
        
        // Render each swim lane
        for (const swimLaneName of swimLaneNames) {
            const swimLaneColumns = swimLanes[swimLaneName];
            this.renderSwimLane(boardContainer, swimLaneName, swimLaneColumns, columnOrder);
        }
        
        // Add task count
        const totalTasks = Object.values(swimLanes).reduce((swimLane, columns) => 
            swimLane + Object.values(columns).reduce((sum, tasks) => sum + tasks.length, 0), 0);
        if (totalTasks > 0) {
            const countDiv = this.containerEl.createDiv('plugin-tasks-kanban-count');
            countDiv.textContent = `${totalTasks} task${totalTasks === 1 ? '' : 's'}`;
        }
    }
    
    /**
     * Render the header row with column titles for swim lanes
     */
    private renderSwimLaneHeaders(boardContainer: HTMLElement, columnOrder: string[]) {
        const headerRow = boardContainer.createDiv('swimlane-header-row');
        
        // Empty cell for swim lane name column
        const swimLaneHeaderCell = headerRow.createDiv('swimlane-name-header');
        swimLaneHeaderCell.textContent = 'Project';
        
        // Create header for each column
        for (const columnName of columnOrder) {
            const headerCell = headerRow.createDiv('swimlane-column-header');
            headerCell.textContent = this.getColumnTitle(columnName);
        }
    }
    
    /**
     * Render a single swim lane row
     */
    private renderSwimLane(boardContainer: HTMLElement, swimLaneName: string, columns: { [column: string]: Task[] }, columnOrder: string[]) {
        const swimLaneRow = boardContainer.createDiv('swimlane-row');
        
        // Create swim lane name cell
        const nameCell = swimLaneRow.createDiv('swimlane-name');
        nameCell.textContent = swimLaneName;
        
        // Create column cells for this swim lane
        for (const columnName of columnOrder) {
            const tasks = columns[columnName] || [];
            const columnCell = swimLaneRow.createDiv('swimlane-column');
            
            // Add task count to column only if above threshold
            if (tasks.length > this.settings.taskCountThreshold) {
                const countDiv = columnCell.createDiv('swimlane-task-count');
                countDiv.textContent = `${tasks.length}`;
            }
            
            // Create content container for tasks
            const contentDiv = columnCell.createDiv('swimlane-column-content');
            
            // Set up drop zone for this swim lane column
            this.setupSwimLaneDropZone(contentDiv, swimLaneName, columnName);
            
            // Render tasks in this column
            for (const task of tasks) {
                this.renderTaskCard(contentDiv, task);
            }
        }
    }
    
    /**
     * Set up drag & drop for swim lane columns
     */
    private setupSwimLaneDropZone(columnCell: HTMLElement, swimLaneName: string, targetColumn: string) {
        columnCell.addEventListener('dragover', (e) => {
            e.preventDefault();
            columnCell.classList.add('drag-over');
        });
        
        columnCell.addEventListener('dragleave', () => {
            columnCell.classList.remove('drag-over');
        });
        
        columnCell.addEventListener('drop', async (e) => {
            e.preventDefault();
            columnCell.classList.remove('drag-over');
            
            // Get the dragged task data
            const taskData = e.dataTransfer?.getData('text/plain');
            if (taskData) {
                try {
                    const { taskId, currentColumn } = JSON.parse(taskData);
                    
                    // Only proceed if dropping on different column
                    if (currentColumn === targetColumn) return;
                    
                    // Parse task ID to get location info
                    const [taskPath, taskLineNumberStr, ...descParts] = taskId.split(':');
                    const taskLineNumber = parseInt(taskLineNumberStr) || 0;
                    const taskDescription = descParts.join(':');
                    
                    // Find the task to update
                    const taskForUpdate = {
                        description: taskDescription,
                        taskLocation: {
                            path: taskPath,
                            lineNumber: taskLineNumber
                        }
                    };
                    
                    // Convert column name to status type for updating
                    const targetStatusType = this.mapColumnToStatusType(targetColumn);
                    if (targetStatusType) {
                        // Prevent auto-refresh during update
                        this.isUpdating = true;
                        
                        try {
                            await this.tasksIntegration.updateTaskStatus(taskForUpdate as Task, targetStatusType);
                            // Refresh after successful update
                            this.debouncedRender(200);
                        } catch (error) {
                            console.error('Error updating task status:', error);
                            this.debouncedRender(100);
                        } finally {
                            setTimeout(() => {
                                this.isUpdating = false;
                            }, 1000);
                        }
                    }
                } catch (error) {
                    console.error('Error handling drop in swim lane:', error);
                }
            }
        });
    }

    private renderColumn(boardContainer: HTMLElement, status: string, tasks: Task[]) {
        // Create column container
        const column = boardContainer.createDiv('kanban-column plugin-tasks-kanban-column');
        
        // Create column header
        const header = column.createDiv('kanban-column-header plugin-tasks-kanban-column-header');
        header.textContent = this.getColumnTitle(status);
        
        // Add task count to header only if above threshold
        if (tasks.length > this.settings.taskCountThreshold) {
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
        description.textContent = this.cleanTaskDescription(task.description);
        
        // Add metadata
        this.renderTaskMetadata(cardContent, task);
        
        // Add actions
        this.renderTaskActions(cardContent, task);
    }

    private renderTaskMetadata(cardContent: HTMLElement, task: Task) {
        const metadata = cardContent.createDiv('kanban-card-metadata');
        
        // First row: Priority and dates
        const topRow = metadata.createDiv('kanban-card-metadata-row');
        
        // Priority
        if (this.settings.display.priority && task.priority) {
            console.log('Task priority:', task.priority, typeof task.priority);
            const priorityEl = topRow.createSpan('kanban-card-priority');
            this.renderPriority(priorityEl, task.priority);
        }
        
        // Due Date (most important)
        if (this.settings.display.dueDate && task.dueDate) {
            const dueDateEl = topRow.createSpan('kanban-card-due-date');
            this.renderDate(dueDateEl, task.dueDate, 'Due');
        }
        
        // Other dates in a second row if any are enabled
        const hasOtherDates = (this.settings.display.createdDate && task.createdDate) ||
                             (this.settings.display.startDate && task.startDate) ||
                             (this.settings.display.scheduledDate && task.scheduledDate) ||
                             (this.settings.display.doneDate && task.doneDate);
        
        if (hasOtherDates) {
            const datesRow = metadata.createDiv('kanban-card-metadata-row');
            
            if (this.settings.display.createdDate && task.createdDate) {
                const createdEl = datesRow.createSpan('kanban-card-created-date');
                this.renderDate(createdEl, task.createdDate, 'Created');
            }
            
            if (this.settings.display.startDate && task.startDate) {
                const startEl = datesRow.createSpan('kanban-card-start-date');
                this.renderDate(startEl, task.startDate, 'Start');
            }
            
            if (this.settings.display.scheduledDate && task.scheduledDate) {
                const scheduledEl = datesRow.createSpan('kanban-card-scheduled-date');
                this.renderDate(scheduledEl, task.scheduledDate, 'Scheduled');
            }
            
            if (this.settings.display.doneDate && task.doneDate) {
                const doneEl = datesRow.createSpan('kanban-card-done-date');
                this.renderDate(doneEl, task.doneDate, 'Done');
            }
        }
        
        // Third row: Project info and path
        const hasLocationInfo = (this.settings.display.projectInfo && task.taskLocation.path) ||
                               (this.settings.display.taskPath && task.taskLocation.path);
        
        if (hasLocationInfo) {
            const locationRow = metadata.createDiv('kanban-card-metadata-row');
            
            if (this.settings.display.projectInfo && task.taskLocation.path) {
                const projectEl = locationRow.createSpan('kanban-card-project');
                // Set a placeholder while loading
                projectEl.textContent = '📁 Loading...';
                
                // Load project info asynchronously
                this.extractProjectInfo(task).then(project => {
                    if (project) {
                        projectEl.textContent = `📁 ${project}`;
                    } else {
                        projectEl.remove();
                    }
                }).catch(error => {
                    console.warn('Error loading project info:', error);
                    projectEl.remove();
                });
            }
            
            if (this.settings.display.taskPath && task.taskLocation.path) {
                const pathEl = locationRow.createSpan('kanban-card-path');
                pathEl.textContent = task.taskLocation.path;
            }
        }
        
        // Tags row
        if (this.settings.display.tags && task.tags && task.tags.length > 0) {
            const tagsRow = metadata.createDiv('kanban-card-metadata-row');
            const tagsContainer = tagsRow.createDiv('kanban-card-tags');
            if (this.settings.format.compactTags) {
                tagsContainer.addClass('kanban-card-tags-compact');
            }
            for (const tag of task.tags) {
                const tagSpan = tagsContainer.createSpan('kanban-card-tag');
                tagSpan.textContent = tag;
            }
        }
    }
    
    private renderPriority(element: HTMLElement, priority: string) {
        const priorityInfo = PRIORITY_DISPLAY[priority as keyof typeof PRIORITY_DISPLAY];
        if (!priorityInfo) return;
        
        switch (this.settings.format.priorityStyle) {
            case 'emoji':
                if (priorityInfo.emoji) {
                    element.textContent = priorityInfo.emoji;
                }
                break;
            case 'text':
                element.textContent = priorityInfo.text;
                break;
            case 'color':
                element.style.backgroundColor = priorityInfo.color;
                element.textContent = '●';
                element.addClass('kanban-card-priority-color');
                break;
        }
    }
    
    private renderDate(element: HTMLElement, date: Date | string, label: string) {
        // Convert to Date object if it's a string
        const dateObj = date instanceof Date ? date : new Date(date);
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date:', date);
            return;
        }
        
        let dateString = '';
        
        switch (this.settings.format.dateFormat) {
            case 'short':
                dateString = dateObj.toLocaleDateString();
                break;
            case 'medium':
                dateString = dateObj.toLocaleDateString(undefined, { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
                break;
            case 'long':
                dateString = dateObj.toLocaleDateString(undefined, { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
                break;
        }
        
        if (this.settings.format.showDateLabels) {
            element.textContent = `${label}: ${dateString}`;
        } else {
            element.textContent = dateString;
        }
    }
    
    private async extractProjectInfo(task: Task): Promise<string | null> {
        const projectSettings = this.settings.project;
        
        // Try frontmatter first if configured
        if (projectSettings.source === 'frontmatter' || projectSettings.source === 'both') {
            const frontmatterProject = await this.getProjectFromFrontmatter(task.taskLocation.path, projectSettings.frontmatterKey);
            if (frontmatterProject) {
                return frontmatterProject;
            }
            
            // If 'frontmatter' only mode and no frontmatter found, return null
            if (projectSettings.source === 'frontmatter') {
                return null;
            }
        }
        
        // Use path-based extraction
        if (projectSettings.source === 'path' || (projectSettings.source === 'both' && projectSettings.fallbackToPath)) {
            return this.getProjectFromPath(task.taskLocation.path, projectSettings.pathSegment);
        }
        
        return null;
    }
    
    private async getProjectFromFrontmatter(filePath: string, frontmatterKey: string): Promise<string | null> {
        try {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                return null;
            }
            
            const fileCache = this.app.metadataCache.getFileCache(file);
            const frontmatter = fileCache?.frontmatter;
            
            if (frontmatter && frontmatter[frontmatterKey]) {
                return String(frontmatter[frontmatterKey]);
            }
        } catch (error) {
            console.warn('Error reading frontmatter for project:', error);
        }
        
        return null;
    }
    
    private getProjectFromPath(path: string, segmentIndex: number): string | null {
        const pathParts = path.split('/').filter(part => part.length > 0);
        
        if (pathParts.length === 0) {
            return null;
        }
        
        // Handle negative indices (from end)
        if (segmentIndex < 0) {
            const adjustedIndex = pathParts.length + segmentIndex;
            if (adjustedIndex >= 0 && adjustedIndex < pathParts.length) {
                return pathParts[adjustedIndex];
            }
        } else {
            // Handle positive indices (from start)
            if (segmentIndex < pathParts.length) {
                return pathParts[segmentIndex];
            }
        }
        
        return null;
    }
    
    private cleanTaskDescription(description: string): string {
        let cleaned = description;
        
        // Remove hashtags (tags) - match #word but not in the middle of words
        cleaned = cleaned.replace(/(?:^|\s)(#\w+)(?=\s|$)/g, ' ').trim();
        
        // Remove priority indicators - ⏫ 🔼 🔽 ⏬
        cleaned = cleaned.replace(/[⏫🔼🔽⏬]/g, '').trim();
        
        // Remove date patterns like 📅 2023-12-31, 📆 2023-12-31, ⏰ 2023-12-31
        cleaned = cleaned.replace(/[📅📆⏰⏳🗓]\s*\d{4}-\d{2}-\d{2}/g, '').trim();
        
        // Remove start date patterns like 🛫 2023-12-31
        cleaned = cleaned.replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, '').trim();
        
        // Remove done date patterns like ✅ 2023-12-31
        cleaned = cleaned.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '').trim();
        
        // Remove multiple consecutive spaces
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
        
        return cleaned;
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
                // Get the edited task line from the Tasks plugin modal
                const editedTaskLine = await this.tasksIntegration.editTask(task.originalMarkdown);
                
                // If the task was actually edited (not cancelled), save it to the file
                if (editedTaskLine && editedTaskLine !== task.originalMarkdown) {
                    await this.saveEditedTask(task, editedTaskLine);
                    // Refresh the kanban board to show the changes
                    this.debouncedRender(500);
                }
            } catch (error) {
                console.error('Error editing task:', error);
            }
        });
    }

    /**
     * Save an edited task line back to the file
     */
    private async saveEditedTask(task: Task, editedTaskLine: string): Promise<void> {
        try {
            // Get the file containing the task
            const file = this.app.vault.getAbstractFileByPath(task.taskLocation.path);
            
            if (!file || !(file instanceof TFile)) {
                throw new Error(`File not found: ${task.taskLocation.path}`);
            }

            // Read the file content
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');
            
            // Find the task line by searching for the original task description
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
            
            // Replace the line with the edited version
            lines[actualLineIndex] = editedTaskLine;
            
            // Save the modified content back to the file
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
            
        } catch (error) {
            console.error('Error saving edited task:', error);
            throw error;
        }
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
        // Since query processor handles grouping, determine current column from task status
        return task.status.type;
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
                        // TasksQueryProcessor handles grouping internally, we assume status-based for drag & drop
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
                } catch (error) {
                    console.error('Error handling drop:', error);
                }
            }
        });
    }

    private mapColumnToStatusType(columnName: string): string | null {
        // First try to get the exact status type from Tasks plugin settings
        try {
            const settings = getSettings();
            const coreStatuses = settings.statusSettings?.coreStatuses || [];
            const customStatuses = settings.statusSettings?.customStatuses || [];
            const allStatuses = [...coreStatuses, ...customStatuses];
            
            const matchingStatus = allStatuses.find((s: any) => 
                s.name === columnName || s.type === columnName || s.symbol === columnName
            );
            
            if (matchingStatus) {
                // For drag & drop, we need to return the status type/name for updateTaskStatus to process
                return matchingStatus.type || matchingStatus.name;
            }
        } catch (error) {
            console.error('Error getting Tasks plugin settings:', error);
        }
        
        // Fallback to default mapping
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
        // First try to get the display name from Tasks plugin settings
        try {
            const settings = getSettings();
            const coreStatuses = settings.statusSettings?.coreStatuses || [];
            const customStatuses = settings.statusSettings?.customStatuses || [];
            const allStatuses = [...coreStatuses, ...customStatuses];
            
            const matchingStatus = allStatuses.find((s: any) => 
                (s.type || s.name) === status || s.symbol === status
            );
            if (matchingStatus) {
                return matchingStatus.name || matchingStatus.type || status;
            }
        } catch (error) {
            console.error('Error getting Tasks plugin settings for column title:', error);
        }
        
        // Fallback to default titles
        switch (status) {
            case 'TODO': return 'To Do';
            case 'IN_PROGRESS': return 'In Progress';
            case 'DONE': return 'Done';
            case 'CANCELLED': return 'Cancelled';
            default: return status;
        }
    }
}