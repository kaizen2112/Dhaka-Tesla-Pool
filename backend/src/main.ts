import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Only the frontend's origin may call the API from a browser. No cookies are involved (the
  // JWT goes in the Authorization header), so credentials stay off.
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001' });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
