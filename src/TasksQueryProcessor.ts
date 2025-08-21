import { App } from 'obsidian';
import { Query } from '../vendor/obsidian-tasks/src/Query/Query';
import { QueryResult } from '../vendor/obsidian-tasks/src/Query/QueryResult';
import { Task as TasksTask } from '../vendor/obsidian-tasks/src/Task/Task';
import { TasksIntegration, Task } from './integration/TasksIntegration';
import { makeQueryContext } from '../vendor/obsidian-tasks/src/Scripting/QueryContext';
import { TasksFile } from '../vendor/obsidian-tasks/src/Scripting/TasksFile';

/**
 * Processes queries using the actual Tasks plugin Query class
 * Provides access to their full query language including placeholders, complex filters, etc.
 */
export class TasksQueryProcessor {
    private app: App;
    private tasksIntegration: TasksIntegration;

    constructor(app: App, tasksIntegration: TasksIntegration) {
        this.app = app;
        this.tasksIntegration = tasksIntegration;
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
     */
    private convertQueryResultToGroupedTasks(queryResult: QueryResult): { [key: string]: Task[] } {
        const groupedTasks: { [key: string]: Task[] } = {};
        
        for (const taskGroup of queryResult.taskGroups.groups) {
            // Use the most specific group name (last in the hierarchy)
            const groupName = taskGroup.groups[taskGroup.groups.length - 1] || 'Ungrouped';
            
            // Convert Tasks plugin Task objects to our Task interface
            const convertedTasks = taskGroup.tasks.map(tasksTask => this.convertTasksTaskToTask(tasksTask));
            
            groupedTasks[groupName] = convertedTasks;
        }
        
        return groupedTasks;
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