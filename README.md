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
├── backend/             # Code for the backend
│   ├── src/           
│   │     ├── aws.ts         
│   │     ├── file.ts     
│   │     ├── index.ts     
│   │     └── utils.ts   
├── frontend/             # Code for the frontend
│   ├── src/        
│   │     ├── Landing.tsx             
│   │     └── Room.tsx            
└── README.md             # Documentation for the project
```

## Installation

1. **Clone the Repository**

```bash
git clone [repository-url]
cd vercel
```

2. **Install the Upload Service dependencies**

```bash
cd vercel-upload-service
npm install
```

3. **Install the Deploy Service dependencies**

```bash
cd vercel-deploy-service
npm install
```

4. **Install the Request Handler dependencies**

```bash
cd request-handler-service
npm install
```

5. **Install the Frontend dependencies**

```bash
cd frontend
npm install
```

6. **Create a `.env` file in all the three folders `vercel-upload-service`, `vercel-deploy-service` and `vercel-request-handler`**

    Navigate to these folders and create a `.env` using:
    ``` bash
    cd vercel-upload-service
    echo. > .env
    ```  

    ``` bash
    cd vercel-deploy-service
    echo. > .env
    ```

    ``` bash
    cd vercel-request-handler
    echo. > .env
    ```

7. **Start the vercel-upload-service server**

```bash
cd vercel-upload-service
npm run dev
```

8. **Start the vercel-deploy-service server**

```bash
cd vercel-dpeloy-service
npm run dev
```

9. **Start the vercel-request-handler server**

```bash
cd request-handler-service
npm run dev
```

10. **Start the frontend application**

```bash
cd frontend
npm run dev
```

## Contributing

We welcome contributions from the community! Whether you're interested in improving features, fixing bugs, or adding new functionality, your input is valuable. Feel free to reach out to us with your ideas and suggestions.

## License
This project is licensed under the MIT License - see the LICENSE file for details.