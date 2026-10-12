import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const generateToken = (userId, res) => {
    const payload = { id: userId };
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

    if (!secret) {
        throw new Error("JWT_SECRET não configurado");
    }

    const token = jwt.sign(payload, secret, { expiresIn });

    res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: (1000 * 60 * 60 * 24) * 7,
    });

    return token;
};