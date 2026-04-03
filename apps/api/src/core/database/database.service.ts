import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, PrismaPg } from '@paisa/db';

/**
 * # Database Service (Prisma 7)
 *
 * Extends PrismaClient with NestJS lifecycle hooks.
 * Connects on module init, disconnects on module destroy.
 *
 * ## Prisma 7 driver adapter
 *
 * Prisma 7 removed the Rust query engine. Database connections use
 * native Node.js drivers via `@prisma/adapter-pg`. The connection URL
 * is passed explicitly to the adapter (not auto-read from env).
 *
 * Inject as `DatabaseService` anywhere in the application.
 */
@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Check if the database is reachable.
   * Used by the health check endpoint.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
