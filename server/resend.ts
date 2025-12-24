/**
 * Email integration (Resend).
 *
 * If `RESEND_API_KEY` is not configured, email sends are skipped in development
 * and the functions return a `{ success: false }` result instead of crashing the
 * server at import time.
 */
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendWelcomeEmail(to: string, organizationName: string) {
  try {
    if (!resend) {
      console.warn('RESEND_API_KEY not set; skipping welcome email send');
      return { success: false, error: 'RESEND_API_KEY not set' };
    }
    await resend.emails.send({
      from: 'Analytics Platform <onboarding@resend.dev>',
      to,
      subject: 'Welcome to Analytics Platform!',
      html: `
        <h1>Welcome to Analytics Platform!</h1>
        <p>Your organization "${organizationName}" has been created successfully.</p>
        <p>You can now start tracking your analytics and managing your team.</p>
        <p>Get started by visiting your dashboard.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

export async function sendInviteEmail(to: string, inviterEmail: string, organizationName: string, inviteLink: string) {
  try {
    if (!resend) {
      console.warn('RESEND_API_KEY not set; skipping invite email send');
      return { success: false, error: 'RESEND_API_KEY not set' };
    }
    await resend.emails.send({
      from: 'Analytics Platform <onboarding@resend.dev>',
      to,
      subject: `You've been invited to join ${organizationName}`,
      html: `
        <h1>You've been invited!</h1>
        <p>${inviterEmail} has invited you to join "${organizationName}" on Analytics Platform.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
        <p>This invitation will expire in 7 days.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  try {
    if (!resend) {
      console.warn('RESEND_API_KEY not set; skipping password reset email send');
      return { success: false, error: 'RESEND_API_KEY not set' };
    }
    await resend.emails.send({
      from: 'Analytics Platform <onboarding@resend.dev>',
      to,
      subject: 'Reset your password',
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to continue:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}
