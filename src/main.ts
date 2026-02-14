import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { loggerConfig } from './config/logger.config';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: loggerConfig,
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Add raw body logging middleware BEFORE validation
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (
      req.url.includes('/cafe-admin/tasks/templates') &&
      req.method === 'POST'
    ) {
      console.log('[RAW REQUEST] URL:', req.url);
      console.log('[RAW REQUEST] Method:', req.method);
      console.log(
        '[RAW REQUEST] Headers:',
        JSON.stringify(req.headers, null, 2),
      );
      console.log('[RAW REQUEST] Body:', JSON.stringify(req.body, null, 2));
    }
    next();
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
