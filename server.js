// // backend/server.js
// const express = require("express");
// const cors = require("cors");
// const http = require("http");
// const { Server } = require("socket.io");

// const app = express();
// app.use(cors());
// app.use(express.json());

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" }
// });

// // Memory storage
// let users = [];        // { id, name, email }
// let messages = [];     // { senderId, receiverId, message }
// let onlineUsers = {};  // { userId: socketId }

// // -------------------------
// // Register
// // -------------------------
// app.post("/register", (req, res) => {
//   const { name, email } = req.body;
//   if (!name || !email) return res.status(400).json({ message: "Name and email required" });

//   const existing = users.find(u => u.email === email);
//   if (existing) return res.status(400).json({ message: "User exists" });

//   const newUser = { id: Date.now().toString(), name, email };
//   users.push(newUser);
//   res.json({ message: "Registered", user: newUser });
// });

// // -------------------------
// // Login
// // -------------------------
// app.post("/login", (req, res) => {
//   const { email } = req.body;

//   const user = users.find(u => u.email === email);
//   if (!user) return res.status(404).json({ message: "User not found" });

//   res.json({ message: "Login success", user });
// });

// // -------------------------
// // Get all users
// // -------------------------
// app.get("/users", (req, res) => {
//   res.json(users);
// });

// // -------------------------
// // Get messages between two users
// // -------------------------
// app.get("/messages/:user1/:user2", (req, res) => {
//   const { user1, user2 } = req.params;

//   const chat = messages.filter(
//     m =>
//       (m.senderId === user1 && m.receiverId === user2) ||
//       (m.senderId === user2 && m.receiverId === user1)
//   );

//   res.json(chat);
// });

// // -------------------------
// // SOCKET.IO CHAT
// // -------------------------
// io.on("connection", (socket) => {
//   console.log("User connected:", socket.id);

//   // Join user online
//   socket.on("join", (userId) => {
//     onlineUsers[userId] = socket.id;
//     console.log(`User ${userId} online`);
//   });

//   // Send message
//   socket.on("send_message", ({ senderId, receiverId, message }) => {
//     console.log(`Message from ${senderId} → ${receiverId}: ${message}`);

//     // Save message
//     messages.push({ senderId, receiverId, message });

//     // Send to receiver if online
//     const receiverSocket = onlineUsers[receiverId];
//     if (receiverSocket) {
//       io.to(receiverSocket).emit("receive_message", { senderId, message });
//     }

//     // Send copy back to sender UI
//     socket.emit("receive_message", { senderId, message });
//   });

//   // Disconnect
//   socket.on("disconnect", () => {
//     for (let userId in onlineUsers) {
//       if (onlineUsers[userId] === socket.id) {
//         delete onlineUsers[userId];
//         console.log(`User ${userId} disconnected`);
//         break;
//       }
//     }
//   });
// });

// server.listen(3001, () =>
//   console.log("🔥 Server running at http://localhost:3001")
// );
// backend/server.js
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// In-memory storage
let users = [];        // { id, name, email }
let messages = [];     // { senderId, receiverId, message }
let onlineUsers = {};  // { userId: socketId }

// -----------------------------
// Register
// -----------------------------
app.post("/register", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ message: "Name and email required" });

  const existing = users.find(u => u.email === email);
  if (existing) return res.status(400).json({ message: "User exists" });

  const newUser = { id: Date.now().toString(), name, email };
  users.push(newUser);

  res.json({ message: "Registered", user: newUser });
});

// -----------------------------
// Login
// -----------------------------
app.post("/login", (req, res) => {
  const { email } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({ message: "Login success", user });
});

// -----------------------------
// Get all users
// -----------------------------
app.get("/users", (req, res) => {
  res.json(users);
});

// -----------------------------
// Get messages between two users
// -----------------------------
app.get("/messages/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;

  const chat = messages.filter(
    m =>
      (m.senderId === user1 && m.receiverId === user2) ||
      (m.senderId === user2 && m.receiverId === user1)
  );

  res.json(chat);
});

// -----------------------------
// Socket.IO
// -----------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Track online users
  socket.on("join", (userId) => {
    onlineUsers[userId] = socket.id;
    console.log(`User ${userId} online`);
  });

  // Handle sending messages
  socket.on("send_message", ({ senderId, receiverId, message }) => {
    // Save message in memory
    messages.push({ senderId, receiverId, message });

    // Send only to receiver if online
    const receiverSocket = onlineUsers[receiverId];
    if (receiverSocket) {
      io.to(receiverSocket).emit("receive_message", { senderId, message });
    }

    // Do NOT emit to sender → frontend updates sender locally
  });

  // Disconnect
  socket.on("disconnect", () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        console.log(`User ${userId} disconnected`);
        break;
      }
    }
  });
});

// -----------------------------
// Start server
// -----------------------------
server.listen(3001, () => {
  console.log("🔥 Server running at http://localhost:3001");
});
