export {
  EMAIL_FROM_DEFAULT,
  EMAIL_LOGO_PATH,
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
export {
  resolveAppUrl,
  resolveAuthEmailConfig,
  resolvePasswordResetRedirectUrl,
  type AuthEmailConfig,
} from "@/app/lib/email/auth-email-config";
export { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";
export {
  INVITATION_EMAIL_SUBJECT,
  buildInvitationEmail,
  getInvitationEmailMustacheTemplate,
  type InvitationEmailContent,
  type InvitationEmailVariables,
} from "@/app/lib/email/invitation-email";
export {
  PASSWORD_RESET_EMAIL_SUBJECT,
  buildPasswordResetEmail,
  type PasswordResetEmailContent,
  type PasswordResetEmailVariables,
} from "@/app/lib/email/password-reset-email";
export { dispatchPasswordResetEmail } from "@/app/lib/email/dispatch-password-reset";
export { escapeHtml } from "@/app/lib/email/escape-html";
export type {
  TransactionalEmailCta,
  TransactionalEmailKind,
  TransactionalEmailLayoutInput,
} from "@/app/lib/email/types";

