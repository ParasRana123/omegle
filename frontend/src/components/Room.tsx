import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";
import { ChatBox, type ChatMessage } from "./ChatBox";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

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

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "init-search",
            sender: "system",
            text: "Looking for someone you can chat with...",
            systemType: "searching"
        }
    ]);
    const [isStrangerTyping, setIsStrangerTyping] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteMediaStreamRef = useRef<MediaStream>(new MediaStream());
    const queuedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const roomIdRef = useRef<string | null>(null);
    const remoteNameRef = useRef<string>("");

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
            remoteNameRef.current = "";
            setPartnerDisconnected(false);
            setConnectionStatus("waiting");
            setIsStrangerTyping(false);
            cleanupPeerConnection();

            setMessages(prev => [
                ...prev,
                {
                    id: "lobby-" + Date.now(),
                    sender: "system",
                    text: "Looking for someone you can chat with...",
                    systemType: "searching"
                }
            ]);
        });

        // Server assigns this client as the OFFER INITIATOR
        socket.on("send-offer", async ({ roomId, remoteName: rName }: { roomId: string, remoteName: string }) => {
            console.log("Designated offer initiator for room:", roomId, "with peer:", rName);
            const peerName = rName || "Stranger";
            setLobby(false);
            setRemoteName(peerName);
            remoteNameRef.current = peerName;
            setPartnerDisconnected(false);
            setConnectionStatus("connecting");
            setIsStrangerTyping(false);

            setMessages(prev => [
                ...prev,
                {
                    id: "connected-" + Date.now(),
                    sender: "system",
                    text: `You're now chatting with ${peerName}. Say hi!`,
                    systemType: "connected"
                }
            ]);

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
            const peerName = rName || "Stranger";
            setLobby(false);
            setRemoteName(peerName);
            remoteNameRef.current = peerName;
            setPartnerDisconnected(false);
            setConnectionStatus("connecting");
            setIsStrangerTyping(false);

            setMessages(prev => [
                ...prev,
                {
                    id: "connected-" + Date.now(),
                    sender: "system",
                    text: `You're now chatting with ${peerName}. Say hi!`,
                    systemType: "connected"
                }
            ]);

            createPeerConnection(socket, roomId);
        });

        // Server delivers offer to the RECEIVER
        socket.on("offer", async ({ roomId, sdp, remoteName: rName }: { roomId: string, sdp: any, remoteName?: string }) => {
            console.log("Received offer from initiator for room:", roomId);
            setLobby(false);
            if (rName) {
                setRemoteName(rName);
                remoteNameRef.current = rName;
            }
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

        // Receive text chat message from peer
        socket.on("chat-message", ({ message, timestamp }: { message: string, senderName?: string, timestamp?: number }) => {
            const timeStr = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setMessages(prev => [
                ...prev,
                {
                    id: "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
                    sender: "stranger",
                    text: message,
                    time: timeStr
                }
            ]);
        });

        // Receive typing indicator from peer
        socket.on("typing", ({ isTyping }: { isTyping: boolean }) => {
            setIsStrangerTyping(Boolean(isTyping));
        });

        // Server informs that peer disconnected
        socket.on("peer-disconnected", () => {
            console.log("Partner disconnected");
            const pName = remoteNameRef.current || "Stranger";
            setPartnerDisconnected(true);
            setConnectionStatus("disconnected");
            setIsStrangerTyping(false);
            cleanupPeerConnection();

            setMessages(prev => [
                ...prev,
                {
                    id: "disc-" + Date.now(),
                    sender: "system",
                    text: `${pName} has disconnected.`,
                    systemType: "disconnected"
                }
            ]);
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

    const handleSendMessage = (text: string) => {
        if (!roomIdRef.current || !socketRef.current) return;

        socketRef.current.emit("chat-message", {
            roomId: roomIdRef.current,
            message: text
        });

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages(prev => [
            ...prev,
            {
                id: "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
                sender: "you",
                text: text,
                time: timeStr
            }
        ]);
    };

    const handleTyping = (isTyping: boolean) => {
        if (!roomIdRef.current || !socketRef.current) return;
        socketRef.current.emit("typing", {
            roomId: roomIdRef.current,
            isTyping
        });
    };

    const handleNext = () => {
        cleanupPeerConnection();
        setLobby(true);
        setPartnerDisconnected(false);
        setRemoteName("");
        remoteNameRef.current = "";
        setConnectionStatus("waiting");
        setIsStrangerTyping(false);

        setMessages(prev => [
            ...prev,
            {
                id: "next-" + Date.now(),
                sender: "system",
                text: "Looking for someone you can chat with...",
                systemType: "searching"
            }
        ]);

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
        <div className="omegle-page" style={styles.page}>
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

            {/* Split Screen Layout (Left: Videos, Right: Live Text Chat) */}
            <main className="omegle-main-container" style={styles.mainContainer}>
                {/* Left Half: Video Stream Column */}
                <section className="omegle-video-column" style={styles.videoColumn}>
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

                    {/* Media Controls Bar */}
                    <div style={styles.mediaControlsBar}>
                        <button
                            onClick={toggleAudio}
                            style={{
                                ...styles.mediaControlBtn,
                                backgroundColor: isAudioMuted ? "#ef4444" : "#1e293b",
                                borderColor: isAudioMuted ? "#ef4444" : "#475569"
                            }}
                            title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
                        >
                            {isAudioMuted ? "🔇 Unmute Mic" : "🎤 Mute Mic"}
                        </button>

                        <button
                            onClick={toggleVideo}
                            style={{
                                ...styles.mediaControlBtn,
                                backgroundColor: isVideoMuted ? "#ef4444" : "#1e293b",
                                borderColor: isVideoMuted ? "#ef4444" : "#475569"
                            }}
                            title={isVideoMuted ? "Turn Video On" : "Turn Video Off"}
                        >
                            {isVideoMuted ? "📷 Enable Video" : "📹 Disable Video"}
                        </button>

                        <button
                            onClick={handleNext}
                            style={styles.nextBtnCompact}
                            title="Skip to next stranger (Esc)"
                        >
                            ⏭️ Next Stranger
                        </button>
                    </div>
                </section>

                {/* Right Half: Live Text Chat Column */}
                <section className="omegle-chat-column" style={styles.chatColumn}>
                    <ChatBox
                        messages={messages}
                        isStrangerTyping={isStrangerTyping}
                        isConnected={connectionStatus === "connected" || (!lobby && !partnerDisconnected)}
                        isLobby={lobby}
                        isPartnerDisconnected={partnerDisconnected}
                        remoteName={remoteName || "Stranger"}
                        onSendMessage={handleSendMessage}
                        onNext={handleNext}
                        onTyping={handleTyping}
                    />
                </section>
            </main>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    page: {
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxHeight: "100vh",
        background: "radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)",
        color: "#f8fafc",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        overflow: "hidden",
    },
    navbar: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 24px",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        flexShrink: 0,
        height: "56px",
        boxSizing: "border-box",
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
        fontSize: "13px",
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
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    mainContainer: {
        flex: 1,
        display: "flex",
        flexDirection: "row",
        padding: "16px 20px",
        maxWidth: "1500px",
        width: "100%",
        margin: "0 auto",
        boxSizing: "border-box",
        gap: "18px",
        height: "calc(100vh - 56px)",
        overflow: "hidden",
    },
    videoColumn: {
        flex: "1 1 50%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        height: "100%",
        minWidth: "320px",
    },
    chatColumn: {
        flex: "1 1 50%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: "320px",
    },
    videoTile: {
        flex: 1,
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(8px)",
        borderRadius: "14px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 20px rgba(0, 0, 0, 0.3)",
        minHeight: "180px",
    },
    tileHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 12px",
        background: "rgba(15, 23, 42, 0.65)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    },
    tileBadgeYou: {
        background: "rgba(99, 102, 241, 0.2)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        color: "#a5b4fc",
        fontSize: "12px",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "6px",
    },
    tileBadgeStranger: {
        background: "rgba(168, 85, 247, 0.2)",
        border: "1px solid rgba(168, 85, 247, 0.4)",
        color: "#d8b4fe",
        fontSize: "12px",
        fontWeight: 600,
        padding: "2px 8px",
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
        gap: "10px",
        color: "#94a3b8",
        fontSize: "13px",
        background: "#090d16",
    },
    mediaControlsBar: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        background: "rgba(30, 41, 59, 0.8)",
        backdropFilter: "blur(12px)",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
        flexShrink: 0,
    },
    mediaControlBtn: {
        padding: "8px 14px",
        borderRadius: "8px",
        border: "1px solid #475569",
        color: "#ffffff",
        fontSize: "12.5px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
    },
    nextBtnCompact: {
        padding: "8px 16px",
        borderRadius: "8px",
        border: "none",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        color: "#ffffff",
        fontSize: "12.5px",
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 2px 8px rgba(79, 70, 229, 0.4)",
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