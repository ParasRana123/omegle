import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom"

export function Landing() {
    const [name , setName] = useState("");
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [joined , setJoined] = useState(false);

    const getCam = async() => {
        const stream = await window.navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        })
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getAudioTracks()[0];
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);
        if(!videoRef.current) {
            return;
        }
        videoRef.current.srcObject = new MediaStream([videoTrack]);
    }

    useEffect(() => {
        if(videoRef && videoRef.current) {
            getCam();
        }
    } , [videoRef])

    return <div>
        <video ref={videoRef}></video>
        <input type="text" onChange={(e) => {
            setName(e.target.value);
        }}>
        </input>
        <Link to={`/room/?name=${name}`}>Join</Link>
    </div>;
}