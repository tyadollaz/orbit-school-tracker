# Orbit School & Project Tracker

Orbit is a private, local-first task tracker for managing school modules and
personal projects in one place. It combines a Kanban board, deadline list, and
monthly calendar without requiring an account or remote database.

## What you can do

- Organise work into school modules and independent projects.
- Remove modules or projects when they are no longer needed.
- Move tasks through **To Do**, **Doing**, **Blocked**, and **Done**.
- Add due dates, priorities, notes, subtasks, and task dependencies.
- Review deadlines in a chronological upcoming list.
- See dated tasks on a monthly calendar.
- Create daily, weekly, or monthly recurring tasks.
- Search tasks across the current workspace.
- Export and import JSON backups.
- Receive browser notifications for deadlines while Orbit is open.

## How Orbit works

The sidebar separates school modules from personal projects. Select a workspace
to focus on its tasks, or choose **View all work** for a combined view.

Orbit provides three ways to review the same tasks:

| View         | Best for                                                   |
| ------------ | ---------------------------------------------------------- |
| **Board**    | Planning work by status and moving tasks between stages    |
| **List**     | Reviewing upcoming and overdue deadlines in date order     |
| **Calendar** | Understanding how deadlines are distributed across a month |

Click a task to edit its details. On desktop, tasks can also be dragged between
board columns.

Use **Remove** beside a module or project in the sidebar to delete it. On mobile,
choose the workspace from the picker and tap **Remove**. Orbit shows the number
of affected tasks and asks for confirmation before removing the workspace and
its tasks.

## Data, privacy, and backups

Orbit stores its data in the browser using IndexedDB. Your tasks:

- remain available after refreshing or restarting the browser;
- stay on the current device and browser profile;
- are not uploaded or synchronised between devices;
- are deleted if you clear the site's browser data.

Use the download arrow in the top bar to export a JSON backup. Use the upload
arrow to restore a previously exported backup. Export regularly if the task
data is important or if you use Orbit from a temporary browser profile.

## Recurring tasks and notifications

Recurring occurrences are created when Orbit opens. If the app remains closed
past several occurrences, Orbit catches up the missed dates the next time it
loads, up to its built-in safety limit.

Deadline notifications are best-effort browser notifications. They require
permission and only run while Orbit is open. A static host such as GitHub Pages
cannot deliver scheduled notifications after the page has been closed.

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open the local URL printed in the terminal. Stop the server with `Ctrl+C`.

To test a production build locally:

```bash
npm run build
npm run start
```

## Project commands

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the Vite/Vinext development server       |
| `npm run build`        | Create the production worker build             |
| `npm run start`        | Serve the production worker build              |
| `npm test`             | Build and run data, auth, and worker tests     |
| `npm run lint`         | Check the source with ESLint                   |
| `npm run format`       | Format source and documentation                |
| `npm run format:check` | Verify formatting without changing files       |
| `npm run build:github` | Create a Next.js static build for GitHub Pages |
| `npm run db:generate`  | Generate optional Drizzle migrations           |

## Deploy to GitHub Pages

The included **Deploy Orbit to GitHub Pages** workflow builds and publishes the
app whenever `main` is updated. To enable it:

1. Push this repository to GitHub.
2. Open **Settings → Pages** in the repository.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`, or run the workflow manually from the **Actions** tab.

The configuration supports both account sites (`name.github.io`) and project
sites (`name.github.io/repository`). During GitHub Actions builds, Next.js
automatically enables static export and uses the repository name as the base
path for project sites.

Because all application data lives in each visitor's browser, deploying a new
version does not copy, merge, or synchronise task data between devices.

## Technology

Orbit is built with React, Next.js, TypeScript, Vite/Vinext, Tailwind CSS, and a
Cloudflare Worker-compatible production entry point. The task tracker itself is
local-first and does not require the optional Drizzle database scaffolding.
