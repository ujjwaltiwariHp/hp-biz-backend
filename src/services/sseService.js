const clients = new Map();
const KEEP_ALIVE_INTERVAL = 30000;
let eventId = 0;

class SSEManager {
  addClient(clientId, res) {
    const keepAliveInterval = setInterval(() => {
      if (res.writableEnded) {
        this.removeClient(clientId);
        return;
      }
      res.write('event: keep-alive\n');
      res.write('data: heartbeat\n\n');
    }, KEEP_ALIVE_INTERVAL);

    clients.set(clientId, { res, keepAliveInterval });
  }

  removeClient(clientId) {
    const client = clients.get(clientId);
    if (client) {
      clearInterval(client.keepAliveInterval);
      if (!client.res.writableEnded) {
        client.res.end();
      }
      clients.delete(clientId);
    }
  }

  publish(clientId, eventType, data) {
    eventId++;
    const message = `id: ${eventId}\n`
                  + `event: ${eventType}\n`
                  + `data: ${JSON.stringify(data)}\n\n`;

    const client = clients.get(clientId);
    if (client && !client.res.writableEnded) {
      client.res.write(message);
    }
  }

  broadcast(eventType, data) {
    eventId++;
    const message = `id: ${eventId}\n`
                  + `event: ${eventType}\n`
                  + `data: ${JSON.stringify(data)}\n\n`;

    clients.forEach((client, clientId) => {
      if (clientId.startsWith('sa_') || clientId.startsWith('c_')) {
          if (!client.res.writableEnded) {
            client.res.write(message);
          }
      }
    });
  }

  getStats() {
    return {
      activeConnections: clients.size,
      clientKeys: Array.from(clients.keys())
    };
  }
}

module.exports = new SSEManager();