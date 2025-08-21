// Type declarations for vendor imports to avoid TypeScript compilation issues

declare module '../vendor/obsidian-tasks/src/Query/Query' {
  export class Query {
    constructor(source: string, queryFile?: any);
    queryLayout: any;
    filters: any[];
    groupers: any[];
    sorters: any[];
    limitTasksCount: number;
    execute(tasks: any[]): any;
  }
}

declare module '../vendor/obsidian-tasks/src/Query/QueryResult' {
  export class QueryResult {
    taskGroups: any;
    totalTasksCount: number;
    searchErrorMessage?: string;
    constructor(groups: any, totalTasksCount: number);
  }
}

declare module '../vendor/obsidian-tasks/src/Task/Task' {
  export class Task {
    description: string;
    status: any;
    priority: any;
    recurrence: any;
    createdDate: any;
    startDate: any;
    scheduledDate: any;
    dueDate: any;
    doneDate: any;
    cancelledDate: any;
    tags: string[];
    taskLocation: any;
  }
}

declare module '../vendor/obsidian-tasks/src/Scripting/QueryContext' {
  export function makeQueryContext(tasksFile: any): any;
}

declare module '../vendor/obsidian-tasks/src/Scripting/TasksFile' {
  export class TasksFile {
    constructor(path: string);
    path: string;
  }
}

declare module '../vendor/obsidian-tasks/src/Config/Settings' {
  export function getSettings(): any;
}

declare module '../vendor/obsidian-tasks/src/Statuses/StatusConfiguration' {
  export enum StatusType {
    TODO = 'TODO',
    IN_PROGRESS = 'IN_PROGRESS', 
    DONE = 'DONE',
    CANCELLED = 'CANCELLED',
    NON_TASK = 'NON_TASK',
    EMPTY = 'EMPTY'
  }
}

declare module '../../vendor/obsidian-tasks/src/Config/Settings' {
  export function getSettings(): any;
}