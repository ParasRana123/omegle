import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom"
import { io, Socket } from "socket.io-client"

const URL = "http://localhost:3001"

export function Room() {
    const [searchParams , setSearchParams] = useSearchParams();
    const name = searchParams.get('name');
    const [socket , setSocket] = useState<null | Socket>(null);
    const [lobby , setLobby] = useState(true);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);

    useEffect(() => {
        const socket = io(URL);
        setSocket(socket);

        socket.on("send-offer" , async ({roomId}) => {
            alert("Send offer please");
            setLobby(false);
            const pc = new RTCPeerConnection();
            setSendingPc(pc);

            // This side will send an offer to the other side
            const sdp = await pc.createOffer();
            socket.emit("offer" , {
                sdp,
                roomId
            })
        })

        socket.on("offer" , async ({roomId , offer}) => {
            alert("Send answer please");
            setLobby(false);
            // this side will receive the offer and then send the answer object very similar to the CreateOffer object
            const pc = new RTCPeerConnection();
            pc.setRemoteDescription({sdp: offer , type: "offer"});
            const sdp = await pc.createAnswer();
            setReceivingPc(pc);
            pc.ontrack = ({track , type}) => {
                if(type == "audio") {
                    setRemoteAudioTrack(track);
                } else {
                    setRemoteVideoTrack(track);
                }
            }
            socket.emit("answer" , {
                roomId,
                sdp: sdp
            })
        })

        socket.on("answer" , ({roomId , answer}) => {
            setLobby(false);
            setSendingPc(pc => {
                pc?.setRemoteDescription({
                    type: "answer",
                    sdp: answer
                })
                return pc;
            })
        })

        socket.on("lobby" , () => {
            setLobby(true);
        })
        setSocket(socket);
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