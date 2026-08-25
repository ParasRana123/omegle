import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";

const URL = "http://localhost:3001";

export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
}) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const socket = io(URL);

        socket.on('send-offer', async ({ roomId }) => {
            console.log("sending offer");
            setLobby(false);
            const pc = new RTCPeerConnection();
            setSendingPc(pc);

            if (localVideoTrack) pc.addTrack(localVideoTrack);
            if (localAudioTrack) pc.addTrack(localAudioTrack);

            // Prepare a stream to receive the remote tracks on THIS pc too
            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }

            pc.ontrack = (e) => {
                console.log("ontrack (sender side)", e.track.kind);
                remoteStream.addTrack(e.track);
                remoteVideoRef.current?.play().catch(() => {});
            };

            pc.onicecandidate = async (e) => {
                if (e.candidate) {
                    socket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "sender",
                        roomId
                    });
                }
            };

            pc.onnegotiationneeded = async () => {
                console.log("on negotiation needed, sending offer");
                const sdp = await pc.createOffer();
                await pc.setLocalDescription(sdp);
                socket.emit("offer", { sdp, roomId });
            };
        });

        socket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
            console.log("received offer");
            setLobby(false);
            const pc = new RTCPeerConnection();
            setReceivingPc(pc);
            window.pcr = pc;

            await pc.setRemoteDescription(remoteSdp);

            const remoteStream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }

            pc.ontrack = (e) => {
                console.log("ontrack (receiver side)", e.track.kind);
                remoteStream.addTrack(e.track);
                remoteVideoRef.current?.play().catch(() => {});
            };

            // Also send our own tracks back so it's a real 2-way call
            if (localVideoTrack) pc.addTrack(localVideoTrack);
            if (localAudioTrack) pc.addTrack(localAudioTrack);

            const sdp = await pc.createAnswer();
            await pc.setLocalDescription(sdp);

            pc.onicecandidate = async (e) => {
                if (!e.candidate) return;
                socket.emit("add-ice-candidate", {
                    candidate: e.candidate,
                    type: "receiver",
                    roomId
                });
            };

            socket.emit("answer", { roomId, sdp });
        });

        socket.on("answer", ({ roomId, sdp: remoteSdp }) => {
            setLobby(false);
            setSendingPc(pc => {
                pc?.setRemoteDescription(remoteSdp);
                return pc;
            });
            console.log("loop closed");
        });

        socket.on("lobby", () => {
            setLobby(true);
        });

        socket.on("add-ice-candidate", ({ candidate, type }) => {
            if (type == "sender") {
                setReceivingPc(pc => {
                    pc?.addIceCandidate(candidate);
                    return pc;
                });
            } else {
                setSendingPc(pc => {
                    pc?.addIceCandidate(candidate);
                    return pc;
                });
            }
        });

        setSocket(socket);

        return () => {
            socket.disconnect();
        };
    }, [name]);

    // FIX: depend on localVideoTrack, not the ref (which never changes identity)
    useEffect(() => {
        if (localVideoRef.current && localVideoTrack) {
            localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
            localVideoRef.current.play().catch(() => {});
        }
    }, [localVideoTrack]);

    return (
        <div style={styles.page}>
            <h2 style={styles.heading}>Hi {name}</h2>
            {lobby ? (
                <p style={styles.lobbyText}>Waiting to connect you to someone...</p>
            ) : null}
            <div style={styles.videoRow}>
                <div style={styles.videoBox}>
                    <video autoPlay muted ref={localVideoRef} style={styles.video} />
                    <span style={styles.label}>You</span>
                </div>
                <div style={styles.videoBox}>
                    <video autoPlay ref={remoteVideoRef} style={styles.video} />
                    <span style={styles.label}>Remote</span>
                </div>
            </div>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    page: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        background: "#111827",
        fontFamily: "sans-serif",
        padding: "24px",
    },
    heading: { color: "#f9fafb", marginBottom: "8px" },
    lobbyText: { color: "#9ca3af", marginBottom: "16px" },
    videoRow: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "24px",
        marginTop: "16px",
    },
    videoBox: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
    },
    video: {
        width: "400px",
        height: "400px",
        borderRadius: "12px",
        background: "#000",
        objectFit: "cover",
        border: "2px solid #374151",
    },
    label: { color: "#d1d5db", fontSize: "14px", fontWeight: 600 },
};