import nodemailer from "nodemailer";
import {ArgentinaTime} from "../utils/argentinaTime.js";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_API_KEY,
  },
});

export async function sendTaskAssignedEmail({ to, task }) {
  return transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
    to, // string o array de emails
    subject: `Nueva tarea asignada: ${task.title}`,
    text: `
Tenés una nueva tarea asignada:

Título: ${task.title}
Descripción: ${task.description || "-"}

Comienza: ${task.date ? ArgentinaTime.format(task.date) : "Sin fecha"}
Vence: ${task.deadline ? ArgentinaTime.format(task.deadline) : "Sin fecha"}

Ingresá al sistema para verla.
    `.trim(),
  });
}

export async function sendTaskReminderEmail({ to, tasks }) {
  if (!tasks || tasks.length === 0) return;

  const tasksList = tasks
    .map((task, index) => {
      const start = ArgentinaTime.format(task.date);
      const end = ArgentinaTime.format(task.deadline);

      return `
${index + 1}. ${task.title}
comienza hoy: ${start} - vence: ${end}
      `.trim();
    })
    .join("\n\n");

  return transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
    to,
    subject: "Recordatorio de tareas para hoy",
    text: `
Tenés ${tasks.length} tarea(s) con deadline hoy:

${tasksList}

Este es un mensaje automático.
    `.trim(),
  });
}
