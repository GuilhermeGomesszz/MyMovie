import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwtToken.js";

const getCurrentUser = async (req, res) => {
    if (!req.user) return res.json(null);
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true },
        });
        if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
        return res.json(user);
    } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        return res.status(500).json({ message: "Erro ao carregar usuário" });
    }
};

const login = async (req, res) => {
    const {email, password} = req.body;
    const user = await prisma.user.findUnique({where: {email}});
    if(!user){
        return res.status(400).json({message: "Usuario não encontrado"});
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
        return res.status(400).json({message: "Senha incorreta"});
    }
    const token = generateToken(user.id,res);


    return res.status(200).json({status: "success", data: {user: {id: user.id, name: user.name, email: user.email}, token: token}});




}

const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: "Usuário já existe" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: { name, email, password:hashedPassword }
        });

        const token = generateToken(user.id, res);

        return res.status(201).json({status: "success", data: {user: {id: user.id, name: name, email: email}, token: token}});
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const logout = (req, res) => {
    res.cookie("jwt", "", {
        httpOnly: true,
        expires: new Date(0)
    });
    res.status(200).json({message: "logout successful"});
}

export {getCurrentUser, register, login, logout};