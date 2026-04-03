import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * # Database Module
 *
 * Provides PrismaClient access throughout the application.
 * Global module — no need to import in every feature module.
 *
 * ## Usage
 *
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private db: DatabaseService) {}
 *
 *   async findUser(id: string) {
 *     return this.db.user.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
