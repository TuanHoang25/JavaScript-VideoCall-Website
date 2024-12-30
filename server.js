import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidV4 } from "uuid";
import { PeerServer } from "peer";
import cors from "cors";
const app = express();
const server = http.createServer(app);
// const io = new Server(server);
app.use(cors({
  origin: 'https://ltm-1.onrender.com',
  methods: ['GET', 'POST'],
  credentials: true
}));
const io = new Server(server, {
  cors: {
    origin: "https://ltm-1.onrender.com", // Đảm bảo origin chính xác
    methods: ["GET", "POST"],
    credentials: true
  }
});
const peerServer = PeerServer({
  port: 9000,  // Sử dụng cùng port với server
  path: '/myapp',                  // Đổi path để tránh xung đột
  proxied: true,
  debug: true                      // Thêm debug để dễ theo dõi lỗi
});
const users = {}; // Store user names
const roomUsers = {}; // Store number of users in each room
app.use("/myapp", peerServer);
app.set("view engine", "ejs");
app.use(express.static("public"));

// Redirect to a unique room
app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

// Render the room view
app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  let currentRoom;

  socket.on("join-room", (roomId, userId, userName) => {
    if (userName) {
      users[socket.id] = userName; // Save user name
    } else {
      users[socket.id] = "Unknown User"; // Default name if not provided
    }

    currentRoom = roomId;
    socket.join(roomId);

    // Update number of users in room
    if (!roomUsers[roomId]) roomUsers[roomId] = 0;
    roomUsers[roomId] += 1;
    io.to(roomId).emit("update-user-count", roomUsers[roomId]);

    // Broadcast user connection
    socket
      .to(roomId)
      .emit("user-connected", userId, users[socket.id]);

    // Handle chat message sending
    socket.on("send-chat-message", (message) => {
      socket.to(roomId).emit("chat-message", message);
    });
    // Handle microphone toggle
    socket.on("toggle-mic", (enabled) => {
      socket.to(roomId).emit("mic-toggle", socket.id, enabled);
    });

    // Handle camera toggle
    socket.on("toggle-camera", (enabled) => {
      socket.to(roomId).emit("camera-toggle", socket.id, enabled);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      roomUsers[roomId] -= 1;
      io.to(roomId).emit("update-user-count", roomUsers[roomId]);
      const userName = users[socket.id];
      socket.to(roomId).emit("user-disconnected", userId, userName);
      delete users[socket.id];
    });
  });
});

const PORT = process.env.PORT || 3000; // Sử dụng cổng từ biến môi trường hoặc mặc định là 3000
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

