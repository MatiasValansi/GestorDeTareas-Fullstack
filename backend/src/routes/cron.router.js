import { Router } from "express";
import { runDailyTaskReminders } from "../services/cron.service.js";

const cronRouter = Router();

cronRouter.post("/daily-task-reminders", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token || token !== process.env.CRON_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await runDailyTaskReminders();

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("❌ Cron daily-task-reminders failed:", err);
    return res.status(500).json({ ok: false, error: "Cron failed" });
  }
});

export { cronRouter };
