// import { Module } from '@nestjs/common';
// import { MarketDataController } from './market-data.controller';
// import { MarketDataService } from './market-data.service';
// import { MarketDataGateway } from './websocket/market-data.gateway';
// import { PythonBridgeGateway } from './websocket/python-bridge.gateway';

// @Module({
//   controllers: [MarketDataController],
//   providers: [
//     MarketDataService,
//     MarketDataGateway,
//     PythonBridgeGateway
//   ],
//   exports: [MarketDataService],
// })
// export class MarketDataModule {}

import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { MarketDataGateway } from './websocket/market-data.gateway';
import { PythonBridgeGateway } from './websocket/python-bridge.gateway';

@Module({
  controllers: [MarketDataController],
  providers: [
    MarketDataService,
    MarketDataGateway,
    PythonBridgeGateway
  ],
  exports: [MarketDataService],
})
export class MarketDataModule {}
