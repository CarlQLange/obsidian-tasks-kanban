/**
 * Settings interface for Tasks Kanban plugin
 * Controls which metadata elements are displayed on task cards
 */
export interface TasksKanbanSettings {
    // Display options for task metadata
    display: {
        tags: boolean;
        priority: boolean;
        dueDate: boolean;
        createdDate: boolean;
        startDate: boolean;
        scheduledDate: boolean;
        doneDate: boolean;
        taskPath: boolean;
        projectInfo: boolean; // derived from path
    };
    
    // Display format options
    format: {
        dateFormat: 'short' | 'medium' | 'long';
        showDateLabels: boolean;
        compactTags: boolean;
        priorityStyle: 'text' | 'emoji' | 'color';
    };
    
    // Project display configuration
    project: {
        source: 'frontmatter' | 'path' | 'both'; // both tries frontmatter first, falls back to path
        frontmatterKey: string; // which frontmatter property to read (default: 'project')
        pathSegment: number; // which path segment to use (0 = first folder, -1 = last folder, etc.)
        fallbackToPath: boolean; // if frontmatter fails, fall back to path segment
    };
}

/**
 * Default settings for the plugin
 */
export const DEFAULT_SETTINGS: TasksKanbanSettings = {
    display: {
        tags: true,
        priority: false,
        dueDate: true,
        createdDate: false,
        startDate: false,
        scheduledDate: false,
        doneDate: false,
        taskPath: false,
        projectInfo: false,
    },
    format: {
        dateFormat: 'short',
        showDateLabels: true,
        compactTags: false,
        priorityStyle: 'emoji',
    },
    project: {
        source: 'both',
        frontmatterKey: 'project',
        pathSegment: 0,
        fallbackToPath: true,
    },
};

/**
 * Priority mapping for display purposes
 */
export const PRIORITY_DISPLAY = {
    'High': { emoji: '🔴', text: 'High', color: '#ff4757' },
    'Medium': { emoji: '🟡', text: 'Med', color: '#ffa502' },
    'Low': { emoji: '🔵', text: 'Low', color: '#3742fa' },
    'None': { emoji: '', text: '', color: '' },
    // Additional possible values from Tasks plugin
    '1': { emoji: '🔵', text: 'Low', color: '#3742fa' },
    '2': { emoji: '🟡', text: 'Med', color: '#ffa502' },
    '3': { emoji: '🔴', text: 'High', color: '#ff4757' },
    'low': { emoji: '🔵', text: 'Low', color: '#3742fa' },
    'medium': { emoji: '🟡', text: 'Med', color: '#ffa502' },
    'high': { emoji: '🔴', text: 'High', color: '#ff4757' },
    'normal': { emoji: '🟡', text: 'Med', color: '#ffa502' }
} as const;