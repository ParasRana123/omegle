import React, { useEffect, useRef, useState } from "react";

export interface ChatMessage {
    id: string;
    sender: "you" | "stranger" | "system";
    text: string;
    time?: string;
    systemType?: "searching" | "connected" | "disconnected" | "info";
}

interface ChatBoxProps {
    messages: ChatMessage[];
    isStrangerTyping: boolean;
    isConnected: boolean;
    isLobby: boolean;
    isPartnerDisconnected: boolean;
    remoteName?: string;
    onSendMessage: (text: string) => void;
    onNext: () => void;
    onTyping: (isTyping: boolean) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
    messages,
    isStrangerTyping,
    isConnected,
    isLobby,
    isPartnerDisconnected,
    remoteName = "Stranger",
    onSendMessage,
    onNext,
    onTyping,
}) => {
    const [inputText, setInputText] = useState("");
    const [stopConfirm, setStopConfirm] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-scroll to latest message
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isStrangerTyping]);

    // Focus input when connected
    useEffect(() => {
        if (isConnected && !isLobby && !isPartnerDisconnected) {
            setStopConfirm(false);
            inputRef.current?.focus();
        }
    }, [isConnected, isLobby, isPartnerDisconnected]);

    // Handle typing debounce
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputText(val);

        if (!isConnected || isLobby || isPartnerDisconnected) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        onTyping(true);

        typingTimeoutRef.current = setTimeout(() => {
            onTyping(false);
        }, 1200);
    };

    const handleSend = () => {
        const trimmed = inputText.trim();
        if (!trimmed) return;
        if (!isConnected || isLobby || isPartnerDisconnected) return;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        onTyping(false);

        onSendMessage(trimmed);
        setInputText("");
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handle Stop / Really? / Next button logic
    const handleStopNextClick = () => {
        if (isLobby || isPartnerDisconnected) {
            // Already disconnected/in lobby -> Skip/Next
            setStopConfirm(false);
            onNext();
        } else if (stopConfirm) {
            // Confirmed stop -> disconnect / next
            setStopConfirm(false);
            onNext();
        } else {
            // First stop click -> ask Really?
            setStopConfirm(true);
        }
    };

    // Global Esc key handling
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isLobby || isPartnerDisconnected) {
                    onNext();
                } else if (stopConfirm) {
                    setStopConfirm(false);
                    onNext();
                } else {
                    setStopConfirm(true);
                }
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [isLobby, isPartnerDisconnected, stopConfirm, onNext]);

    return (
        <div style={styles.chatContainer}>
            {/* Header */}
            <div style={styles.chatHeader}>
                <div style={styles.chatHeaderLeft}>
                    <span style={styles.chatHeaderIcon}>💬</span>
                    <div>
                        <div style={styles.chatHeaderTitle}>Text Chat</div>
                        <div style={styles.chatHeaderSubtitle}>
                            {isLobby ? (
                                <span style={{ color: "#94a3b8" }}>Searching for partner...</span>
                            ) : isPartnerDisconnected ? (
                                <span style={{ color: "#ef4444" }}>Stranger disconnected</span>
                            ) : isConnected ? (
                                <span style={{ color: "#22c55e" }}>Connected with {remoteName}</span>
                            ) : (
                                <span style={{ color: "#eab308" }}>Connecting...</span>
                            )}
                        </div>
                    </div>
                </div>
                <div style={styles.chatHeaderRight}>
                    <span style={styles.escBadge} title="Press Escape to skip or disconnect">
                        Esc = Next
                    </span>
                </div>
            </div>

            {/* Messages Area */}
            <div style={styles.messagesArea}>
                {messages.map((msg) => {
                    if (msg.sender === "system") {
                        let bannerStyle = styles.systemDefault;
                        if (msg.systemType === "searching") bannerStyle = styles.systemSearching;
                        if (msg.systemType === "connected") bannerStyle = styles.systemConnected;
                        if (msg.systemType === "disconnected") bannerStyle = styles.systemDisconnected;

                        return (
                            <div key={msg.id} style={{ ...styles.systemMessageWrapper, ...bannerStyle }}>
                                <span style={styles.systemText}>{msg.text}</span>
                                {msg.systemType === "disconnected" && (
                                    <button
                                        onClick={onNext}
                                        style={styles.systemNextButton}
                                    >
                                        Find New Stranger (Esc)
                                    </button>
                                )}
                            </div>
                        );
                    }

                    const isYou = msg.sender === "you";

                    return (
                        <div
                            key={msg.id}
                            style={{
                                ...styles.messageRow,
                                justifyContent: isYou ? "flex-end" : "flex-start",
                            }}
                        >
                            <div
                                style={{
                                    ...styles.messageBubble,
                                    ...(isYou ? styles.messageYou : styles.messageStranger),
                                }}
                            >
                                <div style={styles.messageHeader}>
                                    <span
                                        style={{
                                            ...styles.senderLabel,
                                            color: isYou ? "#38bdf8" : "#fb7185",
                                        }}
                                    >
                                        {isYou ? "You" : remoteName || "Stranger"}
                                    </span>
                                    {msg.time && (
                                        <span style={styles.messageTime}>{msg.time}</span>
                                    )}
                                </div>
                                <div style={styles.messageBody}>{msg.text}</div>
                            </div>
                        </div>
                    );
                })}

                {/* Stranger typing indicator */}
                {isStrangerTyping && (
                    <div style={styles.typingWrapper}>
                        <span style={styles.typingDot}></span>
                        <span style={{ ...styles.typingDot, animationDelay: "0.2s" }}></span>
                        <span style={{ ...styles.typingDot, animationDelay: "0.4s" }}></span>
                        <span style={styles.typingText}>{remoteName || "Stranger"} is typing...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input & Control Bar */}
            <div style={styles.inputBar}>
                <button
                    onClick={handleStopNextClick}
                    style={{
                        ...styles.stopBtn,
                        ...(stopConfirm
                            ? styles.stopBtnConfirm
                            : (isLobby || isPartnerDisconnected)
                            ? styles.stopBtnNext
                            : styles.stopBtnNormal),
                    }}
                    title="Press Esc or click to stop/next"
                >
                    {isLobby
                        ? "Skip (Esc)"
                        : isPartnerDisconnected
                        ? "Next ⏭️ (Esc)"
                        : stopConfirm
                        ? "Really? (Esc)"
                        : "Stop (Esc)"}
                </button>

                <div style={styles.inputWrapper}>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={
                            isLobby
                                ? "Waiting for stranger..."
                                : isPartnerDisconnected
                                ? "Stranger disconnected. Click Next to start."
                                : "Type message and press Enter..."
                        }
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={isLobby || isPartnerDisconnected || !isConnected}
                        style={{
                            ...styles.chatInput,
                            opacity: (isLobby || isPartnerDisconnected || !isConnected) ? 0.6 : 1,
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isLobby || isPartnerDisconnected || !isConnected}
                        style={{
                            ...styles.sendBtn,
                            opacity: (!inputText.trim() || isLobby || isPartnerDisconnected || !isConnected) ? 0.45 : 1,
                            cursor: (!inputText.trim() || isLobby || isPartnerDisconnected || !isConnected) ? "not-allowed" : "pointer",
                        }}
                        title="Send message"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        <span>Send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    chatContainer: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(12px)",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        overflow: "hidden",
    },
    chatHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 18px",
        background: "rgba(30, 41, 59, 0.8)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    },
    chatHeaderLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    chatHeaderIcon: {
        fontSize: "20px",
    },
    chatHeaderTitle: {
        fontSize: "14px",
        fontWeight: 700,
        color: "#f8fafc",
    },
    chatHeaderSubtitle: {
        fontSize: "12px",
        fontWeight: 500,
    },
    chatHeaderRight: {
        display: "flex",
        alignItems: "center",
    },
    escBadge: {
        background: "rgba(255, 255, 255, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        color: "#94a3b8",
        fontSize: "11px",
        padding: "3px 8px",
        borderRadius: "6px",
        fontWeight: 500,
        userSelect: "none",
    },
    messagesArea: {
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        background: "radial-gradient(ellipse at center, rgba(15, 23, 42, 0.4) 0%, rgba(2, 6, 23, 0.8) 100%)",
    },
    systemMessageWrapper: {
        padding: "10px 14px",
        borderRadius: "10px",
        fontSize: "13px",
        textAlign: "center",
        margin: "4px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
    },
    systemDefault: {
        background: "rgba(51, 65, 85, 0.4)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        color: "#cbd5e1",
    },
    systemSearching: {
        background: "rgba(59, 130, 246, 0.15)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
        color: "#93c5fd",
    },
    systemConnected: {
        background: "rgba(34, 197, 94, 0.15)",
        border: "1px solid rgba(34, 197, 94, 0.3)",
        color: "#86efac",
        fontWeight: 600,
    },
    systemDisconnected: {
        background: "rgba(239, 68, 68, 0.15)",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        color: "#fca5a5",
    },
    systemText: {
        lineHeight: "1.4",
    },
    systemNextButton: {
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        color: "#ffffff",
        border: "none",
        padding: "6px 14px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        marginTop: "4px",
        boxShadow: "0 2px 8px rgba(79, 70, 229, 0.4)",
    },
    messageRow: {
        display: "flex",
        width: "100%",
    },
    messageBubble: {
        maxWidth: "85%",
        padding: "8px 12px",
        borderRadius: "12px",
        fontSize: "14px",
        wordBreak: "break-word",
        lineHeight: "1.4",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
    },
    messageYou: {
        background: "linear-gradient(135deg, rgba(2, 132, 199, 0.3), rgba(14, 165, 233, 0.2))",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        color: "#f0f9ff",
        borderBottomRightRadius: "3px",
    },
    messageStranger: {
        background: "linear-gradient(135deg, rgba(225, 29, 72, 0.25), rgba(244, 63, 94, 0.15))",
        border: "1px solid rgba(251, 113, 133, 0.35)",
        color: "#fff1f2",
        borderBottomLeftRadius: "3px",
    },
    messageHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "8px",
        marginBottom: "2px",
    },
    senderLabel: {
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.2px",
    },
    messageTime: {
        fontSize: "10px",
        color: "#94a3b8",
    },
    messageBody: {
        fontSize: "13.5px",
        whiteSpace: "pre-wrap",
    },
    typingWrapper: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "6px 12px",
        borderRadius: "8px",
        background: "rgba(30, 41, 59, 0.5)",
        width: "fit-content",
        color: "#cbd5e1",
        fontSize: "12px",
        fontStyle: "italic",
    },
    typingDot: {
        width: "5px",
        height: "5px",
        backgroundColor: "#f43f5e",
        borderRadius: "50%",
        display: "inline-block",
        animation: "typingPulse 1s infinite",
    },
    typingText: {
        marginLeft: "4px",
    },
    inputBar: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        background: "rgba(30, 41, 59, 0.9)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    },
    stopBtn: {
        padding: "10px 16px",
        borderRadius: "10px",
        border: "none",
        fontWeight: 700,
        fontSize: "13px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
    },
    stopBtnNormal: {
        background: "#334155",
        color: "#e2e8f0",
        border: "1px solid #475569",
    },
    stopBtnConfirm: {
        background: "#dc2626",
        color: "#ffffff",
        boxShadow: "0 0 12px rgba(220, 38, 38, 0.6)",
        animation: "pulse 1s infinite",
    },
    stopBtnNext: {
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        color: "#ffffff",
        boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
    },
    inputWrapper: {
        display: "flex",
        flex: 1,
        alignItems: "center",
        gap: "8px",
        background: "#090d16",
        borderRadius: "10px",
        padding: "4px 6px 4px 12px",
        border: "1px solid #334155",
    },
    chatInput: {
        flex: 1,
        background: "transparent",
        border: "none",
        outline: "none",
        color: "#f8fafc",
        fontSize: "14px",
        fontFamily: "inherit",
    },
    sendBtn: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 14px",
        borderRadius: "8px",
        border: "none",
        background: "linear-gradient(135deg, #0284c7, #2563eb)",
        color: "#ffffff",
        fontWeight: 600,
        fontSize: "13px",
        transition: "all 0.2s ease",
    },
};
