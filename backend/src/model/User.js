// export class User {
//   constructor(id, fullName, email) {
//     this.id = id; // string o número único
//     this.fullName = fullName; // nombre completo
//     this.email = email; // dirección de correo
//   }
// }

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		name: { type: String, require: true, maxlength: 100, trim: true },
		email: {
			type: String,
			require: true,
			maxlength: 100,
			unique: true,
			lowercase: true,
			trim: true,
		},
		/* array de tareas:
		OJO ---> Pero normalmente no se hace esto en MongoDB, ya que las tareas pueden ser muchas, y no se recomienda cargar grandes arrays dentro del documento User

		tasks: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "Task"
		}]
		*/
	},
	{
		timestamps: true,
	},
	{ collection: "users" },
);

export const UserModel = mongoose.model("User", userSchema);
