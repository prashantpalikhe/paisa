/**
 * # Test Controller
 *
 * Exposes endpoints used ONLY by e2e tests (Playwright).
 * These endpoints do NOT exist in production — the entire TestModule
 * is conditionally loaded only when `NODE_ENV=test`.
 *
 * ## Endpoints
 *
 * | Method | Path                  | Purpose                          |
 * |--------|-----------------------|----------------------------------|
 * | POST   | /test/reset-database  | Truncate all tables              |
 * | GET    | /test/emails          | Get captured emails (InMemory)   |
 * | DELETE | /test/emails          | Clear the email inbox            |
 *
 * ## Why not just use the database directly from Playwright?
 *
 * Playwright runs in a separate process — it can't share a PrismaClient
 * with the running NestJS app. These HTTP endpoints bridge that gap.
 *
 * ## Security
 *
 * The TestModule is only imported when NODE_ENV=test (see app.module.ts).
 * In production, these routes literally don't exist — they're not
 * "disabled", they're not registered at all.
 */
import { Controller, Delete, Get, Inject, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { DatabaseService } from '../core/database/database.service';
import { EMAIL_PROVIDER } from '../modules/email/providers/email-provider.interface';
import { InMemoryEmailProvider } from '../modules/email/providers/in-memory-email.provider';

@ApiExcludeController() // Hide from Swagger docs
@Controller('test')
export class TestController {
  constructor(
    private readonly db: DatabaseService,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: InMemoryEmailProvider,
  ) {}

  /**
   * Truncate all application tables.
   * Same logic as `test/helpers/reset-database.ts` but accessible via HTTP.
   */
  @Public()
  @Post('reset-database')
  async resetDatabase() {
    const tables: Array<{ tablename: string }> = await this.db.$queryRaw`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '_prisma%'
    `;

    if (tables.length > 0) {
      const tableList = tables.map((t) => `"${t.tablename}"`).join(', ');
      await this.db.$executeRawUnsafe(
        `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
      );
    }

    return { message: 'Database reset' };
  }

  /**
   * Get all captured emails.
   * Only works when the email provider is InMemoryEmailProvider (test env).
   */
  @Public()
  @Get('emails')
  getEmails() {
    if (!this.emailProvider || !('getSentEmails' in this.emailProvider)) {
      return { emails: [], warning: 'Email provider is not InMemoryEmailProvider' };
    }

    return { emails: this.emailProvider.getSentEmails() };
  }

  /**
   * Clear all captured emails.
   * Call this between tests to get a clean inbox.
   */
  @Public()
  @Delete('emails')
  clearEmails() {
    if (this.emailProvider && 'clearSentEmails' in this.emailProvider) {
      this.emailProvider.clearSentEmails();
    }

    return { message: 'Emails cleared' };
  }
}
