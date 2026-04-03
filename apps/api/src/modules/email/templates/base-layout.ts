/**
 * # Base Email Layout
 *
 * Shared HTML wrapper for ALL transactional emails.
 * Provides consistent branding: header with app name, content area,
 * and footer with company name + legal links.
 *
 * ## Why inline CSS?
 *
 * Email clients (Gmail, Outlook, Apple Mail) handle CSS differently:
 * - Gmail strips `<style>` blocks in some views
 * - Outlook uses Word's HTML engine (yes, really)
 * - Mobile clients have tiny viewports
 *
 * Inline CSS is the only reliable way to style emails across all clients.
 * It's ugly to write but guaranteed to render consistently.
 *
 * ## Why not MJML or React Email?
 *
 * Those are great tools, but they add dependencies and build steps.
 * For a boilerplate's transactional emails (which are simple and few),
 * hand-crafted HTML with inline styles is simpler and more portable.
 * If you need complex marketing emails later, swap this layer out.
 */
import { brand } from '@paisa/config';

interface LayoutOptions {
  /** The main HTML content of the email */
  content: string;
  /** Short preview text shown in email client list view (before opening) */
  preheader?: string;
}

/**
 * Wrap email content in the branded layout.
 * Returns the complete HTML document string.
 */
export function baseLayout({ content, preheader }: LayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brand.name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<!--
    Preheader text: shown in email client list view but hidden in the email body.
    The invisible characters push the preheader text out of the preview.
  -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${preheader}
    ${'&nbsp;&zwnj;'.repeat(30)}
  </div>` : ''}

  <!-- Outer table for centering -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Inner container (max 560px) -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <span style="font-size: 24px; font-weight: 700; color: #18181b; letter-spacing: -0.025em;">
                ${brand.name}
              </span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #71717a;">
                ${brand.company}
              </p>
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                <a href="${brand.termsUrl}" style="color: #a1a1aa; text-decoration: underline;">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${brand.privacyUrl}" style="color: #a1a1aa; text-decoration: underline;">Privacy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
