# wsrtc

WebSocket based state and media stream transport.

## client

Uses apis like WebCodecs (or WebCodecs polyfill) to generate synchronized state.

## server

Uses a start topology to track current state and forward updates to other clients.
