import { Router } from "express";
import { TaskController } from "../controller/task.controller.js";
import { authByToken } from "../middleware/auth.jwt.js";

const taskRouter = Router();

taskRouter.get("/task/:id", authByToken, TaskController.taskValidation);
taskRouter.get("/allTasks", authByToken, TaskController.taskAll); //GetAll
taskRouter.post("/task", authByToken, TaskController.taskCreateOne);
taskRouter.put("/task/:id", authByToken, TaskController.taskUpdateOne);
taskRouter.delete("/task/:id", authByToken, TaskController.taskDeleteOne);
taskRouter.delete("/allTasks", (req, res) => {}); //DeleteAll

export { taskRouter };
