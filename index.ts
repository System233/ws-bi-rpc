// Copyright (c) 2022 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT


import { EventEmitter, RawData, WebSocket } from "ws";
import { v4 } from "uuid";
export { WebSocket, WebSocketServer } from "ws";

export interface WebSocketRPCRequest<T = any> {
    type?: 'request',
    id?: string;
    name: string;
    data: T;
    timeout?: number;
}
export interface WebSocketRPCResponse<T = any> {
    type?: 'response',
    id?: string;
    name: string;
    data: T;
    code: number;
    message: string;
}
export type WebSocketData = WebSocketRPCRequest | WebSocketRPCResponse;
type KeyOfType<T, F> = { [K in keyof T]: T[K] extends F ? K : never }[keyof T];
export interface WebSocketRPCSerializer<T = any> {
    serialize(data: T): RawData | string;
    deserialize(data: RawData): T;
}
export class WebSocketRPCError extends Error { };
export class WebSocketRPCUnknowDataError extends WebSocketRPCError {
    constructor(public data: any, message?: string) {
        super(message || "Unknow data");
    }
};
export interface WebSocketRPCOption {
    timeout?: number;
    serializer?: WebSocketRPCSerializer<WebSocketData>;
}
export class WebSocketRPCJSONSerializer implements WebSocketRPCSerializer {
    serialize(data: any): string | RawData {
        return JSON.stringify(data);
    }
    deserialize(data: RawData) {
        return JSON.parse(data.toString('utf8'));
    }
}
export class WebSocketRPC<T extends Record<string, any>> extends EventEmitter {
    private timeout: number;
    private serializer: WebSocketRPCSerializer<WebSocketData>;
    constructor(public socket: WebSocket, public handler: Record<string, any>, public option?: WebSocketRPCOption) {
        super();
        this.timeout = option?.timeout || 10000;
        this.serializer = option?.serializer || new WebSocketRPCJSONSerializer;
        this.socket.on('message', (...data) => this.handle(...data))
    }

    async call<K extends KeyOfType<T, Function>>(name: K, ...data: Parameters<T[K]>): Promise<ReturnType<T[K]>> {
        return this.request({
            type: 'request',
            name: name as string,
            data
        });
    }
    async handle(data: RawData, isBinary: boolean) {
        try {
            const rpc = this.serializer.deserialize(data);
            if (rpc != null) {
                if (rpc.type == 'request') {
                    const response = (code: number, message: string, data: any) => this.response({
                        type: 'response',
                        id: rpc.id,
                        name: rpc.name,
                        code,
                        data,
                        message
                    });
                    if (rpc.name in this.handler) {
                        try {
                            const result = await this.handler[rpc.name](...rpc.data);
                            await response(0, 'success', result);
                        } catch (err) {
                            await response(-1, err + '', null);
                        }
                    } else {
                        await response(-1, 'unknown method:' + rpc.name, null);
                    }
                } else if (rpc.type == 'response' && rpc.id) {
                    this.emit(rpc.id, rpc);
                } else {
                    throw new WebSocketRPCUnknowDataError(data);
                }
            } else {
                throw new WebSocketRPCUnknowDataError(data, 'bad serializer')
            }

        } catch (error) {
            this.emit('error', error);
        }
    }
    on(event: "error", listener: (this: WebSocketRPC<T>, error: Error) => void): this;
    on(id: string, listener: (this: WebSocketRPC<T>, response: WebSocketRPCResponse) => void): this;
    on(event: string | symbol, listener: (this: WebSocketRPC<T>, ...args: any[]) => void): this {
        super.on(event, listener);
        return this;
    }
    once(event: "error", listener: (this: WebSocketRPC<T>, error: Error) => void): this;
    once(id: string, listener: (this: WebSocketRPC<T>, response: WebSocketRPCResponse) => void): this;
    once(event: string | symbol, listener: (this: WebSocketRPC<T>, ...args: any[]) => void): this {
        super.once(event, listener);
        return this;
    }
    async response(response: WebSocketRPCResponse) {
        const { id, name, data, message, code } = response;
        return new Promise<void>((resolve, reject) => this.socket.send(this.serializer.serialize({
            type: 'response',
            id,
            name,
            data,
            message,
            code
        }), (err) => err ? reject(err) : resolve()));
    }
    async request<T>(request: WebSocketRPCRequest) {
        return new Promise<T>((resolve, reject) => {
            const id = request.id || v4();
            const timeout = request.timeout || this.timeout;
            const { name, data } = request;
            const timer = setTimeout(() => error(new Error('Timeout:' + timeout)), timeout)
            const handler = (response: WebSocketRPCResponse) => {
                clearTimeout(timer);
                if (!response.code) {
                    resolve(response.data);
                } else {
                    reject(new WebSocketRPCError(`${response.message} (${response.code})`));
                }
            }
            const error = (e?: Error) => {
                this.removeListener(id, handler);
                reject(e);
            }
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