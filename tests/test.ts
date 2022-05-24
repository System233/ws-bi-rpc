// Copyright (c) 2022 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { WebSocketServer,WebSocket ,WebSocketRPC } from "..";


class ServerHander {
    // prop=true;
    say(message: string) {
        console.log('message from client:', message)
    }
}
class ClientHander {
    test(message: string) {
        console.log('message from server :', message)
    }
}
const server = new WebSocketServer({ host: 'localhost', port: 8899 });
server.on('connection', async (socket) => {
    const rpc = new WebSocketRPC<ClientHander>(socket, new ServerHander);
    await rpc.call('test', 'hello');
    // socket.on('close')
});


const ws = new WebSocket('ws://localhost:8899');

ws.on('open', async () => {
    const client = new WebSocketRPC<ServerHander>(ws, new ClientHander);
    await client.call('say', 'say message');
})

