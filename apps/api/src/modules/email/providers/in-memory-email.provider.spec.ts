/**
 * # InMemoryEmailProvider Unit Tests
 *
 * Verifies that the in-memory provider captures and clears emails correctly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEmailProvider } from './in-memory-email.provider';

describe('InMemoryEmailProvider', () => {
  let provider: InMemoryEmailProvider;

  beforeEach(() => {
    provider = new InMemoryEmailProvider();
  });

  it('should capture sent emails', async () => {
    await provider.send({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    const emails = provider.getSentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe('user@example.com');
    expect(emails[0].subject).toBe('Test');
  });

  it('should capture multiple emails', async () => {
    await provider.send({ to: 'a@test.com', subject: 'First', html: '', text: '' });
    await provider.send({ to: 'b@test.com', subject: 'Second', html: '', text: '' });

    expect(provider.getSentEmails()).toHaveLength(2);
  });

  it('should clear sent emails', async () => {
    await provider.send({ to: 'a@test.com', subject: 'Test', html: '', text: '' });
    expect(provider.getSentEmails()).toHaveLength(1);

    provider.clearSentEmails();
    expect(provider.getSentEmails()).toHaveLength(0);
  });

  it('should store a copy (not a reference)', async () => {
    const options = { to: 'a@test.com', subject: 'Test', html: '', text: '' };
    await provider.send(options);

    // Mutating the original should NOT affect the stored copy
    options.to = 'mutated@test.com';
    expect(provider.getSentEmails()[0].to).toBe('a@test.com');
  });
});
