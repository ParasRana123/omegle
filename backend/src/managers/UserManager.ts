import { Socket } from "socket.io";
import { RoomManager } from "./RoomManager";

export interface User {
    socket: Socket;
    name: string;
}

export class UserManager {
    private users: User[];
    private queue: string[];
    private roomManager: RoomManager;
    
    constructor() {
        this.users = [];
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(name: string, socket: Socket) {
        // Clean up previous registration for this socket if any
        this.users = this.users.filter(x => x.socket.id !== socket.id);
        this.queue = this.queue.filter(x => x !== socket.id);

        this.users.push({
            name,
            socket
        });

        this.queue.push(socket.id);
        socket.emit("lobby");
        this.initHandlers(socket);
        this.clearQueue();
    }

    removeUser(socketId: string) {
        this.users = this.users.filter(x => x.socket.id !== socketId);
        this.queue = this.queue.filter(x => x !== socketId);
        this.roomManager.onUserDisconnected(socketId);
    }

    requeueUser(socketId: string) {
        const user = this.users.find(x => x.socket.id === socketId);
        if (!user) return;
        
        this.roomManager.leaveRoom(socketId);
        if (!this.queue.includes(socketId)) {
            this.queue.push(socketId);
        }
        user.socket.emit("lobby");
        this.clearQueue();
    }

    clearQueue() {
        // Clean queue of disconnected sockets
        this.queue = this.queue.filter(id => {
            const u = this.users.find(x => x.socket.id === id);
            return u && u.socket.connected;
        });

        if (this.queue.length < 2) {
            return;
        }

        const id1 = this.queue.shift();
        const id2 = this.queue.shift();

        if (!id1 || !id2) {
            return;
        }

        const user1 = this.users.find(x => x.socket.id === id1);
        const user2 = this.users.find(x => x.socket.id === id2);

        if (!user1 || !user2) {
            // Put back the valid one if any
            if (user1) this.queue.unshift(id1);
            if (user2) this.queue.unshift(id2);
            return;
        }

        this.roomManager.createRoom(user1, user2);

        // Continue matching if there are more people waiting
        if (this.queue.length >= 2) {
            this.clearQueue();
        }
    }

    initHandlers(socket: Socket) {
        // Remove existing listeners to avoid multiple event triggers
        socket.removeAllListeners("offer");
        socket.removeAllListeners("answer");
        socket.removeAllListeners("add-ice-candidate");
        socket.removeAllListeners("next");

        socket.on("offer", ({ sdp, roomId }: { sdp: any, roomId: string }) => {
            this.roomManager.onOffer(roomId, sdp, socket.id);
        });

        socket.on("answer", ({ sdp, roomId }: { sdp: any, roomId: string }) => {
            this.roomManager.onAnswer(roomId, sdp, socket.id);
        });

        socket.on("add-ice-candidate", ({ candidate, roomId }: { candidate: any, roomId: string }) => {
            this.roomManager.onIceCandidates(roomId, socket.id, candidate);
        });

        socket.on("next", () => {
            console.log(`User requested next: ${socket.id}`);
            this.requeueUser(socket.id);
        });
    }
}