# Obsidian Tasks Kanban

> **⚠️ Disclaimer**: This was totally vibe coded. I'd never written an Obsidian plugin before and I still haven't. I disavow any responsibility for this plugin - it works for me, if it works for you that's great but it's fully AI-generated so be careful with your beloved tasks.

A kanban board plugin for Obsidian that extends the [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) to provide inline kanban views within markdown files.

## Features

- **Inline Kanban Boards**: Render kanban boards directly in markdown using `tasks-kanban` code blocks
- **Drag & Drop**: Move tasks between columns with automatic file updates
- **Swim Lanes**: Support for dual grouping (e.g., group by project, then by status)
- **Custom Statuses**: Full support for Tasks plugin custom statuses
- **Query Syntax**: Supports Tasks plugin query syntax including placeholders
- **Task Editing**: Click-to-edit tasks with modal interface

## Requirements

This plugin requires the [Obsidian Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) to be installed and enabled.

## Usage

### Basic Kanban Board

Create a kanban board by adding a `tasks-kanban` code block to any markdown file:

````markdown
```tasks-kanban
not done
group by function task.status.typeGroupText
```
````

**Note**: The preferred grouping method is `group by function task.status.typeGroupText` which properly handles all status types including custom statuses.

### Swim Lanes (Dual Grouping)

Create swim lanes by using two group statements - the first creates horizontal swim lanes, the second creates columns within each swim lane:

````markdown
```tasks-kanban
path includes {{query.file.path}}
group by function task.file.property('project')
group by function task.status.typeGroupText
```
````

This creates swim lanes by project with status columns in each lane.

### More Examples

**Filter by current file path:**
````markdown
```tasks-kanban
path includes {{query.file.path}}
not done
group by function task.status.typeGroupText
```
````

**Group by priority:**
````markdown
```tasks-kanban
not done
priority is high
group by priority
```
````

**Custom project swim lanes:**
````markdown
```tasks-kanban
not done
group by function task.file.property('project')
group by status
```
````

## Supported Query Syntax

The plugin supports the **complete Tasks plugin query syntax** including:

- `not done` / `done` - Filter by completion status
- `path includes <pattern>` - Filter by file path  
- `description includes <pattern>` - Filter by task description
- `tag includes <pattern>` - Filter by tags
- `priority is <level>` - Filter by priority level
- `due before <date>` - Filter by due date
- `{{query.file.path}}` - Current file path placeholder

### Grouping
- `group by function task.status.typeGroupText` - **Recommended**: Group by status with custom status support
- `group by path` - Group by file path
- `group by priority` - Group by priority level
- `group by folder` - Group by containing folder
- `group by function task.file.property('project')` - Group by frontmatter property

Use two `group by` statements for swim lanes (first = horizontal lanes, second = columns).

## Development

1. Clone this repo to `.obsidian/plugins/tasks-kanban/` in your vault
2. Install dependencies: `npm install`
3. Start development mode: `npm run dev`
4. Enable the plugin in Obsidian settings

Build commands: `npm run dev`, `npm run build`, `npm run lint`

## Manual Installation

1. Download the latest release files: `main.js`, `styles.css`, `manifest.json`
2. Create folder `VaultFolder/.obsidian/plugins/tasks-kanban/`
3. Copy the files into the folder
4. Reload Obsidian and enable the plugin

## License

MIT License - see LICENSE file for details.