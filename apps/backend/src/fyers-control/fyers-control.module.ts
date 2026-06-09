import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FyersControlController } from './fyers-control.controller';
import { FyersControlService } from './fyers-control.service';

@Module({
  imports: [HttpModule.register({ timeout: 15000 })],
  controllers: [FyersControlController],
  providers: [FyersControlService],
})
export class FyersControlModule {}
