const roomGenerator = (rooms, gameMode) => {
  let characters = "";
  if (gameMode === "aalu") {
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  } else {
    characters = "abcdefghijklmnopqrstuvwxyz";
  }

  let result = "";

  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }

  try {
    const room = rooms.filter((room) => room.roomId === result);

    if (room.length === 0) {
      console.log("no collison", result);
      return result;
    }

    console.log("collison");
    return roomGenerator(rooms);
  } catch (error) {
    console.log(error);
  }
};

module.exports = roomGenerator;
