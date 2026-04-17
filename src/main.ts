import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      colors: false,
    }),
  });
  const port = process.env.PORT ?? 8000;

  // Global validation for each route handler
  app.useGlobalPipes(new ValidationPipe({transform: true}));

  await app.listen(port, () => {
    console.log(`Application running on http://localhost:${port}`);
  });
}
bootstrap();
