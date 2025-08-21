import { 
    App, 
    MarkdownPostProcessorContext
} from 'obsidian';

import { TasksIntegration } from './integration/TasksIntegration';
import { SimpleKanbanRenderer } from './SimpleKanbanRenderer';

/**
 * Processes tasks-kanban code blocks and creates SimpleKanbanRenderer instances
 * Entry point for markdown code block processing
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

    /**
     * Main processing method called by Obsidian's markdown processor
     */
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

