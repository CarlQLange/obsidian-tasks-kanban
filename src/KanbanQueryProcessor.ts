import { 
    App, 
    MarkdownPostProcessorContext
} from 'obsidian';

import { TasksIntegration } from './integration/TasksIntegration';
import { SimpleKanbanRenderer } from './SimpleKanbanRenderer';

/**
 * KanbanQueryProcessor handles the processing of tasks-kanban code blocks
 * using a simplified approach that works with the TasksIntegration API
 */
export class KanbanQueryProcessor {
    private app: App;
    private tasksIntegration: TasksIntegration;
    private source: string;
    private element: HTMLElement;
    private context: MarkdownPostProcessorContext;

    constructor(
        app: App, 
        tasksIntegration: TasksIntegration,
        source: string, 
        element: HTMLElement, 
        context: MarkdownPostProcessorContext
    ) {
        this.app = app;
        this.tasksIntegration = tasksIntegration;
        this.source = source;
        this.element = element;
        this.context = context;
    }

    async process() {
        if (!this.tasksIntegration.isTasksPluginAvailable()) {
            this.element.createDiv().innerHTML = '<pre>Tasks plugin not available</pre>';
            return;
        }

        this.app.workspace.onLayoutReady(() => {
            this.addSimpleKanbanRenderer();
        });
    }

    private addSimpleKanbanRenderer() {
        const kanbanRenderer = new SimpleKanbanRenderer(
            this.app,
            this.tasksIntegration,
            this.source,
            this.element,
            this.context
        );
        
        this.context.addChild(kanbanRenderer);
        kanbanRenderer.load();
    }
}

