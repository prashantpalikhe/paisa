/**
 * # ConsoleEmailProvider Unit Tests
 *
 * Not much to test — just verify it doesn't throw.
 */
import { describe, it, expect } from 'vitest';
import { ConsoleEmailProvider } from './console-email.provider';

describe('ConsoleEmailProvider', () => {
  it('should not throw when sending', async () => {
    const provider = new ConsoleEmailProvider();

    await expect(
      provider.send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello World</p>',
        text: 'Hello World',
      }),
    ).resolves.not.toThrow();
  });

  it('should handle long text without throwing', async () => {
    const provider = new ConsoleEmailProvider();

    await expect(
      provider.send({
        to: 'user@example.com',
        subject: 'Long Email',
        html: '<p>' + 'x'.repeat(1000) + '</p>',
        text: 'x'.repeat(1000),
      }),
    ).resolves.not.toThrow();
  });
});
