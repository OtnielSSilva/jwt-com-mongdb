import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "./domain/users/models/UserModel";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const SECRET_KEY = process.env.MINHA_CHAVE_SECRETA as string;
const REFRESH_SECRET_KEY = process.env.REFRESH_SECRET_KEY as string;

router.post("/register", async (req: Request, res: Response) => {
  const { name, cpf, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const newUser = new User({ name, cpf, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Usuário registrado com sucesso" });
  } catch (error) {
    res.status(400).json({ error: "Usuário já existe" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      const accessToken = jwt.sign(
        { id: user._id, email: user.email },
        SECRET_KEY,
        { expiresIn: "1h" }
      );

      const refreshToken = jwt.sign({ id: user._id }, REFRESH_SECRET_KEY, {
        expiresIn: "7d",
      });

      user.refreshTokens.push(refreshToken);
      await user.save();

      res.json({ accessToken, refreshToken });
    } else {
      res.status(401).json({ error: "Credenciais inválidas" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res
      .status(401)
      .json({ error: "Token de atualização não fornecido" });
  }

  try {
    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) {
      return res.status(403).json({ error: "Token de atualização inválido" });
    }

    jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err: any) => {
      if (err) {
        return res.status(403).json({ error: "Token de atualização expirado" });
      }

      const accessToken = jwt.sign({ id: user._id }, SECRET_KEY, {
        expiresIn: "1h",
      });

      res.json({ accessToken });
    });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res
      .status(400)
      .json({ error: "Token de atualização não fornecido" });
  }

  try {
    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) {
      return res.status(400).json({ error: "Token de atualização inválido" });
    }

    user.refreshTokens = user.refreshTokens.filter(
      (token) => token !== refreshToken
    );
    await user.save();

    return res.status(200).json({ message: "Logout realizado com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
