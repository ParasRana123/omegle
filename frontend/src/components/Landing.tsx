import { useEffect, useRef, useState } from "react";
import { Room } from "./Room";

export function Landing() {
    const [name, setName] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [mediaError, setMediaError] = useState("");
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [joined, setJoined] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);

    const getCam = async () => {
        try {
            const stream = await window.navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            const audioTrack = stream.getAudioTracks()[0] || null;
            const videoTrack = stream.getVideoTracks()[0] || null;
            setLocalAudioTrack(audioTrack);
            setLocalVideoTrack(videoTrack);
            if (videoRef.current && videoTrack) {
                videoRef.current.srcObject = new MediaStream([videoTrack]);
                videoRef.current.play().catch(() => {});
            }
            setCameraReady(true);
            setMediaError("");
        } catch (err: any) {
            console.error("Camera/Mic access error:", err);
            setMediaError("Unable to access camera/mic. Please ensure device permissions are allowed.");
        }
    };

    useEffect(() => {
        getCam();
    }, []);

    useEffect(() => {
        if (videoRef.current && localVideoTrack) {
            videoRef.current.srcObject = new MediaStream([localVideoTrack]);
            videoRef.current.play().catch(() => {});
        }
    }, [localVideoTrack, joined]);

    const handleJoin = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setErrorMsg("Please enter your name before joining.");
            return;
        }
        if (trimmed.length < 2) {
            setErrorMsg("Name must be at least 2 characters.");
            return;
        }
        setErrorMsg("");
        setJoined(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleJoin();
        }
    };

    if (!joined) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <div style={styles.header}>
                        <div style={styles.logoBadge}>Omegle 2.0</div>
                        <h1 style={styles.title}>Start Video Chat</h1>
                        <p style={styles.subtitle}>Meet and talk with random strangers around the globe</p>
                    </div>

                    <div style={styles.videoPreviewContainer}>
                        <video
                            autoPlay
                            playsInline
                            muted
                            ref={videoRef}
                            style={styles.previewVideo}
                        />
                        <div style={styles.videoOverlay}>
                            <span style={styles.videoBadge}>
                                {cameraReady ? "🟢 Camera Ready" : "🟡 Initializing..."}
                            </span>
                        </div>
                    </div>

                    {mediaError ? (
                        <div style={styles.mediaWarning}>
                            ⚠️ {mediaError}
                        </div>
                    ) : null}

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Your Display Name <span style={{ color: "#ef4444" }}>*</span></label>
                        <input
                            type="text"
                            placeholder="Enter your name (required)"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (errorMsg) setErrorMsg("");
                            }}
                            onKeyDown={handleKeyDown}
                            style={{
                                ...styles.input,
                                ...(errorMsg ? styles.inputError : {})
                            }}
                            autoFocus
                        />
                        {errorMsg ? (
                            <span style={styles.errorText}>{errorMsg}</span>
                        ) : null}
                    </div>

                    <button
                        onClick={handleJoin}
                        style={{
                            ...styles.button,
                            opacity: name.trim() ? 1 : 0.65,
                            cursor: name.trim() ? "pointer" : "not-allowed"
                        }}
                    >
                        Join Video Chat
                    </button>
                </div>
            </div>
        );
    }

    return (
        <Room
            name={name.trim()}
            localAudioTrack={localAudioTrack}
            localVideoTrack={localVideoTrack}
            onLeave={() => {
                setJoined(false);
            }}
        />
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    page: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "20px",
    },
    card: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "18px",
        background: "rgba(30, 41, 59, 0.85)",
        backdropFilter: "blur(12px)",
        padding: "36px 32px",
        borderRadius: "20px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        width: "100%",
        maxWidth: "420px",
    },
    header: {
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
    },
    logoBadge: {
        background: "linear-gradient(135deg, #6366f1, #a855f7)",
        color: "#fff",
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "1px",
        padding: "4px 12px",
        borderRadius: "20px",
        marginBottom: "4px",
    },
    title: {
        color: "#f8fafc",
        fontSize: "24px",
        fontWeight: 700,
        margin: 0,
    },
    subtitle: {
        color: "#94a3b8",
        fontSize: "13px",
        margin: 0,
        textAlign: "center",
    },
    videoPreviewContainer: {
        position: "relative",
        width: "320px",
        height: "220px",
        borderRadius: "14px",
        overflow: "hidden",
        background: "#090d16",
        boxShadow: "inset 0 0 15px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3)",
        border: "1px solid #334155",
    },
    previewVideo: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "scaleX(-1)", // mirror view for natural selfie look
    },
    videoOverlay: {
        position: "absolute",
        bottom: "10px",
        left: "10px",
    },
    videoBadge: {
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        color: "#f1f5f9",
        fontSize: "11px",
        padding: "3px 8px",
        borderRadius: "6px",
        fontWeight: 500,
    },
    mediaWarning: {
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        color: "#fca5a5",
        fontSize: "12px",
        padding: "8px 12px",
        borderRadius: "8px",
        width: "100%",
        textAlign: "center",
    },
    formGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
    },
    label: {
        color: "#cbd5e1",
        fontSize: "13px",
        fontWeight: 500,
    },
    input: {
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid #334155",
        background: "#0f172a",
        color: "#f8fafc",
        outline: "none",
        fontSize: "14px",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxSizing: "border-box",
        width: "100%",
    },
    inputError: {
        borderColor: "#ef4444",
        boxShadow: "0 0 0 1px #ef4444",
    },
    errorText: {
        color: "#ef4444",
        fontSize: "12px",
        marginTop: "2px",
    },
    button: {
        padding: "12px 20px",
        borderRadius: "10px",
        border: "none",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        color: "#ffffff",
        fontWeight: 600,
        fontSize: "15px",
        width: "100%",
        boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
        transition: "all 0.2s ease",
    },
};