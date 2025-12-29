// apps/backend/src/main.ts
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // Enable CORS with proper configuration for SSE
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'http://localhost',
        'http://127.0.0.1:3000',
        'http://frontend:3000',
        'http://100.93.172.21:3000',
        true, // Allow all origins in development
      ],
      credentials: true, 
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      // Include common browser/request headers used by fetch/cache
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'Cache-Control',
        'Pragma',
        'If-None-Match',
        'If-Modified-Since'
      ],
      exposedHeaders: ['Content-Type', 'X-Total-Count', 'ETag'],
      maxAge: 3600,
    });

    const port = process.env.PORT || 5002;
    await app.listen(port);
    console.log('✅ Server started on port', port);
    console.log('✅ Environment:', process.env.NODE_ENV || 'development');
    console.log('✅ CORS origins: * (origin: true)');
    console.log('✅ Routes available at:');
    console.log(`   - http://100.93.172.21:${port}/api/watchlist/dates`);
    console.log(`   - http://100.93.172.21:${port}/api/lstmae/health`);
  } catch (err) {
    console.error('❌ NestJS failed to start:', err);
  }
}
bootstrap();
