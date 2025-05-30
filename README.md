# Real-Time Peer Chat App

An anonymous peer-to-peer video & audio chat application that mimics Omegle’s core functionality. Built using **WebSockets** for signaling and **WebRTC** for real-time media communication.

## Features

- Name-based anonymous matchmaking
- Matchmaking queue with real-time user pairing
- WebSocket signaling for offer/answer exchange
- WebRTC peer-to-peer connection for video/audio
- Mutual connection acceptance before chat begins

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js, Express
- **Real-Time Communication**: `WebSockets (ws)`, `WebRTC`
- **Queue Management**: In-memory matchmaking logic

## Project Structure

```bash
├── backend/                        # Code for the backend
│   ├── src/           
│   │     ├── managers/       
│   │     │    ├── RoomManager.ts   # Schema for the room   
│   │     │    └── UserManager.ts   # Schema for the users  
│   │     └── index.ts              # Main routes
├── frontend/                       # Code for the frontend
│   ├── src/        
│   │     ├── Landing.tsx           # Landing Page       
│   │     └── Room.tsx              # Contains WebRTC integration
└── README.md                       # Documentation for the project
```

## Installation

1. **Clone the Repository**

```bash
git clone [repository-url]
cd omegle
```

2. **Install the Backend dependencies**

```bash
cd backend
npm install
```

3. **Install the Frontend dependencies**

```bash
cd frontend
npm install
```

4. **Start the backend server**

```bash
cd backend
npm run dev
```

5. **Start the frontend application**

```bash
cd frontend
npm run dev
```

## Contributing

We welcome contributions from the community! Whether you're interested in improving features, fixing bugs, or adding new functionality, your input is valuable. Feel free to reach out to us with your ideas and suggestions.

## License
This project is licensed under the MIT License - see the LICENSE file for details.