import jwt from "jsonwebtoken"
import { config } from "../config/config.js";

export const authByToken = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1]; // formato: "Bearer <token>"

    try {
        const decoded = jwt.verify(token, config.SECRET_KEY);
        req.user = decoded; // guarda el payload del token para usar después
        console.log(req.user);
        
        
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}