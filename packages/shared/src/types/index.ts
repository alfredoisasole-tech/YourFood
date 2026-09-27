/**
 * Types partagés pour l'application meal-app (YourFood).
 * Source de vérité unique pour les modèles de données et DTOs échangés
 * entre le backend (Node.js/Express) et le frontend (React).
 * Basé sur SPEC.md (Spécification finale).
 */

// ─── Enums ─────────────────────────────────────────────────────

/** Rôle utilisateur dans le système */
export enum Role {
  ADMIN = 'admin',
  CLIENT = 'client',
}

/** Formule d'abonnement (prix en FC) */
export enum SubscriptionPlan {
  /** 25 000 FC — Viande incluse uniquement le lundi et le vendredi */
  PLAN_25000 = '25000',
  /** 35 000 FC — Viande incluse toute la semaine */
  PLAN_35000 = '35000',
}

/** Statut d'un abonnement */
export enum SubscriptionStatus {
  ACTIF = 'actif',
  EXPIRE = 'expire',
}

/** Type de code d'accès à usage unique */
export enum AccessCodeType {
  ACTIVATION = 'activation',
  REINITIALISATION = 'reinitialisation',
}

/** Catégorie de plat / option */
export enum ItemCategory {
  PLAT = 'plat',
  ACCOMPAGNEMENT = 'accompagnement',
  VIANDE = 'viande',
}

/** Statut d'une offre journalière */
export enum DailyOfferStatus {
  OUVERT = 'ouvert',
  VERROUILLE = 'verrouille',
}

/** Statut d'une commande journalière */
export enum OrderStatus {
  EN_ATTENTE = 'en_attente',
  VERROUILLEE = 'verrouillee',
  ANNULEE = 'annulee',
}

// ─── Modèles Entités (Base de données / REST) ──────────────────

/** Utilisateur (identité de connexion, admin ou client) */
export interface User {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  role: Role;
  createdAt: string;
}

/** Abonnement d'un client (historique préservé à chaque renouvellement) */
export interface Subscription {
  id: number;
  userId: number;
  formule: SubscriptionPlan;
  dateDebut: string;
  dateFin: string;
  bonus?: string | null;
  statut: SubscriptionStatus;
  createdAt: string;
}

/** Code d'accès à 8 caractères (activation initiale ou réinitialisation) */
export interface AccessCode {
  id: number;
  subscriptionId: number;
  code: string;
  type: AccessCodeType;
  dateGeneration: string;
  utilise: boolean;
  dateUtilisation?: string | null;
}

/** Item du catalogue global de plats géré par l'admin */
export interface CatalogItem {
  id: number;
  categorie: ItemCategory;
  nom: string;
  actif: boolean;
  createdAt: string;
}

/** Offre du jour (une ligne par date de livraison) */
export interface DailyOffer {
  id: number;
  date: string;
  heureLimiteIndicative: string; // Ex: '13:00'
  statut: DailyOfferStatus;
  options?: OfferOption[];
}

/** Option effectivement proposée pour un jour donné (liaison vers catalog_item) */
export interface OfferOption {
  id: number;
  dailyOfferId: number;
  catalogItemId: number;
  catalogItem?: CatalogItem;
}

/** Commande journalière d'un client (triplet de choix) */
export interface Order {
  id: number;
  dailyOfferId: number;
  subscriptionId: number;
  platId: number;
  accompagnementId: number;
  viandeId?: number | null;
  statut: OrderStatus;
  estDefaut: boolean;
  prepare: boolean;
  createdAt: string;
  updatedAt: string;
  plat?: OfferOption;
  accompagnement?: OfferOption;
  viande?: OfferOption | null;
  review?: Review | null;
}

/** Avis facultatif laissé par le client sur une commande */
export interface Review {
  id: number;
  orderId: number;
  commentaire?: string | null;
  noteEtoile?: number | null; // 1 à 5
  rempli: boolean;
  createdAt: string;
}

// ─── DTOs (Data Transfer Objects échangés via API) ─────────────

// --- Authentification & Inscription ---

/** Données envoyées par l'admin pour inscrire un client */
export interface CreateClientDto {
  nom: string;
  prenom: string;
  telephone: string;
  formule: SubscriptionPlan;
  dureeJours: number;
  dateDebut: string; // YYYY-MM-DD
  bonus?: string;
}

/** Réponse après inscription d'un client */
export interface CreateClientResponse {
  client: User;
  subscription: Subscription;
  accessCode: string;
  activationLink: string;
  whatsappUrl: string;
}

/** Première connexion du client : saisie du nom, du code reçu et création de son mot de passe */
export interface FirstLoginDto {
  nom: string;
  code: string;
  nouveauMotDePasse: string;
}

/** Connexions ultérieures : nom + mot de passe */
export interface LoginDto {
  nom: string;
  motDePasse: string;
}

/** Réponse de connexion réussie (retourne le JWT et les infos essentielles) */
export interface AuthResponse {
  token: string;
  user: User;
  activeSubscription?: Subscription | null;
}

/** Demande de réinitialisation du mot de passe (initiée par l'admin depuis la fiche client) */
export interface ResetPasswordRequestDto {
  subscriptionId: number;
}

/** Réponse suite à une réinitialisation de mot de passe */
export interface ResetPasswordResponse {
  code: string;
  whatsappUrl: string;
}

/** Modification de son mot de passe par le client connecté */
export interface ChangePasswordDto {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
}

// --- Renouvellement Abonnement ---

/** Demande de renouvellement ou prolongation d'un abonnement existant */
export interface RenewSubscriptionDto {
  dureeJours: number;
  formule?: SubscriptionPlan;
}

// --- Catalogue de plats ---

export interface CreateCatalogItemDto {
  categorie: ItemCategory;
  nom: string;
  actif?: boolean;
}

export interface UpdateCatalogItemDto {
  nom?: string;
  actif?: boolean;
}

// --- Publication des offres du jour ---

/** Publication pour un jour unique */
export interface PublishSingleOfferDto {
  date: string; // YYYY-MM-DD
  heureLimiteIndicative?: string; // HH:mm, défaut '13:00'
  catalogItemIds: number[]; // Exactement 6 items : 2 plats, 2 accompagnements, 2 viandes
}

/** Publication pour plusieurs jours ouvrés */
export interface PublishMultiDaysOfferDto {
  dateDebut: string; // YYYY-MM-DD
  nombreJours: number; // Nombre de jours ouvrés (lundi à vendredi)
  heureLimiteIndicative?: string;
  catalogItemIds: number[]; // Les 6 items du catalogue dupliqués sur chaque jour
}

// --- Menu du jour & Commandes (côté client) ---

/** Vue du menu du jour reçue par le client pour commander */
export interface ClientDailyMenuView {
  dailyOffer: DailyOffer;
  optionsParCategorie: {
    plats: CatalogItemWithOptionId[];
    accompagnements: CatalogItemWithOptionId[];
    viandes: CatalogItemWithOptionId[];
  };
  estViandeAutoriseeAujourdhui: boolean; // Selon formule et jour de la semaine
  statutMenu: 'normal' | 'en_retard' | 'verrouille';
  commandeExistante?: Order | null;
  avisRepasPrecedentACompleter?: {
    orderId: number;
    date: string;
  } | null;
}

export interface CatalogItemWithOptionId {
  optionId: number;
  catalogItemId: number;
  nom: string;
  categorie: ItemCategory;
}

/** Données envoyées par le client pour valider ou modifier son choix */
export interface SubmitOrderDto {
  dailyOfferId: number;
  platOptionId: number;
  accompagnementOptionId: number;
  viandeOptionId?: number | null;
}

// --- Avis & Notation ---

export interface SubmitReviewDto {
  orderId: number;
  noteEtoile?: number; // 1 à 5
  commentaire?: string;
}

// --- Dashboard Admin & Suivi du jour ---

/** Résumé en direct des commandes pour l'écran de suivi admin */
export interface LivePreparationSummary {
  date: string;
  statutOffre: DailyOfferStatus;
  totalClientsActifs: number;
  totalLivraisonsPrevues: number;
  quantitesParItem: {
    categorie: ItemCategory;
    nom: string;
    quantite: number;
  }[];
  commandesDetaillees: ClientOrderDetailRow[];
}

export interface ClientOrderDetailRow {
  orderId: number;
  clientNom: string;
  clientPrenom: string;
  clientTelephone: string;
  platNom: string;
  accompagnementNom: string;
  viandeNom?: string | null;
  estDefaut: boolean;
  prepare: boolean;
  statut: OrderStatus;
}

/** Mise à jour du statut "préparé" par l'admin */
export interface UpdatePreparationStatusDto {
  prepare: boolean;
}

/** Vue fiche client détaillée côté admin avec ses 3 onglets */
export interface ClientDetailView {
  client: User;
  abonnementActif?: Subscription | null;
  joursRestants?: number;
  historiqueAbonnements: Subscription[];
  historiqueJours: {
    date: string;
    platNom: string;
    accompagnementNom: string;
    viandeNom?: string | null;
    statut: OrderStatus;
    estDefaut: boolean;
  }[];
  avis: {
    orderId: number;
    date: string;
    noteEtoile?: number | null;
    commentaire?: string | null;
  }[];
  noteMoyenne?: number | null;
}
