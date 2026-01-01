// export class User {
//   constructor(id, fullName, email) {
//     this.id = id; // string o número único
//     this.fullName = fullName; // nombre completo
//     this.email = email; // dirección de correo
//   }
// }

import mongoose from "mongoose";
import bcrypt from "bcrypt";

const USER_SECTORS = [
  "TECNOLOGIA_INFORMATICA",
];

const userSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, maxlength: 100, trim: true },
		email: {
			type: String,
			required: true,
			maxlength: 100,
			unique: true,
			lowercase: true,
			trim: true,
		},
		password: {
			type: String,
			required: true,
			select: false,
		},
		sector: {
			type: String,
			enum: USER_SECTORS,
			required: true,
		},
		isSupervisor: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true,
	},
);
userSchema.pre("save", async function (next) {
  // Solo hashea si la password fue creada o modificada
  if (!this.isModified("password")) return next();

  try {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

export const UserModel = mongoose.model("User", userSchema);
