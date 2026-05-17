import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { api } from "./api";

export function useJobSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(api.baseUrl, { transports: ["websocket"] });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  return socket;
}

