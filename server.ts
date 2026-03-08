import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import db from "./db.ts";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "dragon-tiger-secret-key";
const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  // --- API Routes ---

  // Auth
  app.post("/api/auth/register", (req, res) => {
    const { username, mobile, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const info = db.prepare("INSERT INTO users (username, mobile, password) VALUES (?, ?, ?)").run(username, mobile, hashedPassword);
      const user = db.prepare("SELECT id, username, wallet_balance FROM users WHERE id = ?").get(info.lastInsertRowid);
      const token = jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET);
      res.json({ token, user });
    } catch (e) {
      res.status(400).json({ error: "Username or mobile already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { mobile, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE mobile = ?").get(mobile);
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username: user.username, wallet_balance: user.wallet_balance, role: user.role } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // User Profile
  app.get("/api/user/profile", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET) as any;
      const user = db.prepare("SELECT id, username, wallet_balance, role FROM users WHERE id = ?").get(decoded.id);
      res.json(user);
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Admin Routes
  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT id, username, mobile, wallet_balance, status FROM users").all();
    res.json(users);
  });

  app.get("/api/admin/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    res.json(settings);
  });

  app.post("/api/admin/settings", (req, res) => {
    const { key, value } = req.body;
    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, key);
    res.json({ success: true });
  });

  // --- Game State & Logic ---
  let gameState = {
    status: "betting", // betting, dealing, result
    timer: 15,
    dragonCard: null as any,
    tigerCard: null as any,
    winner: null as string | null,
    history: [] as any[],
  };

  const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
  const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function getRandomCard() {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    return { suit, value, rank: values.indexOf(value) + 1 };
  }

  function resolveGame() {
    gameState.status = "dealing";
    io.emit("game_status", gameState);

    setTimeout(() => {
      const dragon = getRandomCard();
      const tiger = getRandomCard();

      gameState.dragonCard = dragon;
      gameState.tigerCard = tiger;

      if (dragon.rank > tiger.rank) gameState.winner = "dragon";
      else if (tiger.rank > dragon.rank) gameState.winner = "tiger";
      else gameState.winner = "tie";

      // Admin Profit Mode Logic
      const adminProfitMode = db.prepare("SELECT value FROM settings WHERE key = 'admin_profit_mode'").get().value;
      if (adminProfitMode === 'on') {
        // Simple logic: Check which side has more bets and try to make the other side win
        // For this demo, we'll just keep it RNG unless explicitly manipulated via manual mode
      }

      gameState.status = "result";
      gameState.history.unshift(gameState.winner);
      if (gameState.history.length > 20) gameState.history.pop();

      // Resolve Bets & Payouts
      const currentBets = db.prepare("SELECT * FROM bets WHERE round_id IS NULL").all();
      for (const bet of currentBets) {
        let payout = 0;
        if (bet.bet_side === gameState.winner) {
          if (gameState.winner === 'tie') payout = bet.amount * 9; // 1:8 payout + original bet
          else payout = bet.amount * 2; // 1:1 payout + original bet
          
          db.prepare("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?").run(payout, bet.user_id);
          db.prepare("UPDATE bets SET payout = ?, round_id = ? WHERE id = ?").run(payout, 0, bet.id); // Using 0 as placeholder for round_id
          db.prepare("INSERT INTO transactions (user_id, type, amount) VALUES (?, 'win', ?)").run(bet.user_id, payout);
        } else {
          db.prepare("UPDATE bets SET round_id = ? WHERE id = ?").run(0, bet.id);
        }
      }

      // Save to logs
      db.prepare("INSERT INTO game_logs (dragon_card, tiger_card, winner, total_bets) VALUES (?, ?, ?, ?)")
        .run(JSON.stringify(dragon), JSON.stringify(tiger), gameState.winner, 0);

      io.emit("game_status", gameState);
      io.emit("payout_complete"); // Notify clients to refresh balance

      // Reset for next round
      setTimeout(() => {
        gameState.status = "betting";
        gameState.timer = 15;
        gameState.dragonCard = null;
        gameState.tigerCard = null;
        gameState.winner = null;
        io.emit("game_status", gameState);
      }, 5000);
    }, 2000);
  }

  setInterval(() => {
    if (gameState.status === "betting") {
      gameState.timer--;
      if (gameState.timer <= 0) {
        resolveGame();
      }
      io.emit("timer", gameState.timer);
    }
  }, 1000);

  io.on("connection", (socket) => {
    socket.emit("game_status", gameState);

    socket.on("place_bet", (data) => {
      const { userId, side, amount } = data;
      const user = db.prepare("SELECT wallet_balance FROM users WHERE id = ?").get(userId);
      if (user && user.wallet_balance >= amount) {
        db.prepare("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?").run(amount, userId);
        db.prepare("INSERT INTO bets (user_id, bet_side, amount) VALUES (?, ?, ?)").run(userId, side, amount);
        socket.emit("bet_confirmed", { balance: user.wallet_balance - amount });
      } else {
        socket.emit("error", "Insufficient balance");
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
