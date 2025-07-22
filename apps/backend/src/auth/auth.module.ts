import { Module } from '@nestjs/common';
import { FyersAuthController } from './fyers-auth.controller';
import { FyersAuthService } from '../market-data/services/fyers-auth.service';

@Module({
  controllers: [FyersAuthController],
  providers: [FyersAuthService],
  exports: [FyersAuthService],
})
export class AuthModule {}
