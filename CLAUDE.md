# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- Creates and manages KanbanRenderer instances
- Bridges between Obsidian's markdown processor and kanban renderer

#### 3. KanbanRenderer (`src/KanbanRenderer.ts`)
- **Core kanban implementation** extending MarkdownRenderChild
- Renders kanban boards with columns, cards, and drag-drop functionality
- Handles task updates, auto-refresh, and user interactions
- **Key Methods:**
  - `render()`: Main rendering logic
  - `setupCardDragHandlers()`: HTML5 drag & drop implementation
  - `updateTaskStatus()`: Updates task status in files via TasksIntegration

#### 4. TasksQueryProcessor (`src/TasksQueryProcessor.ts`)
- Processes queries using the actual Tasks plugin Query class
- Provides access to their full query language including placeholders, complex filters, etc.
- Supports single and dual grouping (swim lanes)
- Converts Tasks plugin Task objects to our Task interface

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
tasks-kanban code block → KanbanQueryProcessor → KanbanRenderer → TasksQueryProcessor → TasksIntegration → Tasks Plugin Cache
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

- **Development**: `npm run dev` (watch mode with esbuild)
- **Build**: `npm run build` (production build)
- **Build with checks**: `npm run build-with-check` (TypeScript check + production build)  
- **Lint**: `npm run lint` (ESLint + TypeScript check, auto-fixes issues)
- **Version bump**: `npm run version` (updates manifest.json and versions.json)

**Note**: There are no test scripts - testing is done manually by loading the plugin in Obsidian.

## Usage Examples & Query Syntax

### Basic Kanban (Recommended)
```markdown
\```tasks-kanban
not done  
group by function task.status.typeGroupText
\```
```

**Important**: Use `group by function task.status.typeGroupText` for proper custom status support, not `group by status`.

### Swim Lanes (Dual Grouping)
```markdown
\```tasks-kanban
path includes {{query.file.path}}
group by function task.file.property('project')
group by function task.status.typeGroupText  
\```
```

First `group by` creates horizontal swim lanes, second creates columns within each lane.

### Supported Query Features
- **Filters**: `not done`, `path includes <pattern>`, `description includes <pattern>`, `tag includes <pattern>`, `priority is <level>`, `due before <date>`
- **Placeholders**: `{{query.file.path}}` for current file path
- **Grouping**: `group by function task.status.typeGroupText` (recommended), `group by path`, `group by priority`, `group by folder`
- **Custom Properties**: `group by function task.file.property('project')` for frontmatter properties

## File Structure

```
src/
├── main.ts                          # Main plugin class
├── KanbanQueryProcessor.ts          # Code block processor
├── KanbanRenderer.ts                # Kanban board renderer (CORE)
├── TasksQueryProcessor.ts           # Tasks query processor using Tasks plugin Query class
├── TasksKanbanSettings.ts           # Settings interface and defaults
├── TasksKanbanSettingTab.ts         # Settings UI
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
- **Collapsible**: Click column/lane headers to collapse with dot representation
- **Responsive**: Mobile-friendly column stacking  
- **Theming**: Dark/light theme support
- **Animations**: Smooth transitions for collapse/expand, hover effects, drag states

## Dependencies & Requirements

- **Required**: Obsidian Tasks plugin (`manifest.json:10`)
- **Dev Dependencies**: TypeScript, esbuild, ESLint, Svelte tooling
- **Obsidian Version**: Minimum 0.15.0

## Installation for Development

1. Clone to `.obsidian/plugins/tasks-kanban/`
2. `npm install`
3. `npm run dev` (watch mode)
4. Enable "Tasks Kanban" in Community Plugins settings

## Key Features

### Collapsible Columns & Lanes
- **Click headers** to collapse columns or swim lanes
- **Individual dots**: Shows one dot per task instead of numbers
- **Grid layout**: Dots wrap naturally from top-left (e.g., `○○○○` then `○○` for 6 tasks)
- **Overflow handling**: Shows `+X` for more than 10 tasks
- **Persistent state**: Collapse settings persist across refreshes
- **Works in both**: Regular kanban columns and swim lane views

### Loading State
- **First render**: Shows 800ms loading spinner to prevent empty task lists
- **Subsequent renders**: Immediate updates without spinner

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

## Testing & Development Notes

### Manual Testing Required
- **No automated tests** - plugin testing requires live Obsidian environment
- **Test drag & drop** with various task configurations and status types
- **Verify query compatibility** with Tasks plugin syntax
- **Check auto-refresh** when tasks are modified in files
- **Test collapsible features** in both regular and swim lane views
- **Mobile/responsive testing** on smaller screens

### Vendor Dependencies
- **Runtime dependencies** in `package.json` are needed by the `vendor/obsidian-tasks` submodule
- **Don't remove dependencies** even if they appear unused in main source code
- **Vendor submodule** provides access to Tasks plugin internals without full source integration

## Success Metrics

✅ **Functional Requirements Met:**
- Inline kanban rendering in markdown files
- Tasks plugin query syntax support
- Working drag & drop with real file updates  
- Auto-refresh on changes
- Multiple grouping strategies (status, path, priority, folder)

This implementation successfully provides a kanban view for Tasks plugin without requiring workspace integration or Tasks plugin source code dependencies.