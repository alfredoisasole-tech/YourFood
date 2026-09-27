/**
 * Schémas de validation Zod partagés entre backend et frontend.
 *
 * Source unique de vérité pour la validation des données d'entrée :
 * - Le backend valide les payloads des requêtes HTTP reçues.
 * - Le frontend valide les formulaires avant soumission.
 * Basé sur SPEC.md (Spécification finale).
 */

import { z } from 'zod';
import {
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  ItemCategory,
  DailyOfferStatus,
  OrderStatus,
} from '../types';

// ─── Schémas atomiques réutilisables ───────────────────────────

/** ID entier positif (PostgreSQL SERIAL) */
export const idSchema = z.number().int().positive();

/**
 * Numéro de téléphone avec indicatif pays obligatoire (ex: +243XXXXXXXXX ou +33XXXXXXXXX).
 * SPEC 5.1 : "normalisé avec indicatif pays à la saisie".
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    'Le numéro de téléphone doit être au format international avec indicatif (ex: +243812345678)'
  );

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

/** Mot de passe utilisateur : min 6 caractères pour flexibilité mobile, recommandé min 8 */
export const passwordSchema = z
  .string()
  .min(6, 'Le mot de passe doit contenir au moins 6 caractères');

/** Date au format YYYY-MM-DD */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (attendu : YYYY-MM-DD)');

/** Heure limite au format HH:mm */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format d\'heure invalide (attendu : HH:mm)');

/** Note étoile de 1 à 5 */
export const ratingSchema = z
  .number()
  .int()
  .min(1, 'La note minimale est 1 étoile')
  .max(5, 'La note maximale est 5 étoiles');

// ─── Schémas d'Authentification & Clients ────────────────────────

/** Inscription d'un client par l'administratrice (SPEC 5.1 & 5.2) */
export const createClientSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire').max(100),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire').max(100),
  telephone: phoneSchema,
  formule: z.nativeEnum(SubscriptionPlan, {
    errorMap: () => ({ message: 'Formule invalide (25000 ou 35000 attendu)' }),
  }),
  dureeJours: z
    .number()
    .int()
    .min(1, 'La durée doit être d\'au moins 1 jour')
    .max(365, 'La durée ne peut excéder 365 jours'),
  dateDebut: dateOnlySchema,
  bonus: z.string().trim().max(500).optional(),
});

/** Première connexion avec code d'activation (SPEC 5.3 & 7) */
export const firstLoginSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire'),
  code: accessCodeSchema,
  nouveauMotDePasse: passwordSchema,
});

/** Connexions ultérieures : nom + mot de passe (SPEC 5.3 & 7) */
export const loginSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire'),
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
  dureeJours: z.number().int().min(1, 'La durée doit être d\'au moins 1 jour'),
  formule: z.nativeEnum(SubscriptionPlan).optional(),
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
  actif: z.boolean().optional(),
});

// ─── Schémas de Publication de l'Offre du Jour (SPEC 5.5) ───────

/**
 * Publication pour un jour unique (veille pour le lendemain).
 * La grille impose exactement 6 items du catalogue : 2 par catégorie.
 */
export const publishSingleOfferSchema = z.object({
  date: dateOnlySchema,
  heureLimiteIndicative: timeSchema.default('13:00').optional(),
  catalogItemIds: z
    .array(idSchema)
    .length(6, "L'offre doit contenir exactement 6 items du catalogue (2 par catégorie)"),
});

/** Publication multi-jours : duplication d'un menu sur plusieurs jours ouvrés */
export const publishMultiDaysOfferSchema = z.object({
  dateDebut: dateOnlySchema,
  nombreJours: z
    .number()
    .int()
    .min(1, 'Le nombre de jours doit être au moins 1')
    .max(30, 'Le nombre de jours ne peut excéder 30 jours ouvrés'),
  heureLimiteIndicative: timeSchema.default('13:00').optional(),
  catalogItemIds: z
    .array(idSchema)
    .length(6, "L'offre doit contenir exactement 6 items du catalogue"),
});

// ─── Schémas de Commande Client (SPEC 5.6 & 5.7) ────────────────

/** Validation du choix de commande (triplet : 1 plat, 1 accompagnement, 1 viande si autorisée) */
export const submitOrderSchema = z.object({
  dailyOfferId: idSchema,
  platOptionId: idSchema,
  accompagnementOptionId: idSchema,
  viandeOptionId: idSchema.nullable().optional(),
});

// ─── Schémas d'Avis et Notation (SPEC 5.9) ──────────────────────

export const submitReviewSchema = z.object({
  orderId: idSchema,
  noteEtoile: ratingSchema.optional(),
  commentaire: z.string().trim().max(1000).optional(),
});

// ─── Schémas du Dashboard et Préparation (SPEC 6) ───────────────

export const updatePreparationStatusSchema = z.object({
  prepare: z.boolean(),
});

// ─── Types déduits (inferred) ───────────────────────────────────

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type FirstLoginInput = z.infer<typeof firstLoginSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export type PublishSingleOfferInput = z.infer<typeof publishSingleOfferSchema>;
export type PublishMultiDaysOfferInput = z.infer<typeof publishMultiDaysOfferSchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type UpdatePreparationStatusInput = z.infer<typeof updatePreparationStatusSchema>;
