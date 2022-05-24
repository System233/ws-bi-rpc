/// <reference types="node" />
import { EventEmitter, RawData, WebSocket } from "ws";
export { WebSocket, WebSocketServer } from "ws";
export interface WebSocketRPCRequest<T = any> {
    type?: 'request';
    id?: string;
    name: string;
    data: T;
    timeout?: number;
}
export interface WebSocketRPCResponse<T = any> {
    type?: 'response';
    id?: string;
    name: string;
    data: T;
    code: number;
    message: string;
}
export declare type WebSocketData = WebSocketRPCRequest | WebSocketRPCResponse;
declare type KeyOfType<T, F> = {
    [K in keyof T]: T[K] extends F ? K : never;
}[keyof T];
export interface WebSocketRPCSerializer<T = any> {
    serialize(data: T): RawData | string;
    deserialize(data: RawData): T;
}
export declare class WebSocketRPCError extends Error {
}
export declare class WebSocketRPCUnknowDataError extends WebSocketRPCError {
    data: any;
    constructor(data: any, message?: string);
}
export interface WebSocketRPCOption {
    timeout?: number;
    serializer?: WebSocketRPCSerializer<WebSocketData>;
}
export declare class WebSocketRPCJSONSerializer implements WebSocketRPCSerializer {
    serialize(data: any): string | RawData;
    deserialize(data: RawData): any;
}
export declare class WebSocketRPC<T extends Record<string, any>> extends EventEmitter {
    socket: WebSocket;
    handler: Record<string, any>;
    option?: WebSocketRPCOption;
    private timeout;
    private serializer;
    constructor(socket: WebSocket, handler: Record<string, any>, option?: WebSocketRPCOption);
    call<K extends KeyOfType<T, Function>>(name: K, ...data: Parameters<T[K]>): Promise<ReturnType<T[K]>>;
    handle(data: RawData, isBinary: boolean): Promise<void>;
    on(event: "error", listener: (this: WebSocketRPC<T>, error: Error) => void): this;
    on(id: string, listener: (this: WebSocketRPC<T>, response: WebSocketRPCResponse) => void): this;
    once(event: "error", listener: (this: WebSocketRPC<T>, error: Error) => void): this;
    once(id: string, listener: (this: WebSocketRPC<T>, response: WebSocketRPCResponse) => void): this;
    response(response: WebSocketRPCResponse): Promise<void>;
    request<T>(request: WebSocketRPCRequest): Promise<T>;
}
