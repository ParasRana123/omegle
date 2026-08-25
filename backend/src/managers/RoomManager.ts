import { User } from "./UserManager";

let GLOBAL_ROOM_ID = 1;

export interface Room {
    user1: User;
    user2: User;
}

export class RoomManager {
    private rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map<string, Room>();
    }

    createRoom(user1: User, user2: User) {
        const roomId = this.generate().toString();
        this.rooms.set(roomId, {
            user1, 
            user2,
        });

        // user1 is the offerer/initiator
        user1.socket.emit("send-offer", {
            roomId,
            remoteName: user2.name
        });

        // user2 is the receiver/answerer
        user2.socket.emit("room-joined", {
            roomId,
            remoteName: user1.name
        });

        console.log(`Room created: ${roomId} between ${user1.name} (${user1.socket.id}) and ${user2.name} (${user2.socket.id})`);
    }

    onOffer(roomId: string, sdp: any, senderSocketId: string) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        const sendingUser = room.user1.socket.id === senderSocketId ? room.user1 : room.user2;

        receivingUser.socket.emit("offer", {
            sdp,
            roomId,
            remoteName: sendingUser.name
        });
    }
    
    onAnswer(roomId: string, sdp: any, senderSocketId: string) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;

        receivingUser.socket.emit("answer", {
            sdp,
            roomId
        });
    }

    onIceCandidates(roomId: string, senderSocketId: string, candidate: any) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        receivingUser.socket.emit("add-ice-candidate", { candidate });
    }

    onUserDisconnected(socketId: string): User | null {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.user1.socket.id === socketId || room.user2.socket.id === socketId) {
                const remainingUser = room.user1.socket.id === socketId ? room.user2 : room.user1;
                console.log(`User ${socketId} left/disconnected from room ${roomId}. Informing ${remainingUser.name}`);
                remainingUser.socket.emit("peer-disconnected");
                this.rooms.delete(roomId);
                return remainingUser;
            }
        }
        return null;
    }

    leaveRoom(socketId: string): User | null {
        return this.onUserDisconnected(socketId);
    }

    generate() {
        return GLOBAL_ROOM_ID++;
    }
}