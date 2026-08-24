import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceRecurrence,
  materializeRecurring,
  parseAppData,
  removeSpace,
} from "../app/orbit-data.ts";

function validData() {
  return {
    spaces: [
      {
        id: "all",
        name: "All work",
        type: "project",
        color: "#151922",
        code: "ALL",
      },
      {
        id: "module",
        name: "Module",
        type: "module",
        color: "#7659a8",
        code: "MOD",
      },
    ],
    tasks: [
      {
        id: "task-1",
        title: "Review notes",
        notes: "",
        status: "todo",
        spaceId: "module",
        dueAt: "2026-01-31T10:00:00.000Z",
        priority: "medium",
        dependencyIds: [],
        subtasks: [],
        recurrence: {
          unit: "month",
          interval: 1,
          time: "18:00",
          nextAt: "2026-01-31T10:00:00.000Z",
          anchorDay: 31,
        },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

test("accepts a complete Orbit backup without changing it", () => {
  const data = validData();
  assert.deepEqual(parseAppData(data), data);
});

test("rejects malformed backups that would crash the UI", () => {
  const missingSubtasks = validData();
  delete missingSubtasks.tasks[0].subtasks;
  assert.equal(parseAppData(missingSubtasks), null);

  const invalidDate = validData();
  invalidDate.tasks[0].dueAt = "not-a-date";
  assert.equal(parseAppData(invalidDate), null);

  const danglingDependency = validData();
  danglingDependency.tasks[0].dependencyIds = ["missing-task"];
  assert.equal(parseAppData(danglingDependency), null);
});

test("monthly recurrence preserves the intended day after a short month", () => {
  const recurrence = validData().tasks[0].recurrence;
  recurrence.nextAt = advanceRecurrence(recurrence);
  assert.equal(recurrence.nextAt.slice(0, 10), "2026-02-28");
  recurrence.nextAt = advanceRecurrence(recurrence);
  assert.equal(recurrence.nextAt.slice(0, 10), "2026-03-31");
});

test("materialising recurrence advances the visible template and avoids duplicates", () => {
  const data = validData();
  let id = 0;
  const materialized = materializeRecurring(
    data,
    new Date("2026-02-01T00:00:00.000Z"),
    (prefix) => `${prefix}-${++id}`,
  );

  assert.equal(materialized.tasks.length, 2);
  assert.equal(materialized.tasks[0].dueAt.slice(0, 10), "2026-02-28");
  assert.equal(
    materialized.tasks[0].recurrence.nextAt.slice(0, 10),
    "2026-02-28",
  );
  assert.equal(materialized.tasks[1].generatedFrom, "task-1");
  assert.equal(materialized.tasks[1].dueAt, "2026-01-31T10:00:00.000Z");

  const rerun = materializeRecurring(
    materialized,
    new Date("2026-02-01T00:00:00.000Z"),
    (prefix) => `${prefix}-${++id}`,
  );
  assert.equal(rerun.tasks.length, 2);
});

test("materialising a completed occurrence preserves its history", () => {
  const data = validData();
  data.tasks[0].status = "done";
  data.tasks[0].subtasks = [{ id: "sub-1", title: "Read", done: true }];
  const materialized = materializeRecurring(
    data,
    new Date("2026-02-01T00:00:00.000Z"),
    (prefix) => `${prefix}-new`,
  );

  assert.equal(materialized.tasks[0].status, "todo");
  assert.equal(materialized.tasks[0].subtasks[0].done, false);
  assert.equal(materialized.tasks[1].status, "done");
  assert.equal(materialized.tasks[1].subtasks[0].done, true);
});

test("removing a workspace removes its tasks and cleans dependencies", () => {
  const data = validData();
  data.spaces.push({
    id: "project",
    name: "Project",
    type: "project",
    color: "#337fa0",
    code: "PRJ",
  });
  data.tasks.push({
    ...data.tasks[0],
    id: "task-2",
    title: "Dependent task",
    spaceId: "project",
    dependencyIds: ["task-1"],
    recurrence: undefined,
  });

  const result = removeSpace(data, "module");
  assert.deepEqual(
    result.spaces.map((space) => space.id),
    ["all", "project"],
  );
  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["task-2"],
  );
  assert.deepEqual(result.tasks[0].dependencyIds, []);
});

test("the permanent all-work workspace cannot be removed", () => {
  const data = validData();
  assert.equal(removeSpace(data, "all"), data);
});

test("a backup remains valid after its final user workspace is removed", () => {
  const result = removeSpace(validData(), "module");
  assert.deepEqual(parseAppData(result), result);
});
