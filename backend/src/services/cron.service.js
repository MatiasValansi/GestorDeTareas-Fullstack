import { TaskModel } from "../model/Task.js";
import { ArgentinaTime } from "../utils/argentinaTime.js";
import { sendTaskReminderEmail } from "./email.service.js";

/**
 * Busca tareas con deadline hoy (en hora Argentina) y envía 1 mail por usuario
 */
export async function runDailyTaskReminders() {
  const nowUtc = new Date();

  // "Hoy" en Argentina
  const year = ArgentinaTime.getArgentinaYear(nowUtc);
  const month = ArgentinaTime.getArgentinaMonth(nowUtc); // 0-11
  const day = ArgentinaTime.getArgentinaDate(nowUtc);

  // Rango [hoy 00:00, hoy 23:59:59] en UTC equivalente
  const startUtc = ArgentinaTime.createFromArgentinaComponents(year, month, day, 0, 0, 0);
  const endUtc = ArgentinaTime.createFromArgentinaComponents(year, month, day, 23, 59, 59);

  // Traer tareas pendientes cuyo deadline cae HOY (hora Argentina)
  // Nota: assignedTo son IDs, vamos a popular emails si tu UserModel lo permite.
  const tasks = await TaskModel.find({
    status: "PENDIENTE",
    deadline: { $gte: startUtc, $lte: endUtc },
  }).populate("assignedTo", "email name");

  // Agrupar por email
  const tasksByEmail = new Map();

  for (const task of tasks) {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [];

    for (const user of assignees) {
      const email = user?.email;
      if (!email) continue;

      if (!tasksByEmail.has(email)) tasksByEmail.set(email, []);
      tasksByEmail.get(email).push(task);
    }
  }

  let mailsSent = 0;

  for (const [email, userTasks] of tasksByEmail.entries()) {
    // 1 mail por usuario con todas las tareas
    await sendTaskReminderEmail({
      to: email,
      tasks: userTasks,
    });
    mailsSent++;
  }

  return {
    dateArgentina: ArgentinaTime.format(nowUtc),
    tasksFound: tasks.length,
    usersNotified: tasksByEmail.size,
    mailsSent,
  };
}
