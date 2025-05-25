import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom"
import { io, Socket } from "socket.io-client"

const URL = "http://localhost:3001"

export function Room() {
    const [searchParams , setSearchParams] = useSearchParams();
    const name = searchParams.get('name');
    const [socket , setSocket] = useState<null | Socket>(null);
    const {lobby , setLobby} = useState(true);

    useEffect(() => {
        // logic to init the user to the room
        const socket = io(URL);
        setSocket(socket);

        socket.on("send-offer" , ({roomId}) => {
            alert("Send offer please");
            setLobby(false);
            socket.emit("offer" , {
                sdp: "",
                roomId
            })
        })

        socket.on("offer" , ({roomId , offer}) => {
            alert("Send answer please");
            setLobby(false);
            socket.emit("answer" , {
                sdp: "",
                roomId
            })
        })

        socket.on("answer" , ({roomId , answer}) => {
            alert("Connection done");
            setLobby(false);
        })

        socket.on("lobby" , () => {
            setLobby(true);
        })


    } , [name])

    if(!lobby) {
        return <div>
            Waiting to connect
        </div>
    }

    return <div>
        Hi {name}
        <video width={400} height={400} />
        <video width={400} height={400} />
    </div>
}