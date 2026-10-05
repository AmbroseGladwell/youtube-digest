export interface TransactionalEmailSlots {
  subject: string;
  preview: string;
  greeting: string | null;
  heading: string;
  body: string;
  action: { label: string; link: string };
  notes: string[];
  reason: string;
  siteUrl: string;
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const light = {
  ground: "#F6F4F0",
  card: "#FFFFFF",
  ink: "#151618",
  muted: "#5F5C57",
  link: "#B03C12",
  rule: "#EAE7E1",
};

const dark = {
  ground: "#151618",
  card: "#1E1F22",
  ink: "#F2EFE9",
  muted: "#A6A49E",
  link: "#F0794A",
  rule: "#2C2B29",
};

const button = "#CF4718";
const serif = "'Gloock', Georgia, 'Times New Roman', serif";
const sans = "'Figtree', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

// Inboxes fill the preview line from the body when the preview text runs out, which would
// pull in "The Overview" from the header.
const previewPadding = "&#847;&zwnj;&nbsp;".repeat(60);

const styles = `
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 480px) {
    .ov-shell { padding: 28px 12px 32px !important; }
    .ov-brand, .ov-footer { padding-left: 12px !important; padding-right: 12px !important; }
    .ov-card { padding: 28px 22px !important; }
    .ov-heading { font-size: 26px !important; }
    .ov-button-table { width: 100% !important; }
    .ov-button { display: block !important; }
  }
  @media (prefers-color-scheme: dark) {
    .ov-ground { background-color: ${dark.ground} !important; }
    .ov-card { background-color: ${dark.card} !important; }
    .ov-ink { color: ${dark.ink} !important; }
    .ov-muted { color: ${dark.muted} !important; }
    .ov-link { color: ${dark.link} !important; }
    .ov-rule { background-color: ${dark.rule} !important; }
  }
  [data-ogsc] .ov-ground { background-color: ${dark.ground} !important; }
  [data-ogsc] .ov-card { background-color: ${dark.card} !important; }
  [data-ogsc] .ov-ink { color: ${dark.ink} !important; }
  [data-ogsc] .ov-muted { color: ${dark.muted} !important; }
  [data-ogsc] .ov-link { color: ${dark.link} !important; }
`;

// Design OV-88: one shell every transactional mail fills, so a later mail (an email change,
// a receipt) brings only its words (docs/features/sign-in.md, "The mail").
export function transactionalEmailHtml(slots: TransactionalEmailSlots): string {
  const link = escapeHtml(slots.action.link);
  const site = escapeHtml(slots.siteUrl);
  const siteLabel = escapeHtml(new URL(slots.siteUrl).host);
  const label = escapeHtml(slots.action.label);
  const vmlWidth = slots.action.label.length * 10 + 64;

  const greeting =
    slots.greeting === null
      ? ""
      : `<p class="ov-ink" style="margin: 0 0 10px; font-family: ${sans}; font-size: 16px; line-height: 24px; color: ${light.ink};">${escapeHtml(slots.greeting)}</p>`;

  const notes = slots.notes
    .map(
      (note, index) =>
        `<p class="ov-muted" style="margin: 0 0 ${index === slots.notes.length - 1 ? 0 : 10}px; font-family: ${sans}; font-size: 14px; line-height: 21px; color: ${light.muted};">${escapeHtml(note)}</p>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(slots.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Gloock&amp;family=Figtree:wght@400;600&amp;display=swap" rel="stylesheet"><!--<![endif]-->
<style>${styles}</style>
</head>
<body class="ov-ground" style="margin: 0; padding: 0; background-color: ${light.ground};">
<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${light.ground}; opacity: 0;">${escapeHtml(slots.preview)}${previewPadding}</div>
<table role="presentation" class="ov-ground" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${light.ground};">
<tr>
<td align="center" style="padding: 0;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
<tr>
<td class="ov-shell" style="padding: 40px 32px 44px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="ov-brand" style="padding: 0 8px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding: 0 10px 0 0; vertical-align: middle;"><img src="${site}/email-mark.png" width="28" height="28" alt="" style="display: block; width: 28px; height: 28px; border: 0;"></td>
<td class="ov-ink" style="vertical-align: middle; font-family: ${serif}; font-size: 20px; line-height: 28px; color: ${light.ink};">The Overview</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="ov-card" style="background-color: ${light.card}; border-radius: 20px; padding: 40px 40px 36px; font-family: ${sans}; color: ${light.ink};">
${greeting}
<h1 class="ov-heading ov-ink" style="margin: 0 0 12px; font-family: ${serif}; font-weight: 400; font-size: 32px; line-height: 37px; color: ${light.ink};">${escapeHtml(slots.heading)}</h1>
<p class="ov-ink" style="margin: 0 0 28px; font-family: ${sans}; font-size: 16px; line-height: 25px; color: ${light.ink};">${escapeHtml(slots.body)}</p>
<table role="presentation" class="ov-button-table" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
<tr>
<td align="center" bgcolor="${button}" style="border-radius: 999px; background-color: ${button};">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${link}" style="height:50px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="50%" stroke="f" fillcolor="${button}"><w:anchorlock/><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a class="ov-button" href="${link}" style="display: inline-block; background-color: ${button}; color: #FFFFFF; font-family: ${sans}; font-size: 16px; font-weight: 600; line-height: 20px; text-decoration: none; text-align: center; padding: 15px 32px; border-radius: 999px;">${label}</a><!--<![endif]-->
</td>
</tr>
</table>
<p class="ov-muted" style="margin: 0 0 4px; font-family: ${sans}; font-size: 13.5px; line-height: 20px; color: ${light.muted};">Button not working? Paste this link into your browser:</p>
<p style="margin: 0; font-family: ${sans}; font-size: 13.5px; line-height: 20px; word-break: break-all;"><a class="ov-link" href="${link}" style="color: ${light.link}; text-decoration: underline;">${link}</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 20px;">
<tr><td class="ov-rule" height="1" style="height: 1px; line-height: 1px; font-size: 1px; background-color: ${light.rule};">&nbsp;</td></tr>
</table>
${notes}
</td>
</tr>
<tr>
<td class="ov-footer ov-muted" style="padding: 24px 8px 0; font-family: ${sans}; font-size: 12.5px; line-height: 19px; color: ${light.muted};">
<p style="margin: 0 0 6px;">${escapeHtml(slots.reason)}</p>
<p style="margin: 0;"><span class="ov-ink" style="color: ${light.ink}; font-weight: 600;">The Overview</span> · <a class="ov-link" href="${site}" style="color: ${light.link};">${siteLabel}</a> · <a class="ov-link" href="${site}/privacy" style="color: ${light.link};">Privacy policy</a></p>
</td>
</tr>
</table>
</td>
</tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>
`;
}
