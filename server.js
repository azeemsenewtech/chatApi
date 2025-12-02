const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ---- MongoDB Connection ----
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp";
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// ---- Schemas ----
const UserSchema = new mongoose.Schema({
  name: String,
  email: String
});
const User = mongoose.model("User", UserSchema);

const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  message: String,
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", MessageSchema);

// ---- API Routes ----

// Register
app.post("/register", async (req, res) => {
  try {
    const { name, email } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, email });
    res.json({ user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
});

// Get messages between two users
app.get("/messages/:u1/:u2", async (req, res) => {
  try {
    const { u1, u2 } = req.params;
    const msgs = await Message.find({
      $or: [
        { senderId: u1, receiverId: u2 },
        { senderId: u2, receiverId: u1 }
      ]
    }).sort({ createdAt: 1 });
    res.json(msgs);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
});

// ---- Socket.IO ----
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));
  });

  socket.on("send_message", async (data) => {
    try {
      await Message.create(data);
      const receiverSocket = onlineUsers[data.receiverId];
      if (receiverSocket) {
        io.to(receiverSocket).emit("receive_message", data);
      }
    } catch (err) {
      console.error("Send message error:", err);
    }
  });

  socket.on("disconnect", () => {
    for (let id in onlineUsers) {
      if (onlineUsers[id] === socket.id) {
        delete onlineUsers[id];
        io.emit("online_users", Object.keys(onlineUsers));
        break;
      }
    }
  });
});

// ---- Start Server ----
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
