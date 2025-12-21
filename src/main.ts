import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { loggerConfig } from './config/logger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: loggerConfig,
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Time Cafe Shared API')
    .setDescription(
      'API for Time Cafe shared service. Complete API documentation with examples.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3000', 'Development server')
    .addTag('System', 'System endpoints for health checks and monitoring')
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Auth Test', 'Keycloak integration test endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Brands', 'Brand management endpoints')
    .addTag('Cafes', 'Cafe management endpoints')
    .addTag('System Admin', 'System administrator endpoints')
    .addTag('Brand Admin', 'Brand administrator endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Shared service running on port ${port}`);
}
void bootstrap();
