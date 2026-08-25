import http from "http";
import express from "express";
import { Server, Socket } from "socket.io";
import { UserManager } from "./managers/UserManager";

const app = express();
const server = http.createServer(app);

const userManager = new UserManager();

const io = new Server(server, {
    cors: {
        origin: "*"
    }
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