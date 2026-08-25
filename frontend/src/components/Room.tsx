import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001";

interface RoomProps {
    name: string;
    localAudioTrack: MediaStreamTrack | null;
    localVideoTrack: MediaStreamTrack | null;
    onLeave?: () => void;
}

export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack,
    onLeave
}: RoomProps) => {
    const [lobby, setLobby] = useState(true);
    const [remoteName, setRemoteName] = useState<string>("");
    const [partnerDisconnected, setPartnerDisconnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string>("waiting");
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteMediaStreamRef = useRef<MediaStream>(new MediaStream());
    const queuedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const roomIdRef = useRef<string | null>(null);

    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const localVideoRef = useRef<HTMLVideoElement | null>(null);

    const cleanupPeerConnection = () => {
        if (pcRef.current) {
            pcRef.current.onicecandidate = null;
            pcRef.current.ontrack = null;
            pcRef.current.onconnectionstatechange = null;
            pcRef.current.close();
            pcRef.current = null;
        }
        queuedIceCandidatesRef.current = [];
        roomIdRef.current = null;

        // Clear remote stream tracks
        if (remoteMediaStreamRef.current) {
            remoteMediaStreamRef.current.getTracks().forEach(track => track.stop());
            remoteMediaStreamRef.current = new MediaStream();
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    };

    const createPeerConnection = (socket: Socket, roomId: string): RTCPeerConnection => {
        cleanupPeerConnection();

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" }
            ]
        });

        pcRef.current = pc;
        roomIdRef.current = roomId;

        // Add local media tracks
        if (localVideoTrack) {
            pc.addTrack(localVideoTrack);
        }
        if (localAudioTrack) {
            pc.addTrack(localAudioTrack);
        }

        // Setup remote stream
        const remoteStream = new MediaStream();
        remoteMediaStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }

        pc.ontrack = (event) => {
            console.log("Received remote track:", event.track.kind);
            if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
                remoteStream.addTrack(event.track);
            }
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(e => console.log("Remote play error:", e));
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("add-ice-candidate", {
                    candidate: event.candidate,
                    roomId
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log("Connection state:", pc.connectionState);
            if (pc.connectionState === "connected") {
                setConnectionStatus("connected");
            } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                setConnectionStatus("disconnected");
            }
        };

        return pc;
    };

    useEffect(() => {
        const socket = io(SOCKET_URL);
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to signaling server with ID:", socket.id);
            socket.emit("join", { name });
        });

        socket.on("lobby", () => {
            console.log("In lobby waiting for peer...");
            setLobby(true);
            setRemoteName("");
            setPartnerDisconnected(false);
            setConnectionStatus("waiting");
            cleanupPeerConnection();
        });

        // Server assigns this client as the OFFER INITIATOR
        socket.on("send-offer", async ({ roomId, remoteName: rName }: { roomId: string, remoteName: string }) => {
            console.log("Designated offer initiator for room:", roomId, "with peer:", rName);
            setLobby(false);
            setRemoteName(rName || "Stranger");
            setPartnerDisconnected(false);
            setConnectionStatus("connecting");

            try {
                const pc = createPeerConnection(socket, roomId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("offer", { roomId, sdp: offer });
            } catch (err) {
                console.error("Error creating offer:", err);
            }
        });

        // Server informs receiver that room is matched
        socket.on("room-joined", ({ roomId, remoteName: rName }: { roomId: string, remoteName: string }) => {
            console.log("Joined room:", roomId, "with peer:", rName);
            setLobby(false);
            setRemoteName(rName || "Stranger");
            setPartnerDisconnected(false);
            setConnectionStatus("connecting");
            createPeerConnection(socket, roomId);
        });

        // Server delivers offer to the RECEIVER
        socket.on("offer", async ({ roomId, sdp, remoteName: rName }: { roomId: string, sdp: any, remoteName?: string }) => {
            console.log("Received offer from initiator for room:", roomId);
            setLobby(false);
            if (rName) setRemoteName(rName);
            setPartnerDisconnected(false);
            setConnectionStatus("connecting");

            try {
                let pc = pcRef.current;
                if (!pc) {
                    pc = createPeerConnection(socket, roomId);
                }

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                // Process any ICE candidates received prior to setting remote description
                for (const candidate of queuedIceCandidatesRef.current) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Queued candidate error:", e));
                }
                queuedIceCandidatesRef.current = [];

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit("answer", { roomId, sdp: answer });
            } catch (err) {
                console.error("Error handling offer and creating answer:", err);
            }
        });

        // Server delivers answer back to the INITIATOR
        socket.on("answer", async ({ roomId, sdp }: { roomId: string, sdp: any }) => {
            console.log("Received answer for room:", roomId);
            try {
                const pc = pcRef.current;
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                    // Process any ICE candidates received prior to setting remote description
                    for (const candidate of queuedIceCandidatesRef.current) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Queued candidate error:", e));
                    }
                    queuedIceCandidatesRef.current = [];
                }
            } catch (err) {
                console.error("Error handling answer:", err);
            }
        });

        // Server routes ICE candidates between peers
        socket.on("add-ice-candidate", async ({ candidate }: { candidate: any }) => {
            const pc = pcRef.current;
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error("Error adding ice candidate:", e);
                }
            } else {
                queuedIceCandidatesRef.current.push(candidate);
            }
        });

        // Server informs that peer disconnected
        socket.on("peer-disconnected", () => {
            console.log("Partner disconnected");
            setPartnerDisconnected(true);
            setConnectionStatus("disconnected");
            cleanupPeerConnection();
        });

        return () => {
            cleanupPeerConnection();
            socket.disconnect();
        };
    }, [name, localAudioTrack, localVideoTrack]);

    // Handle local video playback
    useEffect(() => {
        if (localVideoRef.current && localVideoTrack) {
            localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
            localVideoRef.current.play().catch(() => {});
        }
    }, [localVideoTrack]);

    const handleNext = () => {
        cleanupPeerConnection();
        setLobby(true);
        setPartnerDisconnected(false);
        setRemoteName("");
        setConnectionStatus("waiting");
        socketRef.current?.emit("next");
    };

    const handleLeave = () => {
        cleanupPeerConnection();
        socketRef.current?.disconnect();
        if (onLeave) {
            onLeave();
        }
    };

    const toggleAudio = () => {
        if (localAudioTrack) {
            localAudioTrack.enabled = !localAudioTrack.enabled;
            setIsAudioMuted(!localAudioTrack.enabled);
        }
    };

    const toggleVideo = () => {
        if (localVideoTrack) {
            localVideoTrack.enabled = !localVideoTrack.enabled;
            setIsVideoMuted(!localVideoTrack.enabled);
        }
    };

    return (
        <div style={styles.page}>
            {/* Top Navigation Bar */}
            <header style={styles.navbar}>
                <div style={styles.brandContainer}>
                    <span style={styles.brandLogo}>Omegle</span>
                    <span style={styles.brandBadge}>Live</span>
                </div>
                <div style={styles.navUser}>
                    <span style={styles.navUserDot}></span>
                    <span style={styles.navUserName}>Logged in as <strong>{name}</strong></span>
                </div>
                <button onClick={handleLeave} style={styles.leaveButton}>
                    Exit Room
                </button>
            </header>

            {/* Main Content Area */}
            <main style={styles.mainContainer}>
                {/* Status Bar */}
                <div style={styles.statusCard}>
                    {lobby ? (
                        <div style={styles.lobbyBanner}>
                            <span style={styles.spinner}></span>
                            <span>Looking for a stranger to pair with...</span>
                        </div>
                    ) : partnerDisconnected ? (
                        <div style={styles.disconnectedBanner}>
                            <span>⚠️ <strong>{remoteName || "Stranger"}</strong> has disconnected.</span>
                            <button onClick={handleNext} style={styles.nextButtonInline}>
                                Find Next Stranger ⏭️
                            </button>
                        </div>
                    ) : (
                        <div style={styles.connectedBanner}>
                            <span>🟢 Connected with <strong>{remoteName || "Stranger"}</strong></span>
                        </div>
                    )}
                </div>

                {/* Video Tiles Grid */}
                <div style={styles.videoGrid}>
                    {/* Local Video Tile */}
                    <div style={styles.videoTile}>
                        <div style={styles.tileHeader}>
                            <span style={styles.tileBadgeYou}>You ({name})</span>
                            <span style={styles.tileStatusBadge}>
                                {isVideoMuted ? "📷 Off" : "📷 On"} | {isAudioMuted ? "🔇 Muted" : "🎤 On"}
                            </span>
                        </div>
                        <div style={styles.videoWrapper}>
                            <video
                                autoPlay
                                playsInline
                                muted
                                ref={localVideoRef}
                                style={{
                                    ...styles.videoElement,
                                    transform: "scaleX(-1)", // Mirror selfie view
                                    opacity: isVideoMuted ? 0 : 1
                                }}
                            />
                            {isVideoMuted ? (
                                <div style={styles.videoOffPlaceholder}>
                                    <span>Camera Turned Off</span>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Remote Video Tile */}
                    <div style={styles.videoTile}>
                        <div style={styles.tileHeader}>
                            <span style={styles.tileBadgeStranger}>
                                {remoteName ? `${remoteName} (Stranger)` : "Stranger"}
                            </span>
                            <span style={styles.tileStatusBadge}>
                                {!lobby && !partnerDisconnected ? (connectionStatus === "connected" ? "🟢 Connected" : "🟡 Connecting...") : "🟡 Waiting"}
                            </span>
                        </div>
                        <div style={styles.videoWrapper}>
                            <video
                                autoPlay
                                playsInline
                                ref={remoteVideoRef}
                                style={{
                                    ...styles.videoElement,
                                    opacity: (lobby || partnerDisconnected) ? 0 : 1
                                }}
                            />
                            {lobby ? (
                                <div style={styles.videoOffPlaceholder}>
                                    <span style={styles.spinner}></span>
                                    <span>Waiting for stranger to connect...</span>
                                </div>
                            ) : partnerDisconnected ? (
                                <div style={styles.videoOffPlaceholder}>
                                    <span style={{ fontSize: "28px" }}>👋</span>
                                    <span>Stranger disconnected</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Controls Footer */}
                <div style={styles.controlsBar}>
                    <button
                        onClick={toggleAudio}
                        style={{
                            ...styles.controlBtn,
                            backgroundColor: isAudioMuted ? "#ef4444" : "#334155"
                        }}
                        title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                        {isAudioMuted ? "🔇 Unmute Mic" : "🎤 Mute Mic"}
                    </button>

                    <button
                        onClick={toggleVideo}
                        style={{
                            ...styles.controlBtn,
                            backgroundColor: isVideoMuted ? "#ef4444" : "#334155"
                        }}
                        title={isVideoMuted ? "Turn Video On" : "Turn Video Off"}
                    >
                        {isVideoMuted ? "📷 Enable Video" : "📹 Disable Video"}
                    </button>

                    <button
                        onClick={handleNext}
                        style={styles.nextBtn}
                        title="Skip to next stranger"
                    >
                        ⏭️ Next Stranger
                    </button>

                    <button
                        onClick={handleLeave}
                        style={styles.exitBtn}
                        title="Leave video chat"
                    >
                        🚪 Leave Chat
                    </button>
                </div>
            </main>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    page: {
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)",
        color: "#f8fafc",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    navbar: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 28px",
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    },
    brandContainer: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    brandLogo: {
        fontSize: "20px",
        fontWeight: 800,
        letterSpacing: "0.5px",
        background: "linear-gradient(135deg, #6366f1, #a855f7)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
    },
    brandBadge: {
        background: "#ef4444",
        color: "#ffffff",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "2px 6px",
        borderRadius: "4px",
    },
    navUser: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "14px",
        color: "#cbd5e1",
    },
    navUserDot: {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: "#22c55e",
        display: "inline-block",
    },
    navUserName: {
        color: "#e2e8f0",
    },
    leaveButton: {
        padding: "6px 14px",
        borderRadius: "8px",
        border: "1px solid #475569",
        background: "transparent",
        color: "#e2e8f0",
        fontSize: "13px",
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    mainContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 24px 32px 24px",
        maxWidth: "1200px",
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box",
        gap: "16px",
    },
    statusCard: {
        width: "100%",
        maxWidth: "960px",
    },
    lobbyBanner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: "rgba(59, 130, 246, 0.15)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
        color: "#93c5fd",
        padding: "10px 20px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: 500,
    },
    connectedBanner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: "rgba(34, 197, 94, 0.15)",
        border: "1px solid rgba(34, 197, 94, 0.3)",
        color: "#86efac",
        padding: "10px 20px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: 500,
    },
    disconnectedBanner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        color: "#fca5a5",
        padding: "8px 20px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: 500,
    },
    nextButtonInline: {
        padding: "6px 14px",
        borderRadius: "8px",
        border: "none",
        background: "#4f46e5",
        color: "#fff",
        fontWeight: 600,
        fontSize: "12px",
        cursor: "pointer",
    },
    videoGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: "20px",
        width: "100%",
        maxWidth: "960px",
        flex: 1,
    },
    videoTile: {
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(8px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
        height: "380px",
    },
    tileHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        background: "rgba(15, 23, 42, 0.6)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    },
    tileBadgeYou: {
        background: "rgba(99, 102, 241, 0.2)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        color: "#a5b4fc",
        fontSize: "12px",
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: "6px",
    },
    tileBadgeStranger: {
        background: "rgba(168, 85, 247, 0.2)",
        border: "1px solid rgba(168, 85, 247, 0.4)",
        color: "#d8b4fe",
        fontSize: "12px",
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: "6px",
    },
    tileStatusBadge: {
        fontSize: "11px",
        color: "#94a3b8",
    },
    videoWrapper: {
        position: "relative",
        width: "100%",
        flex: 1,
        background: "#090d16",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    videoElement: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
    },
    videoOffPlaceholder: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        color: "#94a3b8",
        fontSize: "13px",
        background: "#090d16",
    },
    controlsBar: {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "12px",
        padding: "12px 24px",
        background: "rgba(30, 41, 59, 0.8)",
        backdropFilter: "blur(12px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
        marginTop: "8px",
    },
    controlBtn: {
        padding: "10px 18px",
        borderRadius: "10px",
        border: "none",
        color: "#ffffff",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    nextBtn: {
        padding: "10px 22px",
        borderRadius: "10px",
        border: "none",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
        transition: "all 0.2s ease",
    },
    exitBtn: {
        padding: "10px 18px",
        borderRadius: "10px",
        border: "1px solid #475569",
        background: "#1e293b",
        color: "#cbd5e1",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    spinner: {
        width: "14px",
        height: "14px",
        border: "2px solid rgba(255, 255, 255, 0.2)",
        borderTopColor: "#ffffff",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 1s linear infinite",
    },
};