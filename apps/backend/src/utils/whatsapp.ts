/**
 * Utilitaires pour les liens WhatsApp (Web & mobile).
 * Conforme à SPEC.md (5.2 & 5.3).
 */

/**
 * Nettoie le numéro de téléphone pour l'API WhatsApp (chiffres uniquement, sans le '+').
 * Ex: '+243812345678' -> '243812345678'
 */
export function formatPhoneForWhatsApp(telephone: string): string {
  return telephone.replace(/\D/g, '');
}

/**
 * Génère le lien WhatsApp avec message de bienvenue pré-rempli pour l'activation initiale.
 */
export function buildActivationWhatsAppUrl(
  telephone: string,
  prenom: string,
  code: string,
  activationLink: string
): string {
  const phoneClean = formatPhoneForWhatsApp(telephone);
  const message = `Bonjour ${prenom} ! Bienvenue sur YourFood.\nVoici votre lien d'activation : ${activationLink}\nVotre code d'activation est : ${code}\nCe code vous permettra de définir votre mot de passe lors de votre première connexion.`;
  return `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
}

/**
 * Génère le lien WhatsApp avec message pré-rempli pour la réinitialisation de mot de passe oublié.
 */
export function buildResetPasswordWhatsAppUrl(
  telephone: string,
  prenom: string,
  code: string,
  resetLink: string
): string {
  const phoneClean = formatPhoneForWhatsApp(telephone);
  const message = `Bonjour ${prenom},\nVous avez demandé la réinitialisation de votre mot de passe YourFood.\nVoici votre lien : ${resetLink}\nVotre code temporaire à usage unique est : ${code}`;
  return `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
}
