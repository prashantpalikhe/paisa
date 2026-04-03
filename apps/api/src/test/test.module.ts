/**
 * # Test Module
 *
 * Provides test-only API endpoints for Playwright e2e tests.
 * Conditionally loaded in AppModule ONLY when NODE_ENV=test.
 *
 * ## What it provides
 *
 * - POST /test/reset-database — Truncate all tables between tests
 * - GET /test/emails — Read captured emails (InMemoryEmailProvider)
 * - DELETE /test/emails — Clear email inbox
 *
 * ## Dependencies
 *
 * - DatabaseService: From the global DatabaseModule (auto-available)
 * - EMAIL_PROVIDER: From EmailModule — but only if email feature is enabled.
 *   The @Optional() decorator on TestController handles the case when it's not.
 */
import { Module } from '@nestjs/common';
import { TestController } from './test.controller';

@Module({
  controllers: [TestController],
})
export class TestModule {}
