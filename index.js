const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
app.use(cors());
const server = http.createServer(app);
const port = process.env.PORT || 3000;
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: "*",
  },
});
const roomGenerator = require("./roomGenerator");

class Room {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.players = [];
    this.playerCount = 0;
    this.vacant = this.playerCount < 2 ? true : false;
    this.draws = 0;
  }

  addPlayer(player) {
    if (this.playerCount < 2) {
      this.playerCount++;
      this.players.push(player);
      if (this.playerCount >= 2) {
        this.vacant = false;
      }
    }
  }

  decresePlayer() {
    if (this.playerCount > 0) {
      this.playerCount--;
      if (this.playerCount < 2) {
        this.vacant = true;
      }
    }
  }
}

let rooms = [new Room("T")];
rooms[0].addPlayer("testPlayer1");

io.on("connection", async (socket) => {
  socket.on("CREATE_ROOM", ({ nickName, gameMode }) => {
    console.log(gameMode);
    const room = new Room(roomGenerator(rooms, gameMode));
    rooms.push(room);
    room.addPlayer({ nickName, points: 0 });

    socket.join(room.roomCode);
    socket.emit("RECEIVE_ROOM", { room });

    console.log("CREATE_ROOM", room);
    return;
  });

  socket.on("JOIN_ROOM", ({ nickName, roomCode }) => {
    const room = rooms.find((room) => room.roomCode === roomCode);

    if (!room) {
      socket.emit("ERROR", { message: `Room Not Found` });
      return;
    }

    const player = room.players.find((player) => player.nickName === nickName);

    if (player) {
      socket.join(room.roomCode);
      socket.emit("RECEIVE_ROOM", { room });
      return;
    }

    if (!room.vacant) {
      socket.emit("ERROR", { message: `Room Not Vacant` });
      return;
    }

    room.addPlayer({ nickName, points: 0 });

    socket.join(room.roomCode);
    socket.emit("RECEIVE_ROOM", { room });

    console.log("JOIN_ROOM", room);
  });

  socket.on("INIT_ROOM", ({ roomCode }) => {
    console.log("INIT_ROOM");
    const room = rooms.find((room) => room.roomCode === roomCode);

    if (room.vacant) {
      io.to(room.roomCode).emit("RECEIVE_CHANGES", {
        gameStatus: "waiting",
        room,
      });
      return;
    }

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "ready",
      room,
    });
  });

  socket.on("START_GAME", ({ roomCode }) => {
    console.log("START_GAME");
    const room = rooms.find((room) => room.roomCode === roomCode);

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "playing",
      tiles: Array(9).fill(null),
      currPlayer: Math.random() < 0.5 ? "X" : "O",
    });
  });

  socket.on("END_GAME", ({ roomCode, winner, points }) => {
    console.log("END_GAME", winner, points);
    const room = rooms.find((room) => room.roomCode === roomCode);

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "ended",
      winner,
      points,
    });
  });

  socket.on("SEND_CHANGES", ({ roomCode, tiles, currentPlayer, winner }) => {
    console.log("SEND_CHANGES");
    console.log(tiles);
    const room = rooms.find((room) => room.roomCode === roomCode);

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "playing",
      tiles,
      currPlayer: currentPlayer === "X" ? "O" : "X",
      winner,
    });
  });

  socket.on("RESET_BOARD", ({ roomCode }) => {
    console.log("RESET_BOARD");
    const room = rooms.find((room) => room.roomCode === roomCode);

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "playing",
      tiles: Array(9).fill(null),
      currPlayer: Math.random() < 0.5 ? "X" : "O",
      winner: null,
    });
  });

  socket.on("LEAVE_ROOM", ({ roomCode, nickName }) => {
    console.log("LEAVE_ROOM");
    const room = rooms.find((room) => room.roomCode === roomCode);

    socket.leave(room.roomCode);

    room.decresePlayer();
    room.players = room.players.filter((player) => player.nickName != nickName);

    if (room.playerCount === 0) {
      rooms = rooms.filter((room) => room.roomCode != roomCode);
      console.log(rooms);
      return;
    }

    console.log(rooms);

    io.to(room.roomCode).emit("RECEIVE_ROOM", { room });
  });
});

app.get("/", (req, res) => {
  res.json({ response: "online" });
});

server.listen(port, () => {
  console.log(`connection established on ${port}`);
});
