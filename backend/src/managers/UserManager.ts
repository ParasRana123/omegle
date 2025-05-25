import { Socket } from "socket.io"
import { RoomManager } from "./RoomManager";

export interface User {
    name: string;
    socket: Socket;
}

let GLOBAL_ROOM_ID = 1;

export class UserManager {
    private users: User[];
    private queue: String[];
    private roomManager: RoomManager;

    constructor() {
        this.users = [];
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(name: string , socket: Socket) {
        this.users.push({
            name , socket
        })
        this.queue.push(socket.id);
        socket.send("lobby");
        this.clearQueue();
        this.initHandlers(socket);
    }

    removeUser(socketId: string) {
        const user = this.users.find(x => x.socket.id === socketId);
        this.users = this.users.filter(x => x.socket.id !== socketId);
        this.queue = this.queue.filter(x => x === socketId);
    }

    clearQueue() {
        console.log("Inside clear queues");
        console.log(this.queue.length);
        if(this.queue.length < 2) {
            return;
        }

        console.log(this.users);
        console.log(this.queue);
        const id1 = this.queue.pop();
        const id2 = this.queue.pop();
        const user1 = this.users.find(x => x.socket.id === id1);
        const user2 = this.users.find(x => x.socket.id === id2);

        if(!user1 || !user2) {
            return;
        }

        console.log("Creating room");

        const room = this.roomManager.createRoom(user1 , user2);
        this.clearQueue();
    }

    generate() {
        return GLOBAL_ROOM_ID++;
    }

    initHandlers(socket: Socket) {
        socket.on("offer" , ({sdp , roomId}: {sdp: string , roomId: string}) => {
            console.log("Offer recieved");
            this.roomManager.onOffer(roomId , sdp);
        })
        socket.on("answer" , ({sdp , roomId}: {sdp: string , roomId: string}) => {
            console.log("Answer recieved");
            this.roomManager.onAnswer(roomId , sdp);
        })
    }
}