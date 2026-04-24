import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';

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

  // Determine the application port from environment variables, defaulting to 3000.
  const port = process.env.PORT ?? 3000;

  // Start the server and listen for incoming HTTP requests.
  await app.listen(port);

  // Standard console log for local development visibility.
  console.log(`Application is running on: http://localhost:${port}`);
}

// Execute the bootstrap function and handle any startup failures.
bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
