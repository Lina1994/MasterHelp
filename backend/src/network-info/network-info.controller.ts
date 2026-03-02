import { Controller, Get } from '@nestjs/common';
import * as os from 'os';

/** Shape of the response returned by the network-info endpoint. */
interface NetworkInfoResponse {
  /** IPv4 addresses of non-loopback interfaces found on the host machine. */
  localIps: string[];
  /** Default app port served by NestJS. */
  backendPort: number;
  /** Expected frontend (Vite) port. */
  frontendPort: number;
}

/**
 * Controller that exposes basic network information about the host machine.
 * This is used by the frontend to display the LAN URL so that other devices
 * on the same network can access the app via browser.
 *
 * No authentication is required: the data (local IPs) is not sensitive and
 * is necessary for users that access from a different device first.
 */
@Controller('network-info')
export class NetworkInfoController {
  /**
   * Returns the list of non-loopback IPv4 addresses assigned to the host,
   * plus the ports where backend and frontend are expected to be listening.
   *
   * @returns {NetworkInfoResponse} Network metadata of the host.
   */
  @Get()
  getNetworkInfo(): NetworkInfoResponse {
    const interfaces = os.networkInterfaces();
    const localIps: string[] = [];

    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const entry of iface) {
        if (entry.family === 'IPv4' && !entry.internal) {
          localIps.push(entry.address);
        }
      }
    }

    return {
      localIps,
      backendPort: Number(process.env.PORT) || 3000,
      frontendPort: 5173,
    };
  }
}
