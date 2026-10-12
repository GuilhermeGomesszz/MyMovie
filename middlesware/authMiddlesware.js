import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const getTokenFromRequest = (req) => {
    const authorizationHeader = req.headers.authorization || req.headers.Authorization;

    if (authorizationHeader) {
        const [scheme, token] = authorizationHeader.split(" ");

        if (scheme?.toLowerCase() === "bearer" && token) {
            return token;
        }

        if (token) {
            return token;
        }
    }

    if (req.cookies?.jwt) {
        return req.cookies.jwt;
    }

    if (req.headers["x-access-token"]) {
        return req.headers["x-access-token"];
    }

    if (req.query?.token) {
        return req.query.token;
    }

    return null;
};

const authMiddleware = async (req, res, next) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({ message: "Acesso não autorizado" });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        console.error("JWT_SECRET não configurado");
        return res.status(500).json({ message: "Erro de configuração do servidor" });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (error) {
        console.error("ERRO REAL DO JWT:", error.message);
        return res.status(401).json({ message: "Token inválido" });
    }
};

const optionalAuthMiddleware = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) return next();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("JWT_SECRET não configurado");
        return res.status(500).json({ message: "Erro de configuração do servidor" });
    }

    try {
        req.user = jwt.verify(token, secret);
        return next();
    } catch {
        res.clearCookie("jwt");
        req.user = null;
        return next();
    }
};

export { optionalAuthMiddleware };
export default authMiddleware;