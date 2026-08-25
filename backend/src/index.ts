import http from "http";
import express from "express";
import { Server, Socket } from "socket.io";
import { UserManager } from "./managers/UserManager";

const app = express();
const server = http.createServer(app);

const userManager = new UserManager();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const io = new Server(server, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Health check endpoint for hosting platforms (Render, Railway, etc.)
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Omegle signaling server is active." });
});

app.get("/health", (_req, res) => {
    res.status(200).send("OK");
});

io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join", ({ name }: { name: string }) => {
        const sanitizedName = (name || "").trim() || "Anonymous";
        console.log(`User joined queue: ${sanitizedName} (${socket.id})`);
        userManager.addUser(sanitizedName, socket);
    });

    socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
        userManager.removeUser(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});