import { Module } from '@nestjs/common';
import { NetworkInfoController } from './network-info.controller';

/**
 * Module that exposes network metadata (local IPs, ports) about the host machine.
 * Intended for the frontend settings panel to display the LAN access URL.
 */
@Module({
  controllers: [NetworkInfoController],
})
export class NetworkInfoModule {}
