import express from 'express';
const PORT = 3000;
const app = express();

import {connectDB, disconnectDB} from './config/db.js';



import dotenv from 'dotenv';
dotenv.config();
connectDB();

import moviesRount from './routes/moviesRount.js';
import authRountes from './routes/authRountes.js';
import watchlistRountes from './routes/watchlistRountes.js';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(currentDirectory, "public")));

app.use("/movie", moviesRount);
app.use("/auth", authRountes);
app.use("/watchlist", watchlistRountes);


app.get("/hello", (req, res) => {
    res.json({ message: "Hello, World!" });
})


const server = app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
    server.close(async () => {
        await disconnectDB();
        process.exit(1);
    });
});

process.on("uncaughtException", async (error) => {
    console.error("Uncaught Exception:", error);
    await  disconnectDB();
    process.exit(1);
});

process.on("SIGINT", async () => {
    console.log("Recebido SIGINT. Desconectando do banco de dados...");
    server.close(async () => {
        await disconnectDB();
        process.exit(0);
    });
});