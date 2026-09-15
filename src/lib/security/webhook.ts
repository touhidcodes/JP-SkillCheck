/**
 * Webhook Notifications
 *
 * Sends real-time alerts to Discord/Slack channels for critical events.
 * Configured via WEBHOOK_URL environment variable.
 */

import { sanitizeForHtml } from './sanitize';

interface WebhookPayload {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
}

export async function sendWebhookAlert(payload: WebhookPayload): Promise<boolean> {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const isDiscord = webhookUrl.includes('discord');
    const isSlack = webhookUrl.includes('slack');

    let body: Record<string, unknown>;

    if (isDiscord) {
      body = {
        embeds: [{
          title: payload.title,
          description: payload.description,
          color: payload.color,
          fields: payload.fields?.map(f => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false,
          })),
          footer: payload.footer ? { text: payload.footer } : undefined,
          timestamp: new Date().toISOString(),
        }],
      };
    } else if (isSlack) {
      const fieldBlocks = payload.fields?.map(f => ({
        type: 'mrkdwn',
        text: `*${f.name}:* ${f.value}`,
      })) ?? [];

      body = {
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: payload.title } },
          { type: 'section', text: { type: 'mrkdwn', text: payload.description } },
          ...fieldBlocks.map(f => ({ type: 'section' as const, text: f })),
          ...(payload.footer ? [{ type: 'context' as const, elements: [{ type: 'plain_text' as const, text: payload.footer }] }] : []),
        ],
      };
    } else {
      body = { text: `${payload.title}\n${payload.description}` };
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`[Webhook] Failed to send: ${res.status} ${res.statusText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Webhook] Error sending alert:', err);
    return false;
  }
}

export async function sendRiskAlertWebhook(
  studentName: string,
  mentorEmail: string,
  reasons: string,
  probability: number
): Promise<boolean> {
  return sendWebhookAlert({
    title: '⚠️ Student At Risk',
    description: `**${sanitizeForHtml(studentName)}** has been flagged as at risk`,
    color: 0xdc2626,
    fields: [
      { name: 'Mentor', value: mentorEmail, inline: true },
      { name: 'Risk %', value: `${Math.round(probability * 100)}%`, inline: true },
      { name: 'Reasons', value: reasons },
    ],
    footer: 'Placement Dashboard — Risk Engine',
  });
}

export async function sendRiskResolvedWebhook(
  studentName: string,
  mentorEmail: string
): Promise<boolean> {
  return sendWebhookAlert({
    title: '✅ Student Risk Resolved',
    description: `**${sanitizeForHtml(studentName)}** is no longer at risk`,
    color: 0x10b981,
    fields: [
      { name: 'Mentor', value: mentorEmail, inline: true },
    ],
    footer: 'Placement Dashboard — Risk Engine',
  });
}
