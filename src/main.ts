import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

/**
 * Entry point for the Time-Off Microservice.
 * Initializes the NestJS application with Pino logging and global configuration.
 */
async function bootstrap() {
  // Create the Nest application instance using the root AppModule.
  // bufferLogs: true ensures that initial logs are buffered until the logger is ready.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use nestjs-pino for high-performance structured JSON logging.
  app.useLogger(app.get(Logger));

  // Enable global validation piping for automatic DTO schema enforcement.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Time-Off Microservice')
    .setDescription(
      'The Time-Off Microservice API provides a resilient interface for managing employee leave requests and HCM balance synchronization.',
    )
    .setVersion('1.0')
    .addTag('Time-Off Requests')
    .addTag('Balances & Sync')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Determine the application port from environment variables, defaulting to 3000.
  const port = process.env.PORT ?? 3000;

  // Start the server and listen for incoming HTTP requests.
  await app.listen(port);

  // Beautified Terminal Startup Log
  console.log(`
  \x1b[35m╔══════════════════════════════════════════════════════════════╗\x1b[0m
  \x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m
  \x1b[35m║\x1b[0m    \x1b[1m🚀 TIME-OFF MICROSERVICE IS LIVE\x1b[0m                          \x1b[35m║\x1b[0m
  \x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m
  \x1b[35m║\x1b[0m    \x1b[32m✔ App URL:\x1b[0m      \x1b[4mhttp://localhost:${port}\x1b[0m                \x1b[35m║\x1b[0m
  \x1b[35m║\x1b[0m    \x1b[34m✔ Swagger UI:\x1b[0m   \x1b[4mhttp://localhost:${port}/docs\x1b[0m           \x1b[35m║\x1b[0m
  \x1b[35m║\x1b[0m                                                              \x1b[35m║\x1b[0m
  \x1b[35m╚══════════════════════════════════════════════════════════════╝\x1b[0m
  `);
}

// Execute the bootstrap function and handle any startup failures.
bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
