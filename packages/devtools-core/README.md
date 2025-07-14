# @rozenite/devtools-core

Core framework for React Native DevTools plugin orchestration, providing host-guest RPC communication and plugin management.

## Overview

This package provides the core framework that powers React Native DevTools plugin system:

- **Host**: The React Native DevTools orchestrator that manages plugin loading and communication
- **Guest**: Entry point for devtools.html providing RPC to the host
- **Bridge**: Collection of types for RPC communication between guest and host

## Building

Run `nx build devtools-core` to build the library.
