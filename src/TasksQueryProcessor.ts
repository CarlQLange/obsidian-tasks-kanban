import { App } from 'obsidian';
import { Query } from '../vendor/obsidian-tasks/src/Query/Query';
import { QueryResult } from '../vendor/obsidian-tasks/src/Query/QueryResult';
import { Task as TasksTask } from '../vendor/obsidian-tasks/src/Task/Task';
import { TasksIntegration, Task } from './integration/TasksIntegration';
import { makeQueryContext } from '../vendor/obsidian-tasks/src/Scripting/QueryContext';
import { TasksFile } from '../vendor/obsidian-tasks/src/Scripting/TasksFile';
import { getSettings } from '../vendor/obsidian-tasks/src/Config/Settings';
import { StatusType } from '../vendor/obsidian-tasks/src/Statuses/StatusConfiguration';
import { TasksKanbanSettings } from './TasksKanbanSettings';

/**
 * Processes queries using the actual Tasks plugin Query class
 * Provides access to their full query language including placeholders, complex filters, etc.
 */
export class TasksQueryProcessor {
    private app: App;
    private tasksIntegration: TasksIntegration;
    private settings: TasksKanbanSettings;

    constructor(app: App, tasksIntegration: TasksIntegration, settings: TasksKanbanSettings) {
        this.app = app;
        this.tasksIntegration = tasksIntegration;
        this.settings = settings;
    }

    /**
     * Execute a query using the Tasks plugin's Query class
     * @param source The query string (supports full Tasks syntax)
     * @param filePath The path of the file containing the query (for placeholder resolution)
     * @returns Object with grouped tasks and metadata
     */
    async executeQuery(source: string, filePath?: string): Promise<{
        groupedTasks: { [key: string]: Task[] };
        totalCount: number;
        error?: string;
    }> {
        try {
            // Get all tasks from Tasks plugin as their Task objects
            const tasksPluginTasks = await this.getTasksPluginTasks();
            
            // Create query context for placeholder resolution
            let queryContext;
            if (filePath) {
                const tasksFile = new TasksFile(filePath);
                queryContext = makeQueryContext(tasksFile);
            }
            
            // Add default grouping if not specified in source
            let processedSource = source;
            if (!source.toLowerCase().includes('group by')) {
                processedSource = source + '\ngroup by function task.status.typeGroupText';
            }
            
            // Create and execute the query
            const query = new Query(processedSource, queryContext?.query.file);
            
            if (query.error) {
                return {
                    groupedTasks: {},
                    totalCount: 0,
                    error: query.error
                };
            }
            
            // Apply the query to get filtered and grouped results
            const queryResult = query.applyQueryToTasks(tasksPluginTasks);
            
            // Convert QueryResult to our format
            const groupedTasks = this.convertQueryResultToGroupedTasks(queryResult);
            
            return {
                groupedTasks,
                totalCount: queryResult.totalTasksCount,
                error: queryResult.searchErrorMessage
            };
            
        } catch (error) {
            console.error('Error executing Tasks plugin query:', error);
            return {
                groupedTasks: {},
                totalCount: 0,
                error: error instanceof Error ? error.message : 'Unknown query error'
            };
        }
    }

    /**
     * Get tasks from Tasks plugin as their native Task objects
     */
    private async getTasksPluginTasks(): Promise<TasksTask[]> {
        // Get the raw tasks from Tasks plugin
        const tasksPlugin = this.tasksIntegration.getTasksPlugin();
        if (!tasksPlugin || !tasksPlugin.getTasks) {
            throw new Error('Tasks plugin not available');
        }
        
        // The Tasks plugin's getTasks() returns their Task objects
        return tasksPlugin.getTasks() as unknown as TasksTask[];
    }

    /**
     * Convert Tasks plugin QueryResult with TaskGroups to our grouped format
     * Returns groups in logical order based on status workflow
     */
    private convertQueryResultToGroupedTasks(queryResult: QueryResult): { [key: string]: Task[] } {
        const tempGroups: { [key: string]: Task[] } = {};
        
        // First, populate with actual tasks from query result
        for (const taskGroup of queryResult.taskGroups.groups) {
            // Use the most specific group name (last in the hierarchy)
            const rawGroupName = taskGroup.groups[taskGroup.groups.length - 1] || 'Ungrouped';
            
            // Convert internal status identifier to display name
            const displayGroupName = this.convertStatusIdToDisplayName(rawGroupName);
            
            // Convert Tasks plugin Task objects to our Task interface
            const convertedTasks = taskGroup.tasks.map(tasksTask => this.convertTasksTaskToTask(tasksTask));
            
            // Use the display name for the group
            if (!tempGroups[displayGroupName]) {
                tempGroups[displayGroupName] = [];
            }
            tempGroups[displayGroupName].push(...convertedTasks);
        }
        
        // Return ordered groups with empty columns for missing statuses
        return this.createOrderedGroupsWithEmptyColumns(tempGroups);
    }

    /**
     * Create ordered groups with empty columns for missing status types
     */
    private createOrderedGroupsWithEmptyColumns(populatedGroups: { [key: string]: Task[] }): { [key: string]: Task[] } {
        const orderedGroups: { [key: string]: Task[] } = {};
        
        // Get ordered status names
        const orderedStatusNames = this.getOrderedStatusNames();
        
        // Add groups in the correct order
        for (const statusName of orderedStatusNames) {
            orderedGroups[statusName] = populatedGroups[statusName] || [];
        }
        
        // Add any groups that weren't in our ordered list
        for (const [groupName, tasks] of Object.entries(populatedGroups)) {
            if (!orderedGroups[groupName]) {
                orderedGroups[groupName] = tasks;
            }
        }
        
        return orderedGroups;
    }

    /**
     * Get status names in logical workflow order, respecting user settings
     */
    private getOrderedStatusNames(): string[] {
        try {
            const tasksSettings = getSettings();
            const coreStatuses = tasksSettings.statusSettings.coreStatuses || [];
            const customStatuses = tasksSettings.statusSettings.customStatuses || [];
            const allStatuses = [...coreStatuses, ...customStatuses];
            
            // Create a map of status type to display name
            const statusTypeToName = new Map<string, string>();
            const displayNameToStatus = new Map<string, any>();
            for (const status of allStatuses) {
                const displayName = status.name || status.type || '';
                statusTypeToName.set(status.type || '', displayName);
                displayNameToStatus.set(displayName, status);
                // Also map by type for direct lookup
                displayNameToStatus.set(status.type || '', status);
            }
            
            // Check if user has custom statusOrder settings
            if (this.settings.statusOrder && this.settings.statusOrder.length > 0) {
                const customOrderedNames: string[] = [];
                
                // First, add statuses in user-specified order
                for (const userStatus of this.settings.statusOrder) {
                    // Try to find matching status by type or display name
                    const matchingStatus = displayNameToStatus.get(userStatus) || 
                                         allStatuses.find(s => s.type === userStatus || s.name === userStatus);
                    
                    if (matchingStatus) {
                        const displayName = matchingStatus.name || matchingStatus.type || '';
                        if (!customOrderedNames.includes(displayName)) {
                            customOrderedNames.push(displayName);
                        }
                    }
                }
                
                // Add any remaining statuses not in user order
                for (const status of allStatuses) {
                    const displayName = status.name || status.type || '';
                    if (!customOrderedNames.includes(displayName)) {
                        customOrderedNames.push(displayName);
                    }
                }
                
                return customOrderedNames;
            }
            
            // Fallback to default workflow order if no user settings
            const workflowOrder = [
                StatusType.TODO,
                StatusType.IN_PROGRESS, 
                StatusType.DONE,
                StatusType.CANCELLED,
                StatusType.NON_TASK,
                StatusType.EMPTY
            ];
            
            // Convert to display names in workflow order
            const orderedNames: string[] = [];
            for (const statusType of workflowOrder) {
                const displayName = statusTypeToName.get(statusType);
                if (displayName) {
                    orderedNames.push(displayName);
                }
            }
            
            // Add any remaining statuses that weren't in the workflow order
            for (const status of allStatuses) {
                const name = status.name || status.type || '';
                if (!orderedNames.includes(name)) {
                    orderedNames.push(name);
                }
            }
            
            return orderedNames;
        } catch (error) {
            console.error('Error getting ordered status names:', error);
            return ['Todo', 'In Progress', 'Done', 'Cancelled'];
        }
    }

    /**
     * Get all available status types from Tasks plugin
     */
    private getAllAvailableStatusTypes(): string[] {
        try {
            const settings = getSettings();
            const coreStatuses = settings.statusSettings.coreStatuses || [];
            const customStatuses = settings.statusSettings.customStatuses || [];
            const allStatuses = [...coreStatuses, ...customStatuses];
            
            if (allStatuses.length > 0) {
                return allStatuses.map((status: any) => status.name || status.symbol || 'UNKNOWN');
            }
        } catch (error) {
            console.error('Error getting status types from Tasks plugin:', error);
        }
        
        // Fallback to default status types
        return ['Todo', 'In Progress', 'Done', 'Cancelled'];
    }

    /**
     * Convert internal status identifier (like %%4%%CANCELLED) to display name
     */
    private convertStatusIdToDisplayName(statusId: string): string {
        try {
            // Handle internal status identifiers like %%4%%CANCELLED
            if (statusId.includes('%%')) {
                const settings = getSettings();
                const coreStatuses = settings.statusSettings.coreStatuses || [];
                const customStatuses = settings.statusSettings.customStatuses || [];
                const allStatuses = [...coreStatuses, ...customStatuses];
                
                // Extract the status type from the identifier
                const parts = statusId.split('%%');
                const statusType = parts.length > 2 ? parts[2] : statusId;
                
                // Find matching status by type or symbol
                const matchingStatus = allStatuses.find((s: any) => 
                    s.type === statusType || s.symbol === statusType || s.name === statusType
                );
                
                if (matchingStatus) {
                    return matchingStatus.name || matchingStatus.type || statusType;
                }
                
                return statusType;
            }
            
            // Also check for regular status names that need to be converted to display names
            const settings = getSettings();
            const coreStatuses = settings.statusSettings.coreStatuses || [];
            const customStatuses = settings.statusSettings.customStatuses || [];
            const allStatuses = [...coreStatuses, ...customStatuses];
            
            const matchingStatus = allStatuses.find((s: any) => 
                s.type === statusId || s.symbol === statusId || s.name === statusId
            );
            
            if (matchingStatus) {
                return matchingStatus.name || matchingStatus.type || statusId;
            }
        } catch (error) {
            console.error('Error converting status ID to display name:', error);
        }
        
        // Return as-is if not found or error occurred
        return statusId;
    }

    /**
     * Convert Tasks plugin Task object to our Task interface
     */
    private convertTasksTaskToTask(tasksTask: TasksTask): Task {
        return {
            status: {
                symbol: tasksTask.status.symbol,
                name: tasksTask.status.name,
                type: tasksTask.status.type.toString(),
            },
            description: tasksTask.description,
            priority: tasksTask.priority.toString(),
            tags: tasksTask.tags,
            createdDate: tasksTask.createdDate ? tasksTask.createdDate.toDate() : null,
            startDate: tasksTask.startDate ? tasksTask.startDate.toDate() : null,
            scheduledDate: tasksTask.scheduledDate ? tasksTask.scheduledDate.toDate() : null,
            dueDate: tasksTask.dueDate ? tasksTask.dueDate.toDate() : null,
            doneDate: tasksTask.doneDate ? tasksTask.doneDate.toDate() : null,
            cancelledDate: tasksTask.cancelledDate ? tasksTask.cancelledDate.toDate() : null,
            taskLocation: {
                path: tasksTask.taskLocation.path,
                lineNumber: tasksTask.taskLocation.lineNumber,
            },
            originalMarkdown: tasksTask.originalMarkdown,
            id: tasksTask.id || `${tasksTask.taskLocation.path}:${tasksTask.taskLocation.lineNumber}:${tasksTask.description}`,
        };
    }
}
