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
let rooms = [];

io.on("connection", async (socket) => {
  socket.on("CREATE_ROOM", ({ nickName, gameMode }) => {
    console.log("\nCREATE_ROOM", nickName);

    const room = new Room(roomGenerator(rooms, gameMode));
    rooms.push(room);
    room.addPlayer({ nickName, points: 0 });

    socket.join(room.roomCode);
    socket.emit("RECEIVE_ROOM", { room });

    console.log(rooms);
    return;
  });

  socket.on("JOIN_ROOM", ({ nickName, roomCode }) => {
    console.log("\nJOIN_ROOM", nickName);

    const room = rooms.find((room) => room.roomCode === roomCode);

    if (!room) {
      console.log("INVALID ROOM CODE");
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
      console.log("ROOM FULL");
      socket.emit("ERROR", { message: `Room Not Vacant` });
      return;
    }

    room.addPlayer({ nickName, points: 0 });

    socket.join(room.roomCode);
    socket.emit("RECEIVE_ROOM", { room });

    console.log(rooms);
  });

  socket.on("INIT_ROOM", ({ roomCode }) => {
    console.log("\nINIT_ROOM");
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
    console.log("\nSTART_GAME");
    const room = rooms.find((room) => room.roomCode === roomCode);

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "playing",
      tiles: Array(9).fill(null),
      currPlayer: Math.random() < 0.5 ? "X" : "O",
    });
  });

  socket.on("SEND_CHANGES", ({ roomCode, tiles, currentPlayer, winner }) => {
    console.log("\nSEND_CHANGES", winner);
    const room = rooms.find((room) => room.roomCode === roomCode);

    if (winner) {
      console.log(`WE HAVE A WINNER ${winner}`);

      winner === "X" ? (room.players[0].points += 1) : null;
      winner === "O" ? (room.players[1].points += 1) : null;
      winner === "draw" ? (room.draws += 1) : null;

      io.to(room.roomCode).emit("RECEIVE_CHANGES", {
        gameStatus: "ended",
        tiles,
        winner,
        points: {
          p1: room.players[0].points,
          p2: room.players[1].points,
          draws: room.draws,
        },
      });

      return;
    }

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "playing",
      tiles,
      currPlayer: currentPlayer === "X" ? "O" : "X",
      winner,
    });
  });

  socket.on("RESET_BOARD", ({ roomCode }) => {
    console.log("\nRESET_BOARD");
    const room = rooms.find((room) => room.roomCode === roomCode);

    io.to(room.roomCode).emit("RECEIVE_CHANGES", {
      gameStatus: "playing",
      tiles: Array(9).fill(null),
      currPlayer: Math.random() < 0.5 ? "X" : "O",
      winner: null,
    });
  });

  socket.on("LEAVE_ROOM", ({ roomCode, nickName }) => {
    console.log("\nLEAVE_ROOM");
    const room = rooms.find((room) => room.roomCode === roomCode);

    if (room) {
      socket.leave(room.roomCode);

      room.decresePlayer();
      room.players = room.players.filter(
        (player) => player.nickName != nickName
      );

      if (room.playerCount > 0) {
        room.players[0].points = 0;
        room.draws = 0;
      }

      if (room.playerCount === 0) {
        rooms = rooms.filter((room) => room.roomCode != roomCode);
        console.log(rooms);
        return;
      }

      io.to(room.roomCode).emit("RECEIVE_ROOM", { room });

      console.log(rooms);
    }
  });
});

app.get("/", (req, res) => {
  // let playerCount = 0;

  // rooms.map((room) => {
  //   playerCount += room.players.length;
  // });

  res.json({ rooms: rooms.length });
});

server.listen(port, () => {
  console.log(`connection established on ${port}`);
});
