"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  materializeRecurring,
  parseAppData,
  removeSpace,
  type AppData,
  type Recurrence,
  type Space,
  type SpaceType,
  type Status,
  type Subtask,
  type Task,
} from "./orbit-data";

type View = "board" | "upcoming" | "calendar";

const columns: { id: Status; label: string; dot: string }[] = [
  { id: "todo", label: "To Do", dot: "#6f7b8f" },
  { id: "doing", label: "Doing", dot: "#de8d42" },
  { id: "blocked", label: "Blocked", dot: "#d45e57" },
  { id: "done", label: "Done", dot: "#4f8f72" },
];

function dateOffset(days: number, time: string) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function fmtDate(v?: string) {
  if (!v) return "No date";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
function localInput(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function isOverdue(v?: string) {
  return Boolean(
    v && Number.isFinite(Date.parse(v)) && new Date(v) < new Date(),
  );
}

const initialData: AppData = {
  spaces: [
    {
      id: "all",
      name: "All work",
      type: "project",
      color: "#151922",
      code: "ALL",
    },
    {
      id: "bt4103",
      name: "Business Analytics Capstone",
      type: "module",
      color: "#7659a8",
      code: "BT4103",
    },
    {
      id: "is4228",
      name: "Information Technologies",
      type: "module",
      color: "#337fa0",
      code: "IS4228",
    },
    {
      id: "startup",
      name: "Startup",
      type: "project",
      color: "#cf7442",
      code: "BUILD",
    },
    {
      id: "personal",
      name: "Personal Systems",
      type: "project",
      color: "#4e8b69",
      code: "LIFE",
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Outline capstone problem statement",
      notes: "Turn research notes into a one-page framing.",
      status: "doing",
      spaceId: "bt4103",
      dueAt: dateOffset(1, "18:00"),
      priority: "high",
      dependencyIds: [],
      subtasks: [
        { id: "s1", title: "Define user", done: true },
        { id: "s2", title: "Write success metric", done: false },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "t2",
      title: "Read Week 3 case study",
      notes: "Capture five discussion points.",
      status: "todo",
      spaceId: "is4228",
      dueAt: dateOffset(2, "21:00"),
      priority: "medium",
      dependencyIds: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "t3",
      title: "Interview five target users",
      notes: "Use the current discovery script.",
      status: "blocked",
      spaceId: "startup",
      dueAt: dateOffset(5, "17:00"),
      priority: "high",
      dependencyIds: ["t4"],
      subtasks: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "t4",
      title: "Finalize interview script",
      notes: "Keep the interview under 25 minutes.",
      status: "todo",
      spaceId: "startup",
      dueAt: dateOffset(1, "12:00"),
      priority: "high",
      dependencyIds: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "t5",
      title: "Weekly planning review",
      notes: "Clear inbox, review deadlines and choose weekly outcomes.",
      status: "todo",
      spaceId: "personal",
      dueAt: dateOffset(6, "19:00"),
      priority: "medium",
      dependencyIds: [],
      subtasks: [],
      recurrence: {
        unit: "week",
        interval: 1,
        time: "19:00",
        nextAt: dateOffset(6, "19:00"),
      },
      createdAt: new Date().toISOString(),
    },
  ],
};

const DB_NAME = "orbit-tracker";
type LoadResult = { data: AppData; canPersist: boolean; warning?: string };
function loadData(): Promise<LoadResult> {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve({
        data: structuredClone(initialData),
        canPersist: false,
        warning: "Browser storage is unavailable. Changes will not persist.",
      });
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("state"))
        req.result.createObjectStore("state");
    };
    req.onerror = () =>
      resolve({
        data: structuredClone(initialData),
        canPersist: false,
        warning:
          "Orbit could not open browser storage. Changes will not persist.",
      });
    req.onsuccess = () => {
      const db = req.result;
      const get = db
        .transaction("state", "readonly")
        .objectStore("state")
        .get("app");
      get.onsuccess = () => {
        const isFresh = get.result === undefined;
        const parsed = isFresh
          ? structuredClone(initialData)
          : parseAppData(get.result);
        db.close();
        resolve(
          parsed
            ? { data: parsed, canPersist: true }
            : {
                data: structuredClone(initialData),
                canPersist: false,
                warning:
                  "Saved data was invalid, so Orbit loaded a fresh workspace. Your stored copy was not overwritten.",
              },
        );
      };
      get.onerror = () => {
        db.close();
        resolve({
          data: structuredClone(initialData),
          canPersist: false,
          warning:
            "Orbit could not read saved data. Your stored copy was not overwritten.",
        });
      };
    };
  });
}
function saveData(data: AppData): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("state"))
        req.result.createObjectStore("state");
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put(data, "app");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        const error = tx.error;
        db.close();
        reject(error);
      };
      tx.onabort = () => {
        const error = tx.error;
        db.close();
        reject(error);
      };
    };
  });
}

export default function Home() {
  const [data, setData] = useState<AppData>(initialData);
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [view, setView] = useState<View>("board");
  const [spaceId, setSpaceId] = useState("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"task" | "space" | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    loadData().then((loaded) => {
      if (!active) return;
      setData(materializeRecurring(loaded.data, new Date(), uid));
      setCanPersist(loaded.canPersist);
      if (loaded.warning) setNotice(loaded.warning);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !canPersist) return;
    void saveData(data).catch(() => {
      setCanPersist(false);
      setNotice(
        "Orbit could not save your latest changes. Export a backup before closing.",
      );
    });
  }, [data, ready, canPersist]);
  useEffect(() => {
    if (
      !ready ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const timers = data.tasks
      .filter((t) => t.dueAt && t.status !== "done")
      .map((t) => {
        const delay = new Date(t.dueAt!).getTime() - Date.now();
        if (delay <= 0 || delay > 2147483647) return undefined;
        return window.setTimeout(
          () =>
            new Notification(`Due now: ${t.title}`, {
              body:
                data.spaces.find((s) => s.id === t.spaceId)?.name || "Orbit",
            }),
          delay,
        );
      })
      .filter((timer): timer is number => timer !== undefined);
    return () => timers.forEach(window.clearTimeout);
  }, [data, ready]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.tasks.filter((t) => {
      const space = data.spaces.find((s) => s.id === t.spaceId);
      return (
        (spaceId === "all" || t.spaceId === spaceId) &&
        (!needle ||
          [t.title, t.notes, space?.name, space?.code].some((value) =>
            value?.toLowerCase().includes(needle),
          ))
      );
    });
  }, [data.tasks, data.spaces, spaceId, query]);
  const overdueCount = data.tasks.filter(
    (t) => t.status !== "done" && isOverdue(t.dueAt),
  ).length;
  const currentSpace =
    data.spaces.find((s) => s.id === spaceId) || data.spaces[0];
  const openTask = (t: Task) => {
    setEditing(t);
    setModal("task");
  };
  function updateTask(task: Task) {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? task : t)),
    }));
  }
  function moveTask(id: string, status: Status) {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  }
  function deleteTask(id: string) {
    if (
      !window.confirm(
        "Delete this task? This cannot be undone unless you have a backup.",
      )
    )
      return;
    setData((d) => ({
      ...d,
      tasks: d.tasks
        .filter((t) => t.id !== id)
        .map((t) => ({
          ...t,
          dependencyIds: t.dependencyIds.filter((x) => x !== id),
        })),
    }));
    setModal(null);
  }
  function deleteSpace(space: Space) {
    const taskCount = data.tasks.filter(
      (task) => task.spaceId === space.id,
    ).length;
    const taskSummary =
      taskCount === 0
        ? "It has no tasks."
        : `This will also permanently delete ${taskCount} ${taskCount === 1 ? "task" : "tasks"}.`;
    if (
      !window.confirm(
        `Remove “${space.name}”?\n\n${taskSummary}\n\nExport a backup first if you may need this data later.`,
      )
    )
      return;

    setData((current) => removeSpace(current, space.id));
    setSpaceId("all");
    setNotice(
      `Removed ${space.name}${taskCount ? ` and ${taskCount} ${taskCount === 1 ? "task" : "tasks"}` : ""}.`,
    );
  }
  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotice("Notifications are not supported in this browser.");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotice(
        p === "granted"
          ? "Notifications enabled while Orbit is open."
          : "Notification permission was not granted.",
      );
    } catch {
      setNotice("Orbit could not request notification permission.");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">O</span>
          <div>
            <strong>Orbit</strong>
            <small>School & projects</small>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Views">
          <button
            className={view === "board" ? "active" : ""}
            onClick={() => setView("board")}
          >
            <span>▦</span> Board
          </button>
          <button
            className={view === "upcoming" ? "active" : ""}
            onClick={() => setView("upcoming")}
          >
            <span>≡</span> Upcoming {overdueCount > 0 && <b>{overdueCount}</b>}
          </button>
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => setView("calendar")}
          >
            <span>□</span> Calendar
          </button>
        </nav>
        <SpaceLinks
          title="School modules"
          spaces={data.spaces.filter((s) => s.type === "module")}
          active={spaceId}
          tasks={data.tasks}
          onSelect={setSpaceId}
          onAdd={() => setModal("space")}
          onDelete={deleteSpace}
        />
        <SpaceLinks
          title="Projects"
          spaces={data.spaces.filter(
            (s) => s.type === "project" && s.id !== "all",
          )}
          active={spaceId}
          tasks={data.tasks}
          onSelect={setSpaceId}
          onAdd={() => setModal("space")}
          onDelete={deleteSpace}
        />
        <button
          type="button"
          className={`all-work ${spaceId === "all" ? "selected" : ""}`}
          onClick={() => setSpaceId("all")}
        >
          View all work <span>→</span>
        </button>
        <div
          className={`storage-note ${ready && !canPersist ? "storage-error" : ""}`}
        >
          <span>●</span>
          <div>
            <strong>
              {!ready
                ? "Checking browser storage"
                : canPersist
                  ? "Saved on this device"
                  : "Changes are not saving"}
            </strong>
            <small>
              {canPersist
                ? "Export backups from the top bar"
                : "Import a valid backup or export before closing"}
            </small>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">O</span>
            <strong>Orbit</strong>
          </div>
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search tasks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
            />
          </label>
          <div className="top-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="Enable notifications"
              title="Enable notifications"
              onClick={enableNotifications}
            >
              ♢
            </button>
            <BackupMenu
              data={data}
              onImport={(imported) => {
                setCanPersist(true);
                setData(imported);
                setNotice("Backup imported successfully.");
              }}
            />
            <button
              className="new-task"
              type="button"
              onClick={() => {
                setEditing(null);
                setModal("task");
              }}
            >
              + New task
            </button>
          </div>
        </header>
        {notice && (
          <div className="toast" role="status">
            <span>{notice}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        <div className="content">
          <div className="page-head">
            <div>
              <div className="mobile-space-controls">
                <select
                  className="mobile-space-picker"
                  aria-label="Choose workspace"
                  value={spaceId}
                  onChange={(event) => setSpaceId(event.target.value)}
                >
                  <option value="all">All work</option>
                  {data.spaces
                    .filter((space) => space.id !== "all")
                    .map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.code} · {space.name}
                      </option>
                    ))}
                </select>
                {spaceId !== "all" && (
                  <button
                    type="button"
                    className="mobile-delete-space"
                    onClick={() => deleteSpace(currentSpace)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p>
                {currentSpace.type === "module"
                  ? currentSpace.code
                  : "WORKSPACE"}
              </p>
              <h1>
                {spaceId === "all" ? "Everything in motion" : currentSpace.name}
              </h1>
              <span>
                {visible.filter((t) => t.status !== "done").length} open tasks ·{" "}
                {overdueCount} overdue across all work
              </span>
            </div>
          </div>
          {!ready ? (
            <div className="loading">Loading your workspace…</div>
          ) : view === "board" ? (
            <Board
              tasks={visible}
              spaces={data.spaces}
              onMove={moveTask}
              onOpen={openTask}
            />
          ) : view === "upcoming" ? (
            <Upcoming tasks={visible} spaces={data.spaces} onOpen={openTask} />
          ) : (
            <Calendar
              tasks={visible}
              spaces={data.spaces}
              month={month}
              setMonth={setMonth}
              onOpen={openTask}
            />
          )}
        </div>
      </section>
      {modal === "task" && (
        <TaskModal
          task={editing}
          spaces={data.spaces.filter((s) => s.id !== "all")}
          allTasks={data.tasks}
          defaultSpace={
            spaceId === "all"
              ? (data.spaces.find((s) => s.id !== "all")?.id ?? "")
              : spaceId
          }
          onClose={() => setModal(null)}
          onDelete={deleteTask}
          onSave={(task) => {
            if (editing) updateTask(task);
            else setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
            setModal(null);
          }}
        />
      )}
      {modal === "space" && (
        <SpaceModal
          onClose={() => setModal(null)}
          onSave={(space) => {
            setData((d) => ({ ...d, spaces: [...d.spaces, space] }));
            setSpaceId(space.id);
            setModal(null);
          }}
        />
      )}
    </main>
  );
}

function SpaceLinks({
  title,
  spaces,
  active,
  tasks,
  onSelect,
  onAdd,
  onDelete,
}: {
  title: string;
  spaces: Space[];
  active: string;
  tasks: Task[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (space: Space) => void;
}) {
  return (
    <div className="nav-section">
      <div className="section-label">
        <span>{title}</span>
        <button
          type="button"
          aria-label={`Add ${title.toLowerCase()}`}
          onClick={onAdd}
        >
          + Add
        </button>
      </div>
      {spaces.map((s) => {
        const selected = active === s.id;
        return (
          <div className={`space-row ${selected ? "selected" : ""}`} key={s.id}>
            <button
              type="button"
              className="space-link"
              onClick={() => onSelect(s.id)}
            >
              <i style={{ background: s.color }} />
              <span>{s.name}</span>
              <em>
                {
                  tasks.filter((t) => t.spaceId === s.id && t.status !== "done")
                    .length
                }
              </em>
            </button>
            <button
              type="button"
              className="space-delete"
              aria-label={`Remove ${s.name}`}
              title={`Remove ${s.name}`}
              onClick={() => onDelete(s)}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
function Board({
  tasks,
  spaces,
  onMove,
  onOpen,
}: {
  tasks: Task[];
  spaces: Space[];
  onMove: (id: string, s: Status) => void;
  onOpen: (t: Task) => void;
}) {
  return (
    <div className="kanban">
      {columns.map((col) => (
        <section
          className="column"
          aria-labelledby={`column-${col.id}`}
          key={col.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("task");
            if (id) onMove(id, col.id);
          }}
        >
          <header>
            <div id={`column-${col.id}`}>
              <i style={{ background: col.dot }} />
              {col.label}
              <span>{tasks.filter((t) => t.status === col.id).length}</span>
            </div>
          </header>
          <div className="card-stack">
            {tasks
              .filter((t) => t.status === col.id)
              .map((t) => (
                <TaskCard key={t.id} task={t} spaces={spaces} onOpen={onOpen} />
              ))}
            {tasks.filter((t) => t.status === col.id).length === 0 && (
              <div className="empty-column">Drop a task here</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
function TaskCard({
  task,
  spaces,
  onOpen,
}: {
  task: Task;
  spaces: Space[];
  onOpen: (t: Task) => void;
}) {
  const space = spaces.find((s) => s.id === task.spaceId);
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <article
      className={`task-card priority-${task.priority}`}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${task.title}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("task", task.id)}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
    >
      <div className="card-top">
        <span className="space-chip">
          <i style={{ background: space?.color }} />
          {space?.code}
        </span>
        <span aria-hidden="true">···</span>
      </div>
      <h3>{task.title}</h3>
      {task.notes && <p>{task.notes}</p>}
      <div className="card-meta">
        {task.dueAt && (
          <span
            className={
              isOverdue(task.dueAt) && task.status !== "done" ? "overdue" : ""
            }
          >
            ◷ {fmtDate(task.dueAt)}
          </span>
        )}
        {task.recurrence && (
          <span>
            ↻ Every{" "}
            {task.recurrence.interval > 1 ? task.recurrence.interval + " " : ""}
            {task.recurrence.unit}
          </span>
        )}
        {task.dependencyIds.length > 0 && (
          <span>◇ {task.dependencyIds.length} dep.</span>
        )}
        {task.subtasks.length > 0 && (
          <span>
            ☑ {done}/{task.subtasks.length}
          </span>
        )}
      </div>
    </article>
  );
}
function Upcoming({
  tasks,
  spaces,
  onOpen,
}: {
  tasks: Task[];
  spaces: Space[];
  onOpen: (t: Task) => void;
}) {
  const dated = [...tasks]
    .filter((t) => t.dueAt && t.status !== "done")
    .sort((a, b) => +new Date(a.dueAt!) - +new Date(b.dueAt!));
  const groups = new Map<string, Task[]>();
  dated.forEach((t) => {
    const key = new Date(t.dueAt!).toDateString();
    groups.set(key, [...(groups.get(key) || []), t]);
  });
  return (
    <div className="upcoming">
      <div className="upcoming-summary">
        <strong>{dated.length}</strong>
        <span>dated tasks ahead</span>
        <div>
          <b>{dated.filter((t) => isOverdue(t.dueAt)).length}</b> overdue
        </div>
      </div>
      {[...groups].map(([day, list]) => (
        <section key={day}>
          <h2>
            {new Date(day).toLocaleDateString("en-SG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          {list.map((t) => {
            const s = spaces.find((x) => x.id === t.spaceId);
            return (
              <button
                className="list-task"
                key={t.id}
                onClick={() => onOpen(t)}
              >
                <i style={{ background: s?.color }} />
                <span>
                  <strong>{t.title}</strong>
                  <small>{s?.name}</small>
                </span>
                <em className={isOverdue(t.dueAt) ? "overdue" : ""}>
                  {fmtDate(t.dueAt)}
                </em>
                <b>{columns.find((c) => c.id === t.status)?.label}</b>
              </button>
            );
          })}
        </section>
      ))}
      {dated.length === 0 && (
        <div className="empty-state">
          <strong>Your horizon is clear.</strong>
          <span>Add a due date to see a task here.</span>
        </div>
      )}
    </div>
  );
}
function Calendar({
  tasks,
  spaces,
  month,
  setMonth,
  onOpen,
}: {
  tasks: Task[];
  spaces: Space[];
  month: Date;
  setMonth: (d: Date) => void;
  onOpen: (t: Task) => void;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return (
    <div className="calendar-wrap">
      <div className="calendar-nav">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ←
        </button>
        <h2>
          {month.toLocaleDateString("en-SG", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          →
        </button>
      </div>
      <div className="calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => (
          <b className="weekday" key={x}>
            {x}
          </b>
        ))}
        {days.map((d) => {
          const dayTasks = tasks.filter(
            (t) =>
              t.dueAt && new Date(t.dueAt).toDateString() === d.toDateString(),
          );
          return (
            <div
              className={`calendar-day ${d.getMonth() !== month.getMonth() ? "muted" : ""} ${d.toDateString() === new Date().toDateString() ? "today" : ""}`}
              key={d.toISOString()}
            >
              <span>{d.getDate()}</span>
              {dayTasks.slice(0, 3).map((t) => {
                const s = spaces.find((x) => x.id === t.spaceId);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => onOpen(t)}
                    style={{ borderLeftColor: s?.color }}
                  >
                    {t.title}
                  </button>
                );
              })}
              {dayTasks.length > 3 && (
                <small className="calendar-more">
                  +{dayTasks.length - 3} more
                </small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskModal({
  task,
  spaces,
  allTasks,
  defaultSpace,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  spaces: Space[];
  allTasks: Task[];
  defaultSpace: string;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(task?.title || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [status, setStatus] = useState<Status>(task?.status || "todo");
  const [sid, setSid] = useState(task?.spaceId || defaultSpace);
  const [due, setDue] = useState(localInput(task?.dueAt));
  const [priority, setPriority] = useState<Task["priority"]>(
    task?.priority || "medium",
  );
  const [deps, setDeps] = useState<string[]>(task?.dependencyIds || []);
  const [subs, setSubs] = useState<Subtask[]>(task?.subtasks || []);
  const [recurring, setRecurring] = useState(!!task?.recurrence);
  const [unit, setUnit] = useState<Recurrence["unit"]>(
    task?.recurrence?.unit || "week",
  );
  const [interval, setInterval] = useState(task?.recurrence?.interval || 1);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !sid) return;
    const dueIso = due ? new Date(due).toISOString() : undefined;
    const safeInterval = Number.isFinite(interval)
      ? Math.max(1, Math.floor(interval))
      : 1;
    const cleanSubtasks = subs
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title);
    onSave({
      id: task?.id || uid("task"),
      title: title.trim(),
      notes: notes.trim(),
      status,
      spaceId: sid,
      dueAt: dueIso,
      priority,
      dependencyIds: deps,
      subtasks: cleanSubtasks,
      createdAt: task?.createdAt || new Date().toISOString(),
      generatedFrom: task?.generatedFrom,
      recurrence:
        recurring && dueIso
          ? {
              unit,
              interval: safeInterval,
              time: due.slice(11, 16),
              nextAt: dueIso,
              anchorDay:
                unit === "month" ? new Date(dueIso).getDate() : undefined,
            }
          : undefined,
    });
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        onSubmit={submit}
      >
        <header>
          <div>
            <p>{task ? "EDIT TASK" : "NEW TASK"}</p>
            <h2 id="task-modal-title">
              {task ? "Shape the work" : "Capture what matters"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close task editor"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <label className="full">
          <span>Task title</span>
          <input
            required
            maxLength={500}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to happen?"
          />
        </label>
        <label className="full">
          <span>Notes</span>
          <textarea
            maxLength={20000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context, outcome or useful links…"
          />
        </label>
        <div className="form-grid">
          <label>
            <span>Workspace</span>
            <select
              required
              value={sid}
              onChange={(e) => setSid(e.target.value)}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {columns.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Due date & time</span>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            <span>Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            disabled={!due}
          />
          <span>
            <strong>Recurring task</strong>
            <small>Creates the next occurrence when Orbit opens</small>
          </span>
        </label>
        {recurring && due && (
          <div className="recurrence-row">
            <span>Repeat every</span>
            <input
              aria-label="Recurrence interval"
              type="number"
              min="1"
              max="10000"
              value={interval}
              onChange={(e) => setInterval(e.target.valueAsNumber)}
            />
            <select
              aria-label="Recurrence unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as Recurrence["unit"])}
            >
              <option value="day">day(s)</option>
              <option value="week">week(s)</option>
              <option value="month">month(s)</option>
            </select>
          </div>
        )}
        <div className="field-group">
          <span>
            Dependencies <small>Informational only</small>
          </span>
          <div className="chip-list">
            {allTasks
              .filter((t) => t.id !== task?.id && t.status !== "done")
              .map((t) => (
                <button
                  type="button"
                  aria-pressed={deps.includes(t.id)}
                  className={deps.includes(t.id) ? "picked" : ""}
                  key={t.id}
                  onClick={() =>
                    setDeps((x) =>
                      x.includes(t.id)
                        ? x.filter((i) => i !== t.id)
                        : [...x, t.id],
                    )
                  }
                >
                  {t.title}
                </button>
              ))}
          </div>
        </div>
        <div className="field-group">
          <span>Subtasks</span>
          {subs.map((s) => (
            <div className="subtask-edit" key={s.id}>
              <input
                aria-label={`Mark ${s.title || "subtask"} complete`}
                type="checkbox"
                checked={s.done}
                onChange={() =>
                  setSubs((x) =>
                    x.map((v) => (v.id === s.id ? { ...v, done: !v.done } : v)),
                  )
                }
              />
              <input
                aria-label="Subtask title"
                maxLength={500}
                value={s.title}
                onChange={(e) =>
                  setSubs((x) =>
                    x.map((v) =>
                      v.id === s.id ? { ...v, title: e.target.value } : v,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label={`Remove ${s.title || "subtask"}`}
                onClick={() => setSubs((x) => x.filter((v) => v.id !== s.id))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="add-subtask"
            type="button"
            onClick={() =>
              setSubs((x) => [...x, { id: uid("sub"), title: "", done: false }])
            }
          >
            + Add subtask
          </button>
        </div>
        <footer>
          {task ? (
            <button
              type="button"
              className="delete"
              onClick={() => onDelete(task.id)}
            >
              Delete task
            </button>
          ) : (
            <span />
          )}
          <div>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="save">
              {task ? "Save changes" : "Create task"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
function SpaceModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (s: Space) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<SpaceType>("module");
  const [color, setColor] = useState("#7659a8");
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal small-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="space-modal-title"
        onSubmit={(e) => {
          e.preventDefault();
          const cleanName = name.trim();
          if (cleanName)
            onSave({
              id: uid("space"),
              name: cleanName,
              code: (code.trim() || cleanName.slice(0, 6)).toUpperCase(),
              type,
              color,
            });
        }}
      >
        <header>
          <div>
            <p>NEW WORKSPACE</p>
            <h2 id="space-modal-title">Add a module or project</h2>
          </div>
          <button
            type="button"
            aria-label="Close workspace editor"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <label className="full">
          <span>Name</span>
          <input
            required
            maxLength={200}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Machine Learning Systems"
          />
        </label>
        <div className="form-grid">
          <label>
            <span>Short code</span>
            <input
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value)}
              placeholder="BT4222"
            />
          </label>
          <label>
            <span>Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SpaceType)}
            >
              <option value="module">School module</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label>
            <span>Colour</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
        <footer>
          <span />
          <div>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="save">Add workspace</button>
          </div>
        </footer>
      </form>
    </div>
  );
}
function BackupMenu({
  data,
  onImport,
}: {
  data: AppData;
  onImport: (d: AppData) => void;
}) {
  function exp() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    a.href = url;
    a.download = `orbit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function imp(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > 5_000_000) {
      alert("That backup is too large to import safely.");
      input.value = "";
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = parseAppData(JSON.parse(String(r.result)));
        if (!d) throw new Error("Invalid backup shape");
        onImport(d);
      } catch {
        alert("That file is not a valid Orbit backup.");
      } finally {
        input.value = "";
      }
    };
    r.onerror = () => {
      alert("Orbit could not read that backup file.");
      input.value = "";
    };
    r.readAsText(f);
  }
  return (
    <div className="backup-actions">
      <button
        className="icon-button"
        type="button"
        aria-label="Export backup"
        title="Export backup"
        onClick={exp}
      >
        ⇩
      </button>
      <label className="icon-button" title="Import backup">
        ⇧<span className="sr-only">Import backup</span>
        <input
          aria-label="Import backup"
          type="file"
          accept="application/json"
          onChange={imp}
        />
      </label>
    </div>
  );
}
