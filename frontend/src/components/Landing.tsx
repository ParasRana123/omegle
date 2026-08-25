import { useEffect, useRef, useState } from "react";
import { Room } from "./Room";

export function Landing() {
    const [name, setName] = useState("");
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [joined, setJoined] = useState(false);

    const getCam = async () => {
        const stream = await window.navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        setLocalAudioTrack(audioTrack);
        setLocalVideoTrack(videoTrack);
        if (!videoRef.current) {
            return;
        }
        videoRef.current.srcObject = new MediaStream([videoTrack]);
        videoRef.current.play();
    };

    useEffect(() => {
        if (videoRef && videoRef.current) {
            getCam();
        }
    }, [videoRef]);

    if (!joined) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <h1 style={styles.title}>Start a video chat</h1>
                    <video
                        autoPlay
                        muted
                        ref={videoRef}
                        style={styles.previewVideo}
                    />
                    <input
                        type="text"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={styles.input}
                    />
                    <button
                        onClick={() => setJoined(true)}
                        style={styles.button}
                    >
                        Join
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Room
            name={name}
            localAudioTrack={localAudioTrack}
            localVideoTrack={localVideoTrack}
        />
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    page: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#111827",
        fontFamily: "sans-serif",
    },
    card: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        background: "#1f2937",
        padding: "32px",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
    },
    title: {
        color: "#f9fafb",
        margin: 0,
    },
    previewVideo: {
        width: "320px",
        height: "240px",
        borderRadius: "12px",
        background: "#000",
        objectFit: "cover",
    },
    input: {
        padding: "10px 14px",
        borderRadius: "8px",
        border: "1px solid #374151",
        outline: "none",
        width: "260px",
        fontSize: "14px",
    },
    button: {
        padding: "10px 24px",
        borderRadius: "8px",
        border: "none",
        background: "#6366f1",
        color: "white",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: "14px",
    },
};