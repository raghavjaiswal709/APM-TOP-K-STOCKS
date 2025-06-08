
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    app.enableCors({
      origin: '*',
      credentials: true,
    });
    
    await app.listen(process.env.PORT || 5000);
    console.log('Server started on port', process.env.PORT || 5000);
  } catch (err) {
    console.error('NestJS failed to start:', err);
  }
}
bootstrap();
