import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get the underlying HTTP server
  const server = app.getHttpServer();
  
  // Set timeout to 5 minutes (300000 milliseconds)
  server.setTimeout(300000);
  
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();