/**
 * Types partagés pour l'application meal-app (YourFood).
 * Source de vérité unique pour les modèles de données et DTOs échangés
 * entre le backend (Node.js/Express) et le frontend (React).
 * Basé sur SPEC.md (Spécification finale, v3.1).
 */

import type { SubscriptionDuration, SubscriptionState } from '../utils/subscription';

// ─── Enums ─────────────────────────────────────────────────────

/** Rôle utilisateur dans le système */
export enum Role {
  ADMIN = 'admin',
  CLIENT = 'client',
}

/** Formule d'abonnement (prix hebdomadaire en FC) */
export enum SubscriptionPlan {
  /** 25 000 FC / semaine — Viande incluse uniquement le lundi et le vendredi */
  PLAN_25000 = '25000',
  /** 35 000 FC / semaine — Viande incluse toute la semaine */
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

/** Heure de verrouillage absolue des commandes (SPEC 5.6) */
export const LOCK_TIME = '20:00';

// ─── Modèles Entités (Base de données / REST) ──────────────────

/** Utilisateur (identité de connexion, admin ou client) */
export interface User {
  id: number;
  nom: string;
  prenom: string;
  /** Facultatif : sans numéro, l'admin remet le lien ou le QR code en main propre */
  telephone: string | null;
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

/** Abonnement enrichi de son état calculé à partir des dates (jamais du seul champ `statut`) */
export interface SubscriptionView extends Subscription {
  etat: SubscriptionState;
  /** Jours ouvrés restants, aujourd'hui inclus */
  joursRestants: number;
  dureeSemaines: number;
  /** Prix hebdomadaire × nombre de semaines, en FC */
  totalFc: number;
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

/** Commande journalière d'un client (triplet de choix, ou jour annulé sans aucun choix) */
export interface Order {
  id: number;
  dailyOfferId: number;
  subscriptionId: number;
  platId: number | null;
  accompagnementId: number | null;
  viandeId?: number | null;
  statut: OrderStatus;
  estDefaut: boolean;
  prepare: boolean;
  createdAt: string;
  updatedAt: string;
  plat?: OfferOption | null;
  accompagnement?: OfferOption | null;
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
  /** Facultatif */
  telephone?: string;
  formule: SubscriptionPlan;
  duree: SubscriptionDuration;
  /** Un lundi. Par défaut : le prochain lundi */
  dateDebut?: string;
  bonus?: string;
}

/**
 * Tout ce dont l'admin a besoin pour transmettre l'accès au client :
 * lien (que le frontend peut aussi afficher en QR code), code, et message WhatsApp.
 */
export interface AccessDelivery {
  code: string;
  /** Code groupé par 4 pour la lecture : « RN7Q 3M8K » */
  codeAffichage: string;
  /** Lien de connexion, code inclus après le « # » (jamais envoyé au serveur) */
  lien: string;
  /** null si le client n'a pas de numéro de téléphone */
  whatsappUrl: string | null;
  message: string;
}

/** Réponse après inscription d'un client */
export interface CreateClientResponse {
  client: User;
  subscription: SubscriptionView;
  acces: AccessDelivery;
}

/** Vérification (sans consommer) du couple identifiant + code reçu par le client */
export interface VerifyCodeDto {
  identifiant: string;
  code: string;
}

export interface VerifyCodeResponse {
  prenom: string;
  type: AccessCodeType;
}

/** Première connexion du client : identifiant, code reçu et création de son mot de passe */
export interface FirstLoginDto {
  /** « Prénom Nom », insensible à la casse et aux accents */
  identifiant: string;
  code: string;
  nouveauMotDePasse: string;
}

/** Connexions ultérieures : identifiant + mot de passe */
export interface LoginDto {
  identifiant: string;
  motDePasse: string;
}

/** Réponse de connexion réussie (retourne le JWT et les infos essentielles) */
export interface AuthResponse {
  token: string;
  user: User;
  /** null pour l'admin */
  subscription: SubscriptionView | null;
}

/** Session courante (GET /auth/me) */
export interface SessionResponse {
  user: User;
  subscription: SubscriptionView | null;
}

/** Demande de réinitialisation du mot de passe (initiée par l'admin depuis la fiche client) */
export interface ResetPasswordRequestDto {
  subscriptionId: number;
}

/** Modification de son mot de passe par le client connecté */
export interface ChangePasswordDto {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
}

// --- Renouvellement Abonnement ---

/** Demande de renouvellement ou prolongation d'un abonnement existant */
export interface RenewSubscriptionDto {
  duree: SubscriptionDuration;
  formule?: SubscriptionPlan;
  /** Un lundi. Par défaut : le lundi qui suit la fin de la période en cours (ou le prochain lundi si expirée) */
  dateDebut?: string;
}

// --- Catalogue de plats ---

export interface CreateCatalogItemDto {
  categorie: ItemCategory;
  nom: string;
  actif?: boolean;
}

export interface UpdateCatalogItemDto {
  nom?: string;
  categorie?: ItemCategory;
  actif?: boolean;
}

// --- Publication des offres du jour ---

/** Publication pour un jour unique */
export interface PublishSingleOfferDto {
  date: string; // YYYY-MM-DD, jour ouvré
  heureLimiteIndicative?: string; // HH:mm, défaut '13:00'
  /** Au moins un plat, un accompagnement et une viande (nombre libre par catégorie) */
  catalogItemIds: number[];
}

/** Publication pour plusieurs jours ouvrés */
export interface PublishMultiDaysOfferDto {
  dateDebut: string; // YYYY-MM-DD
  nombreJours: number; // Nombre de jours ouvrés (lundi à vendredi)
  heureLimiteIndicative?: string;
  catalogItemIds: number[]; // Le même menu, dupliqué sur chaque jour
}

/** Modification d'un menu à venir (SPEC 5.5 : chaque jour reste modifiable) */
export interface UpdateOfferDto {
  heureLimiteIndicative?: string;
  catalogItemIds?: number[];
}

/** Menu publié tel que vu par l'admin (liste « Menus à venir », bandeau de la semaine) */
export interface AdminOfferView {
  id: number;
  date: string;
  statut: DailyOfferStatus;
  heureLimiteIndicative: string;
  plats: CatalogItemWithOptionId[];
  accompagnements: CatalogItemWithOptionId[];
  viandes: CatalogItemWithOptionId[];
  /** Clients dont l'abonnement couvre ce jour, moins les annulations */
  livraisonsPrevues: number;
  commandesRecues: number;
}

/** Jour du bandeau de la semaine : publié ou non, avec les livraisons attendues */
export interface WeekDayView {
  date: string;
  publie: boolean;
  offre: AdminOfferView | null;
  livraisonsPrevues: number;
}

// --- Menu du jour & Commandes (côté client) ---

export type MenuTimeStatus = 'normal' | 'en_retard' | 'verrouille' | 'aucun_menu';

/** Vue du menu du jour reçue par le client pour commander */
export interface ClientDailyMenuView {
  date: string;
  formule: SubscriptionPlan;
  etatAbonnement: SubscriptionState;
  dateFinAbonnement: string;
  /** null tant que l'admin n'a rien publié pour aujourd'hui */
  dailyOffer: DailyOffer | null;
  optionsParCategorie: {
    plats: CatalogItemWithOptionId[];
    accompagnements: CatalogItemWithOptionId[];
    viandes: CatalogItemWithOptionId[];
  };
  estViandeAutoriseeAujourdhui: boolean; // Selon formule et jour de la semaine
  statutMenu: MenuTimeStatus;
  heureVerrouillage: string; // '20:00'
  /** Commande du jour : choisie, attribuée par défaut (estDefaut) ou annulée (statut annulee) */
  commandeExistante?: Order | null;
  avisRepasPrecedentACompleter?: {
    orderId: number;
    date: string;
  } | null;
  /** Heure du serveur (ISO), pour synchroniser le compte à rebours */
  serverNow: string;
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

/** Filtres de l'historique client */
export interface ClientHistoryQuery {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  /** Recherche par nom de plat */
  q?: string;
}

/** Une ligne de l'historique du client (lecture seule) */
export interface ClientHistoryEntry {
  orderId: number;
  date: string;
  statut: OrderStatus;
  estDefaut: boolean;
  platNom: string | null;
  accompagnementNom: string | null;
  viandeNom: string | null;
  noteEtoile: number | null;
  commentaire: string | null;
  /** Le client peut encore laisser un avis sur ce repas */
  avisPossible: boolean;
}

// --- Avis & Notation ---

export interface SubmitReviewDto {
  orderId: number;
  noteEtoile?: number; // 1 à 5
  commentaire?: string;
}

/** Avis dans le flux global de l'admin */
export interface AdminReviewView {
  reviewId: number;
  clientNom: string;
  clientPrenom: string;
  /** Date du repas noté */
  date: string;
  noteEtoile: number | null;
  commentaire: string | null;
  repas: string;
  createdAt: string;
}

// --- Dashboard Admin & Suivi du jour ---

/** Origine d'une ligne du suivi : choix du client, attribution automatique, ou pas encore de choix */
export type OrderOrigin = 'choisi' | 'automatique' | 'en_attente';

/** Résumé en direct des commandes pour l'écran de suivi admin */
export interface LivePreparationSummary {
  date: string;
  statutOffre: DailyOfferStatus;
  heureLimiteIndicative: string;
  totalClientsActifs: number;
  totalLivraisonsPrevues: number;
  totalPrepares: number;
  quantitesParItem: {
    categorie: ItemCategory;
    nom: string;
    quantite: number;
  }[];
  commandesDetaillees: ClientOrderDetailRow[];
  /** Clients dont l'abonnement couvre le jour et qui n'ont encore rien choisi */
  clientsEnAttente: PendingClientRow[];
  /** Clients ayant annulé leur repas du jour */
  clientsAnnules: number;
}

export interface ClientOrderDetailRow {
  orderId: number;
  clientNom: string;
  clientPrenom: string;
  clientTelephone: string | null;
  formule: SubscriptionPlan;
  platNom: string;
  accompagnementNom: string;
  viandeNom?: string | null;
  estDefaut: boolean;
  origine: OrderOrigin;
  prepare: boolean;
  statut: OrderStatus;
}

export interface PendingClientRow {
  subscriptionId: number;
  clientNom: string;
  clientPrenom: string;
  formule: SubscriptionPlan;
}

/** Mise à jour du statut "préparé" par l'admin */
export interface UpdatePreparationStatusDto {
  prepare: boolean;
}

// --- Clients (admin) ---

export interface ClientListRow {
  id: number;
  subscriptionId: number | null;
  nom: string;
  prenom: string;
  telephone: string | null;
  formule: SubscriptionPlan | null;
  etat: SubscriptionState | null;
  joursRestants: number;
  dateFin: string | null;
}

/** Filtres de la liste : « actif » regroupe aussi les abonnements pas encore commencés */
export type ClientListFilter = 'actif' | 'bientot_expire' | 'expire';

export interface ClientListView {
  clients: ClientListRow[];
  compteurs: {
    tous: number;
    actifs: number;
    bientotExpires: number;
    expires: number;
  };
}

/** Vue fiche client détaillée côté admin avec ses 3 onglets */
export interface ClientDetailView {
  client: User;
  abonnementCourant: SubscriptionView | null;
  historiqueAbonnements: SubscriptionView[];
  historiqueJours: {
    orderId: number;
    date: string;
    platNom: string | null;
    accompagnementNom: string | null;
    viandeNom?: string | null;
    statut: OrderStatus;
    estDefaut: boolean;
  }[];
  avis: {
    orderId: number;
    date: string;
    repas: string;
    noteEtoile?: number | null;
    commentaire?: string | null;
  }[];
  noteMoyenne?: number | null;
}

// --- Statistiques (admin) ---

export type TopDishPeriod = 'semaine' | 'mois' | 'annee' | 'historique';

export interface TopDish {
  nom: string;
  quantite: number;
}

export interface StatsOverview {
  date: string;
  clientsActifs: number;
  clientsTotal: number;
  /** Livraisons du jour : clients couverts moins annulations */
  livraisons: number;
  avis: { moyenne: number | null; total: number };
  /** Plat le plus commandé sur la semaine, le mois et l'année en cours (jusqu'à la date demandée), et depuis le début */
  platsPlusCommandes: Record<TopDishPeriod, TopDish | null>;
  /** Abonnements « bientôt expirés » */
  aRenouveler: number;
  totauxParCategorie: {
    categorie: ItemCategory;
    items: { nom: string; quantite: number }[];
    total: number;
  }[];
}

export interface DeliveryDayStat {
  date: string;
  livraisons: number;
  /** Part des clients actifs ce jour-là, en pourcentage */
  pourcentage: number;
  /** true pour les jours à venir (prévision) */
  prevu: boolean;
}
