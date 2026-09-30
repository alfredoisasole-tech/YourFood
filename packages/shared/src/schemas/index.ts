/**
 * Schémas de validation Zod partagés entre backend et frontend.
 *
 * Source unique de vérité pour la validation des données d'entrée :
 * - Le backend valide les payloads des requêtes HTTP reçues.
 * - Le frontend valide les formulaires avant soumission.
 * Basé sur SPEC.md (Spécification finale, v3.1).
 */

import { z } from 'zod';
import { SubscriptionPlan, ItemCategory } from '../types';
import { INTERNATIONAL_PHONE_REGEX, normalizePhone } from '../utils/phone';
import { MAX_DURATION_VALUE, isMonday, isWeekday } from '../utils/subscription';

// ─── Schémas atomiques réutilisables ───────────────────────────

/** ID entier positif (PostgreSQL SERIAL) */
export const idSchema = z.number().int().positive();

/**
 * Numéro de téléphone avec indicatif pays obligatoire (ex: +243XXXXXXXXX ou +33XXXXXXXXX).
 * SPEC 5.1 : "normalisé avec indicatif pays à la saisie". Espaces et tirets sont tolérés.
 */
export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((value) => INTERNATIONAL_PHONE_REGEX.test(value), {
    message: 'Le numéro de téléphone doit être au format international avec indicatif (ex: +243812345678)',
  });

/** Numéro facultatif : une chaîne vide équivaut à « pas de numéro » */
export const optionalPhoneSchema = z
  .union([z.literal('').transform(() => undefined), phoneSchema])
  .optional();

/**
 * Code d'activation à 8 caractères : 2 initiales majuscules + 6 caractères alphanumériques ou -_.
 * SPEC 5.2 : "2 initiales (nom + prénom) + 6 caractères aléatoires (lettres, chiffres, - _ . )".
 */
export const accessCodeSchema = z
  .string()
  .trim()
  .length(8, "Le code d'accès doit comporter exactement 8 caractères")
  .regex(
    /^[A-Z]{2}[A-Za-z0-9\-_.]{6}$/,
    "Le code doit être composé des 2 initiales majuscules suivies de 6 caractères (lettres, chiffres, '-', '_', '.')"
  );

/** Code saisi ou collé par le client : l'affichage « RN7Q 3M8K » (avec espace) est accepté */
export const accessCodeInputSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(accessCodeSchema);

/** Identifiant de connexion : « Prénom Nom » */
export const identifiantSchema = z
  .string()
  .trim()
  .min(1, 'Ton nom est obligatoire')
  .max(220);

/** Mot de passe utilisateur : 8 caractères minimum */
export const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères');

/** Date au format YYYY-MM-DD */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (attendu : YYYY-MM-DD)');

/** Jour ouvré (lundi à vendredi) */
export const weekdaySchema = dateOnlySchema.refine(isWeekday, {
  message: 'La date doit tomber un jour ouvré (lundi à vendredi)',
});

/** Un abonnement commence toujours un lundi */
export const mondaySchema = dateOnlySchema.refine(isMonday, {
  message: 'Un abonnement doit commencer un lundi',
});

/** Heure au format HH:mm */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format d\'heure invalide (attendu : HH:mm)');

/** Heure limite indicative : entre 11h00 et 19h00 (le verrouillage reste fixé à 20h00) */
export const deadlineTimeSchema = timeSchema.refine(
  (value) => value >= '11:00' && value <= '19:00',
  { message: 'L\'heure limite indicative doit être comprise entre 11h00 et 19h00' }
);

/** Note étoile de 1 à 5 */
export const ratingSchema = z
  .number()
  .int()
  .min(1, 'La note minimale est 1 étoile')
  .max(5, 'La note maximale est 5 étoiles');

/** Durée d'abonnement : 1 à 3 semaines, ou 1 à 12 mois (1 mois = 4 semaines) */
export const durationSchema = z
  .object({
    unite: z.enum(['semaines', 'mois']),
    valeur: z.number().int().min(1, 'La durée doit être d\'au moins 1'),
  })
  .superRefine((duree, ctx) => {
    if (duree.valeur > MAX_DURATION_VALUE[duree.unite]) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MAX_DURATION_VALUE[duree.unite],
        type: 'number',
        inclusive: true,
        path: ['valeur'],
        message: `La durée ne peut pas dépasser ${MAX_DURATION_VALUE[duree.unite]} ${duree.unite}`,
      });
    }
  });

// ─── Schémas d'Authentification & Clients ────────────────────────

/** Inscription d'un client par l'administratrice (SPEC 5.1 & 5.2) */
export const createClientSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire').max(100),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire').max(100),
  telephone: optionalPhoneSchema,
  formule: z.nativeEnum(SubscriptionPlan, {
    errorMap: () => ({ message: 'Formule invalide (25000 ou 35000 attendu)' }),
  }),
  duree: durationSchema,
  dateDebut: mondaySchema.optional(),
  bonus: z.string().trim().max(500).optional(),
});

/** Vérification du code avant la création du mot de passe (SPEC 7 : « Code accepté ») */
export const verifyCodeSchema = z.object({
  identifiant: identifiantSchema,
  code: accessCodeInputSchema,
});

/** Première connexion avec code d'activation (SPEC 5.3 & 7) */
export const firstLoginSchema = z.object({
  identifiant: identifiantSchema,
  code: accessCodeInputSchema,
  nouveauMotDePasse: passwordSchema,
});

/** Connexions ultérieures : identifiant + mot de passe (SPEC 5.3 & 7) */
export const loginSchema = z.object({
  identifiant: identifiantSchema,
  motDePasse: z.string().min(1, 'Le mot de passe est obligatoire'),
});

/** Modification du mot de passe par le client connecté (SPEC 5.3) */
export const changePasswordSchema = z.object({
  ancienMotDePasse: z.string().min(1, 'L\'ancien mot de passe est requis'),
  nouveauMotDePasse: passwordSchema,
});

/** Réinitialisation du mot de passe demandée par l'admin (SPEC 5.3) */
export const resetPasswordRequestSchema = z.object({
  subscriptionId: idSchema,
});

/** Renouvellement ou prolongation d'un abonnement par l'admin (SPEC 5.11) */
export const renewSubscriptionSchema = z.object({
  duree: durationSchema,
  formule: z.nativeEnum(SubscriptionPlan).optional(),
  dateDebut: mondaySchema.optional(),
});

/** Modification des informations d'un client (au moins un champ) */
export const updateClientSchema = z
  .object({
    nom: z.string().trim().min(1, 'Le nom est obligatoire').max(100).optional(),
    prenom: z.string().trim().min(1, 'Le prénom est obligatoire').max(100).optional(),
    telephone: z
      .union([z.null(), z.literal('').transform(() => null), phoneSchema])
      .optional(),
    bonus: z
      .union([z.null(), z.string().trim().max(500).transform((value) => value || null)])
      .optional(),
  })
  .refine((dto) => Object.values(dto).some((value) => value !== undefined), {
    message: 'Aucune modification fournie',
  });

/** Filtres de la liste des clients (admin) */
export const clientListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  etat: z.enum(['actif', 'bientot_expire', 'expire']).optional(),
});

// ─── Schémas du Catalogue de Plats (SPEC 5.4) ───────────────────

export const createCatalogItemSchema = z.object({
  categorie: z.nativeEnum(ItemCategory, {
    errorMap: () => ({ message: 'Catégorie invalide (plat, accompagnement ou viande)' }),
  }),
  nom: z.string().trim().min(1, 'Le nom du plat est obligatoire').max(200),
  actif: z.boolean().default(true),
});

export const updateCatalogItemSchema = z.object({
  nom: z.string().trim().min(1).max(200).optional(),
  categorie: z.nativeEnum(ItemCategory).optional(),
  actif: z.boolean().optional(),
});

// ─── Schémas de Publication de l'Offre du Jour (SPEC 5.5) ───────

/**
 * Plats d'un menu : au moins un par catégorie (la répartition exacte est vérifiée côté serveur),
 * sans doublon. Le nombre d'options par catégorie est libre.
 */
export const catalogItemIdsSchema = z
  .array(idSchema)
  .min(3, 'Un menu doit contenir au moins un plat, un accompagnement et une viande')
  .max(60)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Un même plat ne peut pas être choisi deux fois',
  });

/** Publication pour un jour unique (veille pour le lendemain) */
export const publishSingleOfferSchema = z.object({
  date: weekdaySchema,
  heureLimiteIndicative: deadlineTimeSchema.default('13:00'),
  catalogItemIds: catalogItemIdsSchema,
});

/** Publication multi-jours : duplication d'un menu sur plusieurs jours ouvrés */
export const publishMultiDaysOfferSchema = z.object({
  dateDebut: weekdaySchema,
  nombreJours: z
    .number()
    .int()
    .min(1, 'Le nombre de jours doit être au moins 1')
    .max(30, 'Le nombre de jours ne peut excéder 30 jours ouvrés'),
  heureLimiteIndicative: deadlineTimeSchema.default('13:00'),
  catalogItemIds: catalogItemIdsSchema,
});

/** Modification d'un menu à venir */
export const updateOfferSchema = z
  .object({
    heureLimiteIndicative: deadlineTimeSchema.optional(),
    catalogItemIds: catalogItemIdsSchema.optional(),
  })
  .refine((dto) => dto.heureLimiteIndicative !== undefined || dto.catalogItemIds !== undefined, {
    message: 'Aucune modification fournie',
  });

/** Plage de dates des offres à consulter (admin) */
export const offerRangeQuerySchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
});

// ─── Schémas de Commande Client (SPEC 5.6 & 5.7) ────────────────

/** Validation du choix de commande (triplet : 1 plat, 1 accompagnement, 1 viande si autorisée) */
export const submitOrderSchema = z.object({
  dailyOfferId: idSchema,
  platOptionId: idSchema,
  accompagnementOptionId: idSchema,
  viandeOptionId: idSchema.nullable().optional(),
});

/** Filtres de l'historique du client */
export const clientHistoryQuerySchema = z.object({
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  q: z.string().trim().max(100).optional(),
});

// ─── Schémas d'Avis et Notation (SPEC 5.9) ──────────────────────

export const submitReviewSchema = z
  .object({
    orderId: idSchema,
    noteEtoile: ratingSchema.optional(),
    commentaire: z.string().trim().max(1000).optional(),
  })
  .refine((dto) => dto.noteEtoile !== undefined || (dto.commentaire ?? '').length > 0, {
    message: 'Ajoute une note ou un commentaire',
  });

// ─── Schémas du Dashboard et Préparation (SPEC 6) ───────────────

export const updatePreparationStatusSchema = z.object({
  prepare: z.boolean(),
});

export const liveSummaryQuerySchema = z.object({
  date: dateOnlySchema.optional(),
});

export const statsOverviewQuerySchema = z.object({
  date: dateOnlySchema.optional(),
});

export const deliveriesQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format de mois invalide (attendu : YYYY-MM)'),
});

// ─── Types déduits (inferred) ───────────────────────────────────

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type FirstLoginInput = z.infer<typeof firstLoginSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export type PublishSingleOfferInput = z.infer<typeof publishSingleOfferSchema>;
export type PublishMultiDaysOfferInput = z.infer<typeof publishMultiDaysOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type UpdatePreparationStatusInput = z.infer<typeof updatePreparationStatusSchema>;
