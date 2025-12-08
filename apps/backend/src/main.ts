// apps/backend/src/main.ts
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    // ✅ REMOVE GLOBAL PREFIX - Let controllers handle their own paths
    // app.setGlobalPrefix('api'); // DON'T DO THIS
    
    app.enableCors({
      origin: '*',
      credentials: true,
    });
    
    await app.listen(process.env.PORT|| 5002);
    console.log('✅ Server started on port', process.env.PORT || 5002);
    console.log('✅ Routes available at:');
    console.log('   - http://localhost:5002/api/lstmae/health');
    console.log('   - http://localhost:5002/api/lstmae/SYMBOL/plot/TYPE');
  } catch (err) {
    console.error('❌ NestJS failed to start:', err);
  }
}
bootstrap();
