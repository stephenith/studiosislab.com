import { getPublicAppUrl } from "@/lib/getPublicAppUrl";

export function getEsignBrandLogoUrl(): string {
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/branding/icon-192.png`;
}

/**
 * Table-safe header row for StudiosisLab e-sign transactional emails.
 */
export function renderEsignEmailHeader(eyebrow: string): string {
  const logoUrl = getEsignBrandLogoUrl();

  return `
            <tr>
              <td style="padding:20px 24px 12px 24px;border-bottom:1px solid #e5e5e5;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                  <tr>
                    <td width="48" valign="middle" style="padding:0 12px 0 0;">
                      <img
                        src="${logoUrl}"
                        alt="StudiosisLab"
                        width="40"
                        height="40"
                        style="display:block;border:0;outline:none;text-decoration:none;border-radius:8px;"
                      />
                    </td>
                    <td valign="middle" style="padding:0;">
                      <div style="font-size:18px;font-weight:600;color:#111827;line-height:1.3;">
                        StudiosisLab
                      </div>
                      <div style="margin-top:4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;line-height:1.4;">
                        ${eyebrow}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
}
