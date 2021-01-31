const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const { sendMessage } = require('../controllers/messages');

// Socket.IO Middleware for Auth
function socketAuth(socket, next) {
  const { token } = socket.handshake.query;

  if (!token) {
    return next(new Error('Failed to authenticate socket'));
  }

  return jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Failed to authenticate socket'));
    }

    // eslint-disable-next-line
    socket.decoded = decoded;
    return next();
  });
}

function socketio(io) {
  io.use(socketAuth);

  // TODO: Move this sockets handlers somewhere
  io.on('connection', (socket) => {
    const userId = socket.decoded.userId;
    socket.on('mount-chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${userId} added in chat ${chatId}`);
    });

    socket.on('unmount-chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${userId} left chat ${chatId}`);
    });

    socket.on('send-message', (newMessage, fn) => {
      const { chatId, content } = newMessage;
      return sendMessage(userId, chatId, { content })
        .then(({ success, message }) => {
          io.to(chatId).emit('new-message', {
            success,
            message,
          });
          fn({ success });
        })
        .catch((error) => {
          // Handle errors
          // eslint-disable-next-line
          console.log(error);
        });
    });
  });

  return (req, res, next) => {
    res.io = io;
    next();
  };
}

module.exports = socketio;
