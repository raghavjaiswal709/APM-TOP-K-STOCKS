import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketDataController } from './market-data.controller';
import { DesirabilityController } from './desirability.controller';
import { SubscriptionController } from './subscription.controller';
import { MarketDataService } from './market-data.service';
import { DesirabilityService } from './services/desirability.service';
import { SubscriptionService } from './subscription.service';
// import { MarketDataGateway } from './websocket/market-data.gateway';
// import { PythonBridgeGateway } from './websocket/python-bridge.gateway';

@Module({
    imports: [HttpModule],
    controllers: [MarketDataController, DesirabilityController, SubscriptionController],
    providers: [
        MarketDataService,
        DesirabilityService,
        SubscriptionService,
        // MarketDataGateway,
        // PythonBridgeGateway,
    ],
    exports: [MarketDataService, DesirabilityService, SubscriptionService],
})
export class MarketDataModule { }

