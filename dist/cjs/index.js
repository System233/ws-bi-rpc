"use strict";
// Copyright (c) 2022 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketRPC = exports.WebSocketRPCJSONSerializer = exports.WebSocketRPCUnknowDataError = exports.WebSocketRPCError = exports.WebSocketServer = exports.WebSocket = void 0;
const ws_1 = require("ws");
const uuid_1 = require("uuid");
var ws_2 = require("ws");
Object.defineProperty(exports, "WebSocket", { enumerable: true, get: function () { return ws_2.WebSocket; } });
Object.defineProperty(exports, "WebSocketServer", { enumerable: true, get: function () { return ws_2.WebSocketServer; } });
class WebSocketRPCError extends Error {
}
exports.WebSocketRPCError = WebSocketRPCError;
;
class WebSocketRPCUnknowDataError extends WebSocketRPCError {
    data;
    constructor(data, message) {
        super(message || "Unknow data");
        this.data = data;
    }
}
exports.WebSocketRPCUnknowDataError = WebSocketRPCUnknowDataError;
;
class WebSocketRPCJSONSerializer {
    serialize(data) {
        return JSON.stringify(data);
    }
    deserialize(data) {
        return JSON.parse(data.toString('utf8'));
    }
}
exports.WebSocketRPCJSONSerializer = WebSocketRPCJSONSerializer;
class WebSocketRPC extends ws_1.EventEmitter {
    socket;
    handler;
    option;
    timeout;
    serializer;
    constructor(socket, handler, option) {
        super();
        this.socket = socket;
        this.handler = handler;
        this.option = option;
        this.timeout = option?.timeout || 10000;
        this.serializer = option?.serializer || new WebSocketRPCJSONSerializer;
        this.socket.on('message', (...data) => this.handle(...data));
    }
    async call(name, ...data) {
        return this.request({
            type: 'request',
            name: name,
            data
        });
    }
    async handle(data, isBinary) {
        try {
            const rpc = this.serializer.deserialize(data);
            if (rpc != null) {
                if (rpc.type == 'request') {
                    const response = (code, message, data) => this.response({
                        type: 'response',
                        id: rpc.id,
                        name: rpc.name,
                        code: code,
                        data: null,
                        message
                    });
                    if (rpc.name in this.handler) {
                        try {
                            const data = await this.handler[rpc.name].apply(this.handler, rpc.data);
                            await response(0, 'success', data);
                        }
                        catch (err) {
                            await response(-1, err + '', null);
                        }
                    }
                    else {
                        await response(-1, 'unknown method:' + rpc.name, null);
                    }
                }
                else if (rpc.type == 'response' && rpc.id) {
                    this.emit(rpc.id, true, rpc.data);
                }
                else {
                    throw new WebSocketRPCUnknowDataError(data);
                }
            }
            else {
                throw new WebSocketRPCUnknowDataError(data, 'bad serializer');
            }
        }
        catch (error) {
            this.emit('error', error);
        }
    }
    on(event, listener) {
        super.on(event, listener);
        return this;
    }
    once(event, listener) {
        super.once(event, listener);
        return this;
    }
    async response(response) {
        const { id, name, data, message, code } = response;
        return new Promise((resolve, reject) => this.socket.send(this.serializer.serialize({
            type: 'response',
            id,
            name,
            data,
            message,
            code
        }), (err) => err ? reject(err) : resolve()));
    }
    async request(request) {
        return new Promise((resolve, reject) => {
            const id = request.id || (0, uuid_1.v4)();
            const timeout = request.timeout || this.timeout;
            const { name, data } = request;
            const timer = setTimeout(() => error(new Error('Timeout:' + timeout)), timeout);
            const handler = (response) => {
                clearTimeout(timer);
                if (!response.code) {
                    resolve(response.data);
                }
                else {
                    reject(new WebSocketRPCError(`${response.message} (${response.code})`));
                }
            };
            const error = (e) => {
                this.removeListener(id, handler);
                reject(e);
            };
            this.once(id, handler);
            this.socket.send(this.serializer.serialize({
                type: 'request',
                name,
                id,
                timeout,
                data
            }), e => e && error(e));
        });
    }
}
exports.WebSocketRPC = WebSocketRPC;
