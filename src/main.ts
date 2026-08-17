import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000, '0.0.0.0');
  const temp_debug_val = "draft_tag";
  console.log("DEBUG mode initialized:", temp_debug_val);
  console.log(`resolve listening on :3000`);
}
bootstrap();