# Obsidian Tasks Kanban

A kanban board plugin for Obsidian that extends the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) to provide inline kanban views within markdown files.

## Features

- **Inline Kanban Boards**: Render kanban boards directly in markdown using `tasks-kanban` code blocks
- **Tasks Plugin Integration**: Fully integrates with the Obsidian Tasks plugin for task management
- **Drag & Drop**: Move tasks between columns with automatic file updates
- **Query Syntax**: Supports Tasks plugin query syntax for filtering and grouping
- **Auto-refresh**: Automatically updates when tasks are modified
- **Multiple Grouping**: Group by status, path, priority, or folder
- **Responsive Design**: Works on desktop and mobile devices

## Requirements

This plugin requires the [Obsidian Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) to be installed and enabled.

## Usage

Create a kanban board by adding a `tasks-kanban` code block to any markdown file:

````markdown
```tasks-kanban
not done
group by status
```
````

### Advanced Usage

Filter by project path:
````markdown
```tasks-kanban
path includes Personal
not done
group by status
```
````

Group by priority:
````markdown
```tasks-kanban
not done
priority is high
group by priority
```
````

## Supported Query Syntax

The plugin supports Tasks plugin query syntax for filtering:

- `not done` / `done` - Filter by completion status
- `path includes <pattern>` - Filter by file path
- `description includes <pattern>` - Filter by task description
- `tag includes <pattern>` - Filter by tags
- `priority is <level>` - Filter by priority level
- `due before <date>` - Filter by due date
- `group by status/path/priority/folder` - Group tasks by different criteria

## Development

1. Clone this repo to `.obsidian/plugins/tasks-kanban/` in your vault
2. Install dependencies: `npm install`
3. Start development mode: `npm run dev`
4. Enable the plugin in Obsidian settings

### Build Commands

- `npm run dev` - Start development with file watching
- `npm run build` - Build production version
- `npm run lint` - Run ESLint and TypeScript checks

## Architecture

The plugin uses a code block processor approach:

- **Code Block Processing**: Processes `tasks-kanban` markdown blocks
- **Tasks Integration**: Interfaces with Tasks plugin via API
- **Inline Rendering**: Renders kanban boards directly in reading mode
- **File-based Updates**: Updates task status by modifying source files

### Key Components

- `SimpleKanbanRenderer` - Main kanban rendering logic
- `TasksIntegration` - Interface layer with Tasks plugin
- `SimpleQueryParser` - Query syntax parsing
- `KanbanQueryProcessor` - Code block processing entry point

## Manual Installation

1. Download the latest release files: `main.js`, `styles.css`, `manifest.json`
2. Create folder `VaultFolder/.obsidian/plugins/tasks-kanban/`
3. Copy the files into the folder
4. Reload Obsidian and enable the plugin

## License

MIT License - see LICENSE file for details.