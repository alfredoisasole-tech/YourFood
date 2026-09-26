/**
 * Types partagés pour l'application meal-app.
 *
 * Ces types correspondent au modèle de données défini dans SPEC.md
 * et au schéma Prisma. Ils sont utilisés par le backend et le frontend
 * pour garantir la cohérence des données.
 */

// ─── Enums ─────────────────────────────────────────────────────

/** Rôle utilisateur dans le système */
export enum Role {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
}

/** Formule d'abonnement */
export enum SubscriptionPlan {
  /** 25 000 FC — Viande lundi et vendredi uniquement */
  BASIC = 'BASIC',
  /** 35 000 FC — Viande tous les jours */
  PREMIUM = 'PREMIUM',
}

/** Statut d'un abonnement */
export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/** Catégorie de l'offre journalière */
export enum OfferCategory {
  PLAT = 'PLAT',
  ACCOMPAGNEMENT = 'ACCOMPAGNEMENT',
  VIANDE = 'VIANDE',
}

/** Statut d'une commande */
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  /** Commande attribuée par défaut (non-choix du client) */
  DEFAULT_ASSIGNED = 'DEFAULT_ASSIGNED',
}

// ─── Types ─────────────────────────────────────────────────────

/** Utilisateur (client ou admin) */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Code d'accès à 8 caractères pour la première connexion */
export interface AccessCode {
  id: string;
  code: string;
  userId: string;
  isUsed: boolean;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Abonnement d'un client */
export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

/** Offre journalière (pour la livraison du lendemain) */
export interface DailyOffer {
  id: string;
  date: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  options?: OfferOption[];
}

/** Option d'une catégorie dans une offre journalière */
export interface OfferOption {
  id: string;
  dailyOfferId: string;
  category: OfferCategory;
  name: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
}

/** Commande d'un client pour un jour donné */
export interface Order {
  id: string;
  userId: string;
  dailyOfferId: string;
  status: OrderStatus;
  isDefaultChoice: boolean;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

/** Item d'une commande (un choix par catégorie) */
export interface OrderItem {
  id: string;
  orderId: string;
  offerOptionId: string;
}

/** Avis / notation d'un repas */
export interface Review {
  id: string;
  orderId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

// ─── DTOs (Data Transfer Objects) ──────────────────────────────

/** Données pour l'inscription d'un client (côté admin) */
export interface CreateClientDto {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  plan: SubscriptionPlan;
  startDate: string;
  durationDays: number;
  bonus?: string;
}

/** Données pour la connexion (première fois : avec code) */
export interface FirstLoginDto {
  lastName: string;
  code: string;
  newPassword: string;
}

/** Données pour la connexion (connexions suivantes) */
export interface LoginDto {
  lastName: string;
  password: string;
}

/** Données pour la création d'une offre journalière */
export interface CreateDailyOfferDto {
  date: string;
  options: CreateOfferOptionDto[];
}

/** Données pour une option d'offre */
export interface CreateOfferOptionDto {
  category: OfferCategory;
  name: string;
  description?: string;
}

/** Données pour passer une commande */
export interface CreateOrderDto {
  dailyOfferId: string;
  items: { offerOptionId: string }[];
}

/** Données pour soumettre un avis */
export interface CreateReviewDto {
  orderId: string;
  rating: number;
  comment?: string;
}

/** Réponse d'authentification */
export interface AuthResponse {
  token: string;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
}
