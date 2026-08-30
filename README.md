# Real-Time Peer Chat App

An anonymous peer-to-peer video & audio chat application that mimics Omegle’s core functionality. Built using **Socket.IO** for real-time signaling and **WebRTC** for peer-to-peer media communication.

- **Live Website**: [https://omegle-beta.vercel.app/](https://omegle-beta.vercel.app/)
- **Demo Video**: [https://res.cloudinary.com/d3ukbssg/video/upload/v1788110192/Screen_Recording_2026-08-30_222900_1.mp4](https://res.cloudinary.com/d3ukbssg/video/upload/v1788110192/Screen_Recording_2026-08-30_222900_1.mp4)

## Features

- **Split-Screen Layout**: Left half displays live remote & local video feeds; right half displays an interactive real-time text chat just like real Omegle.
- **Live Text Messaging**: Bidirectional text chat between connected peers with distinct message styling ("You" vs "Stranger") and timestamps.
- **Real-Time Typing Indicator**: Instant "Stranger is typing..." notification when your partner is composing a message.
- **Classic Omegle Controls & Shortcuts**:
  - `Esc` key shortcut for fast Stop / Really? / Next stranger workflow.
  - `Enter` key shortcut to send messages instantly.
  - Multi-state confirmation button (Stop -> Really? -> Next).
- **System Chat Notifications**: Visual notices for matchmaking search, stranger connected greetings, and partner disconnect events.
- **Anonymous Matchmaking**: Join with a custom display name and get paired with random users in real time.
- **Matchmaking Queue**: In-memory queue system that dynamically pairs available users into 1-on-1 rooms.
- **Socket.IO Signaling & Chat**: Real-time signaling mechanism for exchanging SDP offers, answers, ICE candidates, chat messages, and typing events.
- **WebRTC Peer-to-Peer Streaming**: Direct browser-to-browser encrypted high-quality audio and video communication.
- **NAT Traversal (STUN)**: Configured with Google STUN servers for reliable peer connectivity across different networks.
- **Camera & Mic Preview**: Pre-join device permission check and live mirrored camera preview.
- **In-Call Media Controls**: Toggle microphone (mute/unmute) and camera (turn video on/off) during the call.
- **Next Stranger (Skip)**: Instant requeueing to skip to the next available peer without reloading the page.
- **Disconnection Handling**: Automatic detection of peer disconnects and room teardown with visual feedback.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, React Router DOM
- **Backend**: Node.js, Express, TypeScript
- **Real-Time Communication**: `Socket.IO`, `WebRTC` (Google STUN)
- **Queue Management**: In-memory FIFO matchmaking logic

## Project Structure

```bash
├── backend/                        # Signaling server
│   ├── src/
│   │   ├── managers/
│   │   │   ├── RoomManager.ts      # Room lifecycle, chat message routing & WebRTC signaling
│   │   │   └── UserManager.ts      # Matchmaking queue & user connection management
│   │   └── index.ts                # Express server & Socket.IO initialization
│   ├── .env.example                # Backend environment variables template
│   ├── package.json                # Backend dependencies and scripts
│   └── tsconfig.json               # Backend TypeScript configuration
├── frontend/                       # Client web application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Landing.tsx         # Landing page with camera preview & name input
│   │   │   ├── Room.tsx            # Split-screen video room & WebRTC peer connection logic
│   │   │   └── ChatBox.tsx         # Real-time Omegle text chat, system notices & typing indicator
│   │   ├── App.tsx                 # Root application component & routing
│   │   ├── index.css               # Global styling, custom scrollbars & animations
│   │   └── main.tsx                # Application entry point
│   ├── .env.example                # Frontend environment variables template
│   ├── package.json                # Frontend dependencies and scripts
│   ├── tsconfig.json               # Frontend TypeScript configuration
│   └── vite.config.ts              # Vite configuration
└── README.md                       # Project documentation
```

## Installation

1. **Clone the Repository**

```bash
git clone https://github.com/ParasRana123/omegle.git
cd omegle
```

2. **Backend Setup**

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables (optional - defaults to PORT=3001, CORS_ORIGIN=*)
cp .env.example .env

# Start the development server
npm run dev
```

3. **Frontend Setup**

```bash
# Navigate to frontend directory from project root
cd ../frontend

# Install dependencies
npm install

# Configure environment variables (set VITE_SOCKET_URL, defaults to http://localhost:3001)
cp .env.example .env

# Start the Vite development server
npm run dev
```

4. **Access the Application**

Open [http://localhost:5173](http://localhost:5173) in your browser (open in two separate browser windows/tabs or different browsers to test peer-to-peer matchmaking).

## Contributing

We welcome contributions from the community! Whether you're interested in improving features, fixing bugs, or adding new functionality, your input is valuable. Feel free to reach out to us with your ideas and suggestions.

## License

This project is licensed under the MIT License - see the LICENSE file for details.