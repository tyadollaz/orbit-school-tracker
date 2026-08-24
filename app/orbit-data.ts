export type Status = "todo" | "doing" | "blocked" | "done";
export type SpaceType = "module" | "project";
export type Recurrence = {
  unit: "day" | "week" | "month";
  interval: number;
  time: string;
  nextAt: string;
  anchorDay?: number;
};
export type Subtask = { id: string; title: string; done: boolean };
export type Task = {
  id: string;
  title: string;
  notes: string;
  status: Status;
  spaceId: string;
  dueAt?: string;
  priority: "low" | "medium" | "high";
  dependencyIds: string[];
  subtasks: Subtask[];
  recurrence?: Recurrence;
  generatedFrom?: string;
  createdAt: string;
};
export type Space = {
  id: string;
  name: string;
  type: SpaceType;
  color: string;
  code: string;
};
export type AppData = { tasks: Task[]; spaces: Space[] };

const statuses = new Set<Status>(["todo", "doing", "blocked", "done"]);
const priorities = new Set<Task["priority"]>(["low", "medium", "high"]);
const recurrenceUnits = new Set<Recurrence["unit"]>(["day", "week", "month"]);
const spaceTypes = new Set<SpaceType>(["module", "project"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function hasUniqueIds(items: { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function parseAppData(value: unknown): AppData | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.tasks) ||
    !Array.isArray(value.spaces)
  )
    return null;
  if (value.tasks.length > 10_000 || value.spaces.length > 1_000) return null;

  const spaces: Space[] = [];
  for (const candidate of value.spaces) {
    if (!isRecord(candidate)) return null;
    if (!isString(candidate.id, 100) || !candidate.id) return null;
    if (!isString(candidate.name, 200) || !candidate.name.trim()) return null;
    if (!isString(candidate.code, 20) || !candidate.code.trim()) return null;
    if (
      !isString(candidate.color, 20) ||
      !/^#[\da-f]{6}$/i.test(candidate.color)
    )
      return null;
    if (!spaceTypes.has(candidate.type as SpaceType)) return null;
    spaces.push(candidate as Space);
  }
  if (!hasUniqueIds(spaces) || !spaces.some((space) => space.id === "all"))
    return null;
  const workspaceIds = new Set(
    spaces.filter((space) => space.id !== "all").map((space) => space.id),
  );
  if (workspaceIds.size === 0) return null;

  const tasks: Task[] = [];
  for (const candidate of value.tasks) {
    if (!isRecord(candidate)) return null;
    if (!isString(candidate.id, 100) || !candidate.id) return null;
    if (!isString(candidate.title, 500) || !candidate.title.trim()) return null;
    if (!isString(candidate.notes, 20_000)) return null;
    if (!statuses.has(candidate.status as Status)) return null;
    if (
      !isString(candidate.spaceId, 100) ||
      !workspaceIds.has(candidate.spaceId)
    )
      return null;
    if (!priorities.has(candidate.priority as Task["priority"])) return null;
    if (candidate.dueAt !== undefined && !isIsoDate(candidate.dueAt))
      return null;
    if (!isIsoDate(candidate.createdAt)) return null;
    if (
      candidate.generatedFrom !== undefined &&
      !isString(candidate.generatedFrom, 100)
    )
      return null;
    if (
      !Array.isArray(candidate.dependencyIds) ||
      !candidate.dependencyIds.every((id) => isString(id, 100))
    )
      return null;
    if (!Array.isArray(candidate.subtasks) || candidate.subtasks.length > 1_000)
      return null;

    const subtasks: Subtask[] = [];
    for (const subtask of candidate.subtasks) {
      if (!isRecord(subtask) || !isString(subtask.id, 100) || !subtask.id)
        return null;
      if (!isString(subtask.title, 500) || typeof subtask.done !== "boolean")
        return null;
      subtasks.push(subtask as Subtask);
    }
    if (!hasUniqueIds(subtasks)) return null;

    let recurrence: Recurrence | undefined;
    if (candidate.recurrence !== undefined) {
      if (!isRecord(candidate.recurrence)) return null;
      const item = candidate.recurrence;
      if (!recurrenceUnits.has(item.unit as Recurrence["unit"])) return null;
      if (
        !Number.isInteger(item.interval) ||
        (item.interval as number) < 1 ||
        (item.interval as number) > 10_000
      )
        return null;
      if (
        !isString(item.time, 5) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)
      )
        return null;
      if (!isIsoDate(item.nextAt)) return null;
      if (
        item.anchorDay !== undefined &&
        (!Number.isInteger(item.anchorDay) ||
          (item.anchorDay as number) < 1 ||
          (item.anchorDay as number) > 31)
      )
        return null;
      recurrence = item as Recurrence;
    }

    tasks.push({ ...(candidate as Task), subtasks, recurrence });
  }

  if (!hasUniqueIds(tasks)) return null;
  const taskIds = new Set(tasks.map((task) => task.id));
  if (
    tasks.some((task) =>
      task.dependencyIds.some((id) => id === task.id || !taskIds.has(id)),
    )
  )
    return null;
  return { tasks, spaces };
}

export function advanceRecurrence(recurrence: Recurrence): string {
  const date = new Date(recurrence.nextAt);
  if (recurrence.unit === "day")
    date.setDate(date.getDate() + recurrence.interval);
  if (recurrence.unit === "week")
    date.setDate(date.getDate() + 7 * recurrence.interval);
  if (recurrence.unit === "month") {
    const anchorDay = recurrence.anchorDay ?? date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + recurrence.interval);
    const lastDay = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getDate();
    date.setDate(Math.min(anchorDay, lastDay));
  }
  return date.toISOString();
}

export function materializeRecurring(
  source: AppData,
  now = new Date(),
  makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`,
): AppData {
  const next = structuredClone(source) as AppData;
  const templates = [...next.tasks].filter((task) => task.recurrence);

  for (const template of templates) {
    const recurrence = template.recurrence!;
    if (recurrence.unit === "month")
      recurrence.anchorDay ??= new Date(recurrence.nextAt).getDate();
    let created = 0;
    while (new Date(recurrence.nextAt) <= now && created < 50) {
      const dueAt = recurrence.nextAt;
      const representsVisibleOccurrence = template.dueAt === dueAt;
      if (
        !next.tasks.some(
          (task) => task.generatedFrom === template.id && task.dueAt === dueAt,
        )
      ) {
        next.tasks.push({
          ...template,
          id: makeId("task"),
          status: representsVisibleOccurrence ? template.status : "todo",
          dueAt,
          recurrence: undefined,
          generatedFrom: template.id,
          subtasks: template.subtasks.map((subtask) => ({
            ...subtask,
            id: makeId("sub"),
            done: representsVisibleOccurrence ? subtask.done : false,
          })),
          createdAt: now.toISOString(),
        });
      }
      recurrence.nextAt = advanceRecurrence(recurrence);
      created += 1;
    }
    template.dueAt = recurrence.nextAt;
    template.status = "todo";
    template.subtasks = template.subtasks.map((subtask) => ({
      ...subtask,
      done: false,
    }));
  }
  return next;
}
