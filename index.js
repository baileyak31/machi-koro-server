const io = require('socket.io')();
const uuid = require('uuid');
const port = process.env.PORT || 3000;

const maxPlayerCountPerRoom = 4;
const connectedPlayers = {};
const playerRoom = {};
const gameInProgress = {};

const generateRoomId = () => {
  return uuid.v4();
};

const leaveGameRoom = (socket) => {
  const roomId = playerRoom[socket.id];
  playerRoom[socket.id] = undefined;
  if (
    roomId !== undefined &&
    connectedPlayers[roomId].find((playerId) => playerId === socket.id) !==
      undefined
  ) {
    connectedPlayers[roomId] = connectedPlayers[roomId].filter(
      (playerId) => playerId !== socket.id
    );
    console.log(`player ${socket.id} left game room ${roomId}`);
    socket
      .to(roomId)
      .emit('change in game room players', connectedPlayers[roomId].length);
  }
};

io.on('connect', (socket) => {
  socket.on('launch game room', () => {
    const roomId = generateRoomId();
    connectedPlayers[roomId] = [];
    gameInProgress[roomId] = false;
    socket.emit('game room launched', roomId);
    console.log('game room launched with ID ', roomId);
  });

  socket.on('join game room', (roomId) => {
    console.log(`socket.id === ${socket.id}`);
    if (gameInProgress[roomId]) {
      socket.emit('game room join failed');
      console.log(
        `game room join failed: room ${roomId} has a game in progress`
      );
    } else if (
      connectedPlayers[roomId] === undefined ||
      connectedPlayers[roomId].length >= maxPlayerCountPerRoom
    ) {
      socket.emit('game room join failed');
      console.log(`client ${socket.id} failed to join game room ${roomId}`);
    } else {
      socket.join(roomId);
      connectedPlayers[roomId].push(socket.id);
      playerRoom[socket.id] = roomId;
      socket
        .to(roomId)
        .emit('change in game room players', connectedPlayers[roomId].length);
      socket.emit(
        'game room join success',
        connectedPlayers[roomId].length,
        gameInProgress[roomId]
      );
      console.log(
        `client ${socket.id} has successfully joined game room ${roomId}`
      );
    }
    // TODO: emit list of players in this game room to clients
  });

  socket.on('leave game room', () => {
    leaveGameRoom(socket);
  });

  socket.on('start game', (roomId) => {
    gameInProgress[roomId] = true;
    io.in(roomId).emit('game started', connectedPlayers[roomId]);
    console.log('game started for room ', roomId);
  });

  socket.on('game state changed', (gameState) => {
    const roomId = playerRoom[socket.id];
    socket.to(roomId).emit('game state changed', gameState);
    console.log(`game state changed for room ${roomId}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`client ${socket.id} disconnected`);
    leaveGameRoom(socket);
  });
});

io.listen(port);
console.log(`listening on *:${port}`);
