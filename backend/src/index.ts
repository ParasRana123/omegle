import { Socket } from "socket.io";
import http from "http";

import express from "express";
import { Server } from "socket.io";
import { UserManager } from "./managers/UserManager";

const app = express();
const server = http.createServer(http);

const userManager = new UserManager();

const io = new Server(server , {
    cors: {
        origin: "*"
    }
});

io.on("connection" , (socket: Socket) => {
    console.log("User connected");
    userManager.addUser("randomUser" , socket);
    socket.on("disconnect" , () => {
        userManager.removeUser(socket.id);
    })
});

server.listen(3001 , () => {
    console.log("Listening on 3001");
})