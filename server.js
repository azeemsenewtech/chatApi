// server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// ----------------------
// App Setup
// ----------------------
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// ----------------------
// Socket.IO Setup
// ----------------------
const io = new Server(server, {
  cors: { origin: "*" },
});

// ----------------------
// MongoDB Connect
// ----------------------
mongoose
  .connect("mongodb://127.0.0.1:27017/chatapp")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

// ----------------------
// Models
// ----------------------
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const User = mongoose.model("User", UserSchema);

const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", MessageSchema);

// ----------------------
// REST API Routes
// ----------------------

// Register
app.post("/register", async (req, res) => {
  const { name, email } = req.body;

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Get messages between two users
app.get("/messages/:u1/:u2", async (req, res) => {
  const { u1, u2 } = req.params;

  try {
    const msgs = await Message.find({
      $or: [
        { senderId: u1, receiverId: u2 },
        { senderId: u2, receiverId: u1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// ----------------------
// Socket.IO
// ----------------------
let onlineUsers = {}; // { userId: [socketId1, socketId2] }

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Track online users
  socket.on("join", (userId) => {
    if (!onlineUsers[userId]) onlineUsers[userId] = [];
    onlineUsers[userId].push(socket.id);

    io.emit("online_users", Object.keys(onlineUsers));
  });

  // Join a chat room between two users
  socket.on("join_chat", ({ senderId, receiverId }) => {
    const room = [senderId, receiverId].sort().join("_");
    socket.join(room);
  });

  // Send a message
  socket.on("send_message", async (data) => {
    try {
      // Save message to DB
      await Message.create(data);

      // Emit to room
      const room = [data.senderId, data.receiverId].sort().join("_");
      io.to(room).emit("receive_message", data);
    } catch (err) {
      console.log("Message save error:", err);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    for (let id in onlineUsers) {
      onlineUsers[id] = onlineUsers[id].filter((sid) => sid !== socket.id);
      if (onlineUsers[id].length === 0) delete onlineUsers[id];
    }
    io.emit("online_users", Object.keys(onlineUsers));
  });
});

// ----------------------
// Start Server
// ----------------------
const PORT = 3001;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
