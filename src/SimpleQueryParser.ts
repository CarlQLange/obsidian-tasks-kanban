import { Task } from './integration/TasksIntegration';

/**
 * SimpleQueryParser implements basic Tasks plugin query syntax parsing
 * for common filtering operations used with kanban boards
 */
export class SimpleQueryParser {
    private source: string;
    private lines: string[];

    constructor(source: string) {
        this.source = source.trim();
        this.lines = this.source.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }

    /**
     * Apply filters from the query source to the task list
     */
    filterTasks(tasks: Task[]): Task[] {
        let filteredTasks = [...tasks];

        for (const line of this.lines) {
            filteredTasks = this.applyFilter(filteredTasks, line);
        }

        return filteredTasks;
    }

    private applyFilter(tasks: Task[], line: string): Task[] {
        const lowerLine = line.toLowerCase();

        // Skip group by and other layout instructions
        if (lowerLine.startsWith('group by') || 
            lowerLine.startsWith('sort by') || 
            lowerLine.startsWith('limit') ||
            lowerLine.startsWith('#')) {
            return tasks;
        }

        // Handle "not done" filter
        if (lowerLine === 'not done') {
            return tasks.filter(task => task.status.symbol !== 'x');
        }

        // Handle "done" filter
        if (lowerLine === 'done') {
            return tasks.filter(task => task.status.symbol === 'x');
        }

        // Handle path filters
        if (lowerLine.startsWith('path includes ')) {
            const pathPattern = line.substring('path includes '.length).trim();
            return tasks.filter(task => 
                task.taskLocation.path.toLowerCase().includes(pathPattern.toLowerCase())
            );
        }

        if (lowerLine.startsWith('path does not include ')) {
            const pathPattern = line.substring('path does not include '.length).trim();
            return tasks.filter(task => 
                !task.taskLocation.path.toLowerCase().includes(pathPattern.toLowerCase())
            );
        }

        // Handle description filters
        if (lowerLine.startsWith('description includes ')) {
            const descPattern = line.substring('description includes '.length).trim();
            return tasks.filter(task => 
                task.description.toLowerCase().includes(descPattern.toLowerCase())
            );
        }

        if (lowerLine.startsWith('description does not include ')) {
            const descPattern = line.substring('description does not include '.length).trim();
            return tasks.filter(task => 
                !task.description.toLowerCase().includes(descPattern.toLowerCase())
            );
        }

        // Handle tag filters
        if (lowerLine.startsWith('tag includes ')) {
            const tagPattern = line.substring('tag includes '.length).trim();
            return tasks.filter(task => 
                task.tags.some(tag => tag.toLowerCase().includes(tagPattern.toLowerCase()))
            );
        }

        if (lowerLine.startsWith('tag does not include ')) {
            const tagPattern = line.substring('tag does not include '.length).trim();
            return tasks.filter(task => 
                !task.tags.some(tag => tag.toLowerCase().includes(tagPattern.toLowerCase()))
            );
        }

        // Handle priority filters
        if (lowerLine.startsWith('priority is ')) {
            const priorityValue = line.substring('priority is '.length).trim().toLowerCase();
            return tasks.filter(task => {
                const taskPriority = this.mapPriorityToString(task.priority);
                return taskPriority.toLowerCase() === priorityValue;
            });
        }

        // Handle due date filters (basic)
        if (lowerLine.startsWith('due ')) {
            const dueDateFilter = line.substring('due '.length).trim().toLowerCase();
            if (dueDateFilter === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                return tasks.filter(task => {
                    if (!task.dueDate) return false;
                    const taskDue = new Date(task.dueDate);
                    taskDue.setHours(0, 0, 0, 0);
                    return taskDue.getTime() === today.getTime();
                });
            }
            
            if (dueDateFilter.startsWith('before ')) {
                const dateStr = dueDateFilter.substring('before '.length).trim();
                const targetDate = this.parseSimpleDate(dateStr);
                if (targetDate) {
                    return tasks.filter(task => {
                        if (!task.dueDate) return false;
                        return task.dueDate < targetDate;
                    });
                }
            }
        }

        // Handle status filters
        if (lowerLine.startsWith('status.name includes ')) {
            const statusPattern = line.substring('status.name includes '.length).trim().toLowerCase();
            return tasks.filter(task => 
                task.status.name.toLowerCase().includes(statusPattern)
            );
        }

        // If we don't recognize the filter, just return tasks unchanged
        // This allows for graceful degradation
        return tasks;
    }

    private mapPriorityToString(priority: string): string {
        switch (priority.toLowerCase()) {
            case 'highest': return 'highest';
            case 'high': return 'high';
            case 'medium': return 'medium';
            case 'low': return 'low';
            case 'lowest': return 'lowest';
            default: return 'none';
        }
    }

    private parseSimpleDate(dateStr: string): Date | null {
        const lowerDateStr = dateStr.toLowerCase();
        
        // Handle relative dates
        if (lowerDateStr === 'today') {
            return new Date();
        }
        
        if (lowerDateStr === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        
        if (lowerDateStr.startsWith('next ')) {
            const period = lowerDateStr.substring(5);
            const date = new Date();
            
            if (period === 'week') {
                date.setDate(date.getDate() + 7);
                return date;
            }
            
            if (period === 'month') {
                date.setMonth(date.getMonth() + 1);
                return date;
            }
        }
        
        // Try to parse as a regular date
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
        
        return null;
    }

    /**
     * Extract grouping information from the query
     */
    getGroupBy(): string | null {
        for (const line of this.lines) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.startsWith('group by ')) {
                const groupField = line.substring('group by '.length).trim().toLowerCase();
                return groupField;
            }
        }
        return null;
    }

    /**
     * Check if query specifies a particular grouping
     */
    isGroupedBy(field: string): boolean {
        const groupBy = this.getGroupBy();
        return groupBy === field.toLowerCase();
    }
}