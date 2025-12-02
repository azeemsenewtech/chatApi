const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// App Setup
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connect
mongoose
  .connect("mongodb://127.0.0.1:27017/chatapp")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

// User Model
const UserSchema = new mongoose.Schema({
  name: String,
  email: String
});
const User = mongoose.model("User", UserSchema);

// Message Model
const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  message: String
});
const Message = mongoose.model("Message", MessageSchema);

// Register
app.post("/register", async (req, res) => {
  const { name, email } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "User already exists" });

  const user = await User.create({ name, email });
  res.json({ user });
});

// Login
app.post("/login", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({ user });
});

// Get all users
app.get("/users", async (req, res) => {
  res.json(await User.find());
});

// Get messages between two users
app.get("/messages/:u1/:u2", async (req, res) => {
  const { u1, u2 } = req.params;

  const msgs = await Message.find({
    $or: [
      { senderId: u1, receiverId: u2 },
      { senderId: u2, receiverId: u1 }
    ]
  });

  res.json(msgs);
});

// --- SOCKETS ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit("online_users", Object.keys(onlineUsers));
  });

  socket.on("send_message", async (data) => {
    await Message.create(data);

    const receiverSocket = onlineUsers[data.receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("receive_message", data);
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

server.listen(3001, () =>
  console.log("Server running on http://localhost:3001")
);
