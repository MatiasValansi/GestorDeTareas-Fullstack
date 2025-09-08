import request from 'supertest';
import app from "../app.js";
import mongoose from "mongoose";
import mongoConnectionInstance from "../database/mongoose.database.js";
import dotenv from "dotenv"

dotenv.config

beforeAll(async () => await mongoConnectionInstance.connect());

afterAll(async () => await mongoose.disconnect());

describe("Pruebas unitarias de Users", () => {
  let createdUser;

  test("POST /api/user -> crear un usuario", async () => {
    
    const response = await request(app).post("/users/user")
    .set("Authorization", `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiYWRtaW4iLCJwYXNzd29yZCI6IioqKioqKioiLCJyb2wiOiJPd25lciIsImlhdCI6MTc1MDEwMDA3M30.8t52wDO-SuKLEnGqhSl5TqCTkVlugzTAGW9sGzgs5jA`)
    .send(
   { "user": {
        "name": "Prueba con tokern",
        "email": "estoesunaprueba@gmail.com"        
    }});

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("payload");

    const user = response.body.payload._doc;

    expect(user).toHaveProperty("_id");
    expect(user.name).toBe("Prueba con tokern");
    expect(user.email).toBe("estoesunaprueba@gmail.com");

    createdUser = response.body;
  });


});
