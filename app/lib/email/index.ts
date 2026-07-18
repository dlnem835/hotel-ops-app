export { escapeHtml } from "@/app/lib/email/escape-html";
export {
  EMAIL_FROM_DEFAULT,
  EMAIL_LOGO_PATH,
  EMAIL_SUPPORT_ADDRESS,
  EMAIL_THEME,
  getEmailLogoUrl,
  getEmailSiteOrigin,
} from "@/app/lib/email/brand";
export { renderTransactionalEmailHtml } from "@/app/lib/email/transactional-layout";
export {
  INVITATION_EMAIL_SUBJECT,
  buildInvitationEmail,
  getInvitationEmailMustacheTemplate,
  type InvitationEmailContent,
  type InvitationEmailVariables,
} from "@/app/lib/email/invitation-email";
export type {
  TransactionalEmailCta,
  TransactionalEmailKind,
  TransactionalEmailLayoutInput,
} from "@/app/lib/email/types";
