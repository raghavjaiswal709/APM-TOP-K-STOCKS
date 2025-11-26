import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GttPredictionController } from './gtt-prediction.controller';
import { GttPredictionService } from './gtt-prediction.service';

@Module({
    imports: [HttpModule],
    controllers: [GttPredictionController],
    providers: [GttPredictionService],
    exports: [GttPredictionService],
})
export class GttPredictionModule { }
