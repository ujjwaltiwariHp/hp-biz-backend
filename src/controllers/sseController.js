const sseService = require('../services/sseService');
const { errorResponse } = require('../utils/errorResponse');

const subscribe = async (req, res) => {
  try {
    let clientId;

    if (req.userType === 'staff' && req.staff) {
      clientId = `s_${req.staff.id}`;
    } else if (req.userType === 'admin' && req.company) {
      clientId = `c_${req.company.id}`;
    } else if (req.superAdmin) {
      clientId = `sa_${req.superAdmin.id}`;
    } else {
      return errorResponse(res, 401, "Authentication required for SSE connection");
    }


    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();

    sseService.addClient(clientId, res);

    const cleanup = () => {
      sseService.removeClient(clientId);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);
    res.on('end', cleanup);
  } catch (error) {
    if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to establish SSE connection' });
    } else {
        console.error("SSE Connection Error:", error);
        res.end();
    }
  }
};

module.exports = {
  subscribe,
};