import { Controller, Get, Post, Body } from '@nestjs/common';
import { MarketMoversService } from './market-movers.service';

@Controller('market-movers')
export class MarketMoversController {
  constructor(private readonly service: MarketMoversService) {}

  @Get('locked-colors')
  getLockedColors() {
    return this.service.getLockedColors();
  }

  @Post('locked-colors')
  saveLockedColors(@Body() body: Record<string, string>) {
    this.service.saveLockedColors(body as any);
    return { ok: true };
  }
}
