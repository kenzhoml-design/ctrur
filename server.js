const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = new Map();

function sendState(room) {
  const game = rooms.get(room);
  if (!game) return;

  io.to(room).emit("game-state", {
    fen: game.chess.fen(),
    turn: game.chess.turn(),
    history: game.chess.history(),
    check: game.chess.isCheck(),
    checkmate: game.chess.isCheckmate(),
    draw: game.chess.isDraw(),
    players: {
      white: game.white,
      black: game.black
    }
  });
}

io.on("connection", socket => {

  socket.on("create-room", callback => {
    let room;
    do {
      room = Math.random().toString(36)
        .substring(2, 8).toUpperCase();
    } while (rooms.has(room));

    rooms.set(room, {
      chess: new Chess(),
      white: socket.id,
      black: null
    });

    socket.join(room);
    socket.data.room = room;
    socket.data.color = "w";

    callback({
      success: true,
      room,
      color: "w"
    });

    sendState(room);
  });

  socket.on("join-room", (room, callback) => {
    room = String(room).trim().toUpperCase();
    const game = rooms.get(room);

    if (!game) {
      return callback({
        success: false,
        message: "Room tidak ditemukan!"
      });
    }

    if (game.black) {
      return callback({
        success: false,
        message: "Room sudah penuh!"
      });
    }

    game.black = socket.id;
    socket.join(room);
    socket.data.room = room;
    socket.data.color = "b";

    callback({
      success: true,
      room,
      color: "b"
    });

    sendState(room);
  });

  socket.on("make-move", (data, callback) => {
    const room = socket.data.room;
    const game = rooms.get(room);

    if (!game) {
      return callback({success:false});
    }

    if (game.chess.isGameOver()) {
      return callback({success:false});
    }

    if (game.chess.turn() !== socket.data.color) {
      return callback({
        success:false,
        message:"Bukan giliranmu!"
      });
    }

    try {
      const move = game.chess.move({
        from: data.from,
        to: data.to,
        promotion: data.promotion || "q"
      });

      if (!move) {
        return callback({success:false});
      }

      callback({success:true});
      sendState(room);

    } catch (error) {
      callback({
        success:false,
        message:"Langkah tidak valid!"
      });
    }
  });

  socket.on("reset-game", callback => {
    const room = socket.data.room;
    const game = rooms.get(room);

    if (!game || game.white !== socket.id) {
      return callback?.({
        success:false
      });
    }

    game.chess.reset();
    sendState(room);
    callback?.({success:true});
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    const game = rooms.get(room);

    if (!game) return;

    io.to(room).emit("opponent-left");

    rooms.delete(room);
  });
});

server.listen(3000, () => {
  console.log("CHESS 3D berjalan di port 3000");
});