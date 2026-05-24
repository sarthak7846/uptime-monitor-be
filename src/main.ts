import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      colors: false,
    }),
  });
  const port = process.env.PORT ?? 8001;

  // Global validation for each route handler
  app.useGlobalPipes(new ValidationPipe({transform: true}));
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true
  });
  app.use(cookieParser());
  app.enableShutdownHooks();
  
  await app.listen(port, () => {
    console.log(`Application running on http://localhost:${port}`);
  });
}
bootstrap();
