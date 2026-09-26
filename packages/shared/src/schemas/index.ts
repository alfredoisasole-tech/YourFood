/**
 * Schémas de validation Zod partagés entre backend et frontend.
 *
 * Ces schémas sont la source unique de validation des données métier.
 * Le backend les utilise pour valider les requêtes entrantes.
 * Le frontend les utilise pour valider les formulaires côté client.
 */

import { z } from 'zod';
import {
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  OfferCategory,
  OrderStatus,
} from '../types';

// ─── Schémas de base (réutilisables) ────────────────────────────

/** Validation d'un UUID v4 */
export const uuidSchema = z.string().uuid();

/** Validation d'un numéro de téléphone (format flexible, 8-15 chiffres) */
export const phoneSchema = z
  .string()
  .min(8, 'Le numéro de téléphone doit contenir au moins 8 chiffres')
  .max(15, 'Le numéro de téléphone ne peut pas dépasser 15 chiffres')
  .regex(/^[+]?[\d\s-]+$/, 'Format de numéro de téléphone invalide');

/** Validation du mot de passe (min 8 caractères, au moins 1 majuscule, 1 chiffre) */
export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre');

/** Validation d'un code d'accès (8 caractères : 2 initiales + 6 alphanumériques/spéciaux) */
export const accessCodeSchema = z
  .string()
  .length(8, 'Le code d\'accès doit contenir exactement 8 caractères')
  .regex(
    /^[A-Z]{2}[A-Za-z0-9\-_.]{6}$/,
    'Le code doit commencer par 2 initiales majuscules suivies de 6 caractères alphanumériques ou -_.'
  );

/** Validation d'une note (1-5 étoiles) */
export const ratingSchema = z
  .number()
  .int('La note doit être un nombre entier')
  .min(1, 'La note minimale est 1')
  .max(5, 'La note maximale est 5');

/** Validation d'une date au format ISO */
export const dateSchema = z.string().datetime({ message: 'Format de date invalide (ISO 8601 attendu)' });

/** Validation d'une date au format YYYY-MM-DD */
export const dateOnlySchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Format de date invalide (YYYY-MM-DD attendu)'
);

// ─── Schémas métier ─────────────────────────────────────────────

/** Schéma : Inscription d'un client (côté admin) */
export const createClientSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis').max(100),
  lastName: z.string().min(1, 'Le nom est requis').max(100),
  phone: phoneSchema,
  email: z.string().email('Email invalide').optional(),
  plan: z.nativeEnum(SubscriptionPlan, {
    errorMap: () => ({ message: 'Formule invalide (BASIC ou PREMIUM)' }),
  }),
  startDate: dateOnlySchema,
  durationDays: z
    .number()
    .int()
    .min(1, 'La durée doit être d\'au moins 1 jour')
    .max(365, 'La durée ne peut pas dépasser 365 jours'),
  bonus: z.string().max(500).optional(),
});

/** Schéma : Première connexion (nom + code + nouveau mot de passe) */
export const firstLoginSchema = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  code: accessCodeSchema,
  newPassword: passwordSchema,
});

/** Schéma : Connexion classique (nom + mot de passe) */
export const loginSchema = z.object({
  lastName: z.string().min(1, 'Le nom est requis'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

/** Schéma : Modification du mot de passe */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: passwordSchema,
});

/** Schéma : Création d'une option d'offre */
export const createOfferOptionSchema = z.object({
  category: z.nativeEnum(OfferCategory, {
    errorMap: () => ({ message: 'Catégorie invalide (PLAT, ACCOMPAGNEMENT ou VIANDE)' }),
  }),
  name: z.string().min(1, 'Le nom de l\'option est requis').max(200),
  description: z.string().max(1000).optional(),
});

/** Schéma : Création d'une offre journalière (6 options : 2 par catégorie) */
export const createDailyOfferSchema = z.object({
  date: dateOnlySchema,
  options: z
    .array(createOfferOptionSchema)
    .length(6, 'L\'offre doit contenir exactement 6 options (2 par catégorie)')
    .refine(
      (options) => {
        const categories = options.map((o) => o.category);
        const counts: Record<string, number> = {};
        for (const cat of categories) {
          counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return (
          counts[OfferCategory.PLAT] === 2 &&
          counts[OfferCategory.ACCOMPAGNEMENT] === 2 &&
          counts[OfferCategory.VIANDE] === 2
        );
      },
      { message: 'L\'offre doit contenir exactement 2 options par catégorie' }
    ),
});

/** Schéma : Passage d'une commande (1 choix par catégorie = 3 items) */
export const createOrderSchema = z.object({
  dailyOfferId: uuidSchema,
  items: z
    .array(
      z.object({
        offerOptionId: uuidSchema,
      })
    )
    .min(1, 'Au moins un choix est requis')
    .max(3, 'Maximum 3 choix (un par catégorie)'),
});

/** Schéma : Soumission d'un avis */
export const createReviewSchema = z.object({
  orderId: uuidSchema,
  rating: ratingSchema,
  comment: z.string().max(2000, 'Le commentaire ne peut pas dépasser 2000 caractères').optional(),
});

// ─── Types inférés des schémas ──────────────────────────────────

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type FirstLoginInput = z.infer<typeof firstLoginSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateOfferOptionInput = z.infer<typeof createOfferOptionSchema>;
export type CreateDailyOfferInput = z.infer<typeof createDailyOfferSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
