import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../hooks/use-auth-store';

class SocketManager {
  public socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket?.connected && this.token === token) return;
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    this.token = token;
    this.socket = io('/', {
      path: '/ws/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
    });
    
    this.socket.on('connect', () => {
      this.socket?.emit('authenticate', { token });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
    }
  }
}

export const socketManager = new SocketManager();

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (token) {
      socketManager.connect(token);
      
      const handleConnect = () => setConnected(true);
      const handleDisconnect = () => setConnected(false);
      
      const s = socketManager.socket;
      if (s) {
        s.on('connect', handleConnect);
        s.on('disconnect', handleDisconnect);
        setConnected(s.connected);
      }

      return () => {
        if (s) {
          s.off('connect', handleConnect);
          s.off('disconnect', handleDisconnect);
        }
      };
    } else {
      socketManager.disconnect();
      setConnected(false);
    }
  }, [token]);

  return { socket: socketManager.socket, connected };
}
