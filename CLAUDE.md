# Obsidian Tasks Kanban Plugin

## Project Overview

This plugin extends the [Obsidian Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) to provide inline kanban board views within markdown files. Instead of creating separate workspace views, it processes `tasks-kanban` code blocks and renders them as kanban boards in reading mode.

## Architecture

### Core Implementation Strategy

The plugin uses a **code block processor approach** rather than ItemView/workspace integration:

- **Code Block**: `tasks-kanban` markdown code blocks are processed in reading mode
- **Inline Rendering**: Kanban boards appear directly within markdown files
- **Query Syntax**: Supports Tasks plugin query syntax for filtering and grouping
- **Live Updates**: Automatically refreshes when tasks are modified

### Key Components

#### 1. Main Plugin (`main.ts`)
- Registers `tasks-kanban` markdown code block processor
- Initializes TasksIntegration to interface with Tasks plugin
- Entry point: `registerMarkdownCodeBlockProcessor('tasks-kanban', ...)`

#### 2. KanbanQueryProcessor (`src/KanbanQueryProcessor.ts`)
- Handles processing of `tasks-kanban` code blocks
- Creates and manages SimpleKanbanRenderer instances
- Bridges between Obsidian's markdown processor and kanban renderer

#### 3. SimpleKanbanRenderer (`src/SimpleKanbanRenderer.ts`)
- **Core kanban implementation** extending MarkdownRenderChild
- Renders kanban boards with columns, cards, and drag-drop functionality
- Handles task updates, auto-refresh, and user interactions
- **Key Methods:**
  - `render()`: Main rendering logic
  - `groupTasks()`: Groups tasks by status/path/priority/folder
  - `setupCardDragHandlers()`: HTML5 drag & drop implementation
  - `updateTaskStatus()`: Updates task status in files via TasksIntegration

#### 4. SimpleQueryParser (`src/SimpleQueryParser.ts`)
- Implements Tasks plugin query syntax parsing
- **Supported Filters:**
  - `not done` / `done`
  - `path includes <pattern>`
  - `description includes <pattern>`
  - `tag includes <pattern>`
  - `priority is <level>`
  - `due before <date>`
  - `status.name includes <pattern>`
- **Grouping:** `group by status/path/priority/folder`

#### 5. TasksIntegration (`src/integration/TasksIntegration.ts`)
- **Critical integration layer** with Tasks plugin
- Accesses Tasks plugin via `app.plugins.plugins['obsidian-tasks-plugin']`
- **Key Methods:**
  - `getAllTasks()`: Retrieves all tasks from Tasks plugin cache
  - `updateTaskStatus()`: **Core drag-drop functionality** - updates task status in files
  - `groupTasksByStatus()`: Default status-based grouping
- **Task Status Mapping:**
  - TODO: `' '` (space)
  - IN_PROGRESS: `'/'`
  - DONE: `'x'`
  - CANCELLED: `'-'`

### Critical Implementation Details

#### Drag & Drop Architecture
The drag & drop system is the most complex part:

1. **Task Identification**: Uses unique ID format `${path}:${lineNumber}:${description}`
2. **Drag Data**: Stores task path, line number, description, and original column
3. **File Updates**: `updateTaskStatus()` in TasksIntegration searches files by task description rather than line numbers (crucial for reliability)
4. **Auto-refresh**: Uses file change events to update kanban boards automatically

#### Query Processing Flow
```
tasks-kanban code block → KanbanQueryProcessor → SimpleKanbanRenderer → SimpleQueryParser → TasksIntegration → Tasks Plugin Cache
```

#### Status Update Flow
```
Drag & Drop → updateTaskStatus() → File Search by Description → Regex Replace → File Write → Auto-refresh
```

## Development Workflow

### Feature Branch Strategy
Now that we have a solid POC, **all new work should be done on feature branches** rather than directly on master.

**Branch Naming Convention:**
- `feature/short-description` for new features
- `fix/short-description` for bug fixes  
- `refactor/short-description` for code improvements

**Workflow:**
1. Create feature branch: `git checkout -b feature/new-functionality`
2. Make changes and commit regularly
3. Test thoroughly before merging
4. Create PR/merge back to master when complete

### Development Commands

Based on `package.json:6-12`:

- **Development**: `npm run dev` (watch mode with esbuild)
- **Build**: `npm run build` (TypeScript check + production build)
- **Lint**: `npm run lint` (ESLint + TypeScript + Svelte check)
- **Test**: `npm test` / `npm run test:dev`

## Usage Examples

### Basic Kanban
```markdown
\```tasks-kanban
not done
group by status
\```
```

### Filtered Project Kanban  
```markdown
\```tasks-kanban
path includes Personal
not done
group by status
\```
```

### Priority-based Kanban
```markdown
\```tasks-kanban
not done
priority is high
group by priority
\```
```

## File Structure

```
src/
├── main.ts                          # Main plugin class
├── KanbanQueryProcessor.ts          # Code block processor
├── SimpleKanbanRenderer.ts          # Kanban board renderer (CORE)
├── SimpleQueryParser.ts             # Tasks query syntax parser
└── integration/
    └── TasksIntegration.ts         # Tasks plugin integration (CRITICAL)

styles.css                          # Complete kanban styling
manifest.json                       # Plugin metadata
```

## Styling System

All styling is in `styles.css` using Obsidian CSS variables:

- **Board**: `.kanban-board` - flexbox container
- **Columns**: `.kanban-column` - individual status/group columns  
- **Cards**: `.kanban-card` - draggable task cards
- **Responsive**: Mobile-friendly column stacking
- **Theming**: Dark/light theme support
- **Animations**: Hover effects, drag states, fade-in

## Dependencies & Requirements

- **Required**: Obsidian Tasks plugin (`manifest.json:10`)
- **Dev Dependencies**: TypeScript, esbuild, ESLint, Svelte tooling
- **Obsidian Version**: Minimum 0.15.0

## Installation for Development

1. Clone to `.obsidian/plugins/tasks-kanban/`
2. `npm install`
3. `npm run dev` (watch mode)
4. Enable "Tasks Kanban" in Community Plugins settings

## Known Issues & Solutions

### Drag & Drop Issues (RESOLVED)
- **Problem**: Tasks not updating when dragged
- **Root Cause**: Line number mismatches between plugin and actual file content
- **Solution**: Search by task description instead of line numbers (`TasksIntegration.ts:183-197`)

### Query Parsing (RESOLVED)  
- **Problem**: Task filters not working
- **Solution**: Implemented comprehensive SimpleQueryParser supporting Tasks syntax

### CSS Loading (RESOLVED)
- **Problem**: Styles not loading
- **Solution**: Use `styles.css` instead of imported CSS (Obsidian standard)

## Architecture Evolution

### Original Plan (Abandoned)
- ItemView workspace integration
- Separate kanban view panes
- Complex Tasks plugin source dependencies

### Final Implementation (Current)
- Inline code block processing
- `tasks-kanban` markdown syntax
- Simplified TasksIntegration API
- Direct file-based task updates

## Key Technical Insights

1. **File-based Updates**: The most reliable way to update tasks is by searching file content by description, not line numbers
2. **Auto-refresh**: File change events automatically refresh kanban boards
3. **Query Compatibility**: Supporting Tasks plugin syntax without full source integration requires careful parser implementation
4. **Drag Identification**: Unique task IDs must include path + line + description for reliability
5. **CSS Variables**: Using Obsidian's CSS custom properties ensures theme compatibility

## Testing Strategy

- Manual testing with various task configurations
- Test drag & drop across different groupings (status works, others show appropriate messages)
- Verify query syntax compatibility with Tasks plugin
- Test auto-refresh on file modifications
- Mobile/responsive testing

## Success Metrics

✅ **Functional Requirements Met:**
- Inline kanban rendering in markdown files
- Tasks plugin query syntax support
- Working drag & drop with real file updates  
- Auto-refresh on changes
- Multiple grouping strategies (status, path, priority, folder)

This implementation successfully provides a kanban view for Tasks plugin without requiring workspace integration or Tasks plugin source code dependencies.