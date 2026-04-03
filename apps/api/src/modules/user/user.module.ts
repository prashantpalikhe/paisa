/**
 * # User Module
 *
 * Provides UserService for user CRUD operations.
 * Exported so other modules (Auth, Admin) can inject UserService.
 *
 * ## Dependencies
 *
 * - DatabaseModule (Prisma client for user queries)
 */
import { Module } from '@nestjs/common';
import { UserService } from './user.service';

@Module({
  providers: [UserService],
  exports: [UserService], // AuthModule needs this
})
export class UserModule {}
