// backend/server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// --- MongoDB Connection ---
mongoose.connect("mongodb://127.0.0.1:27017/chatapp", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Message = mongoose.model("Message", MessageSchema);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let onlineUsers = {}; // { userId: socketId }

// -------------------- Routes --------------------

// Register
app.post("/register", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ message: "Name & email required" });

  let user = await User.findOne({ email });
  if (user) return res.status(400).json({ message: "User exists" });

  user = await User.create({ name, email });
  res.json({ message: "Registered", user });
});

// Login
app.post("/login", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({ message: "Login success", user });
});

// Get all users
app.get("/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Get messages between two users
app.get("/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const chat = await Message.find({
    $or: [
      { senderId: user1, receiverId: user2 },
      { senderId: user2, receiverId: user1 },
    ],
  }).sort({ createdAt: 1 });

  res.json(chat);
});

// -------------------- Socket.io --------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));
    console.log("Online users:", Object.keys(onlineUsers));
  });

  socket.on("send_message", async ({ senderId, receiverId, message }) => {
    const msg = await Message.create({ senderId, receiverId, message });

    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("receive_message", msg);
    }

    // Send to sender too
    socket.emit("receive_message", msg);
  });

  socket.on("disconnect", () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        io.emit("online_users", Object.keys(onlineUsers));
        break;
      }
    }
  });
});

// -------------------- Start server --------------------
server.listen(3001, () => console.log("Server running on http://localhost:3001"));
