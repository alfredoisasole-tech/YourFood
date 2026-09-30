/**
 * Appels typés à l'API backend, un par route. Les types viennent de @meal-app/shared.
 */

import type {
  AccessDelivery,
  AdminOfferView,
  AdminReviewView,
  AuthResponse,
  CatalogItemView,
  ChangePasswordDto,
  ClientDailyMenuView,
  ClientDetailView,
  ClientHistoryEntry,
  ClientHistoryQuery,
  ClientListFilter,
  ClientListView,
  CreateCatalogItemDto,
  CreateClientDto,
  CreateClientResponse,
  DeliveryDayStat,
  FirstLoginDto,
  LivePreparationSummary,
  LoginDto,
  PublishMultiDaysOfferDto,
  PublishSingleOfferDto,
  RenewSubscriptionDto,
  SessionResponse,
  StatsOverview,
  SubmitOrderDto,
  SubmitReviewDto,
  SubscriptionView,
  UpdateCatalogItemDto,
  UpdateCatalogItemResponse,
  UpdateClientDto,
  UpdateOfferDto,
  User,
  VerifyCodeDto,
  VerifyCodeResponse,
  WeekDayView,
} from '@meal-app/shared';
import { http, toQuery } from './client';

export const authApi = {
  login: (dto: LoginDto) => http.post<AuthResponse>('/auth/login', dto),
  verifyCode: (dto: VerifyCodeDto) => http.post<VerifyCodeResponse>('/auth/verify-code', dto),
  firstLogin: (dto: FirstLoginDto) => http.post<AuthResponse>('/auth/first-login', dto),
  me: () => http.get<SessionResponse>('/auth/me'),
  changePassword: (dto: ChangePasswordDto) => http.put<AuthResponse>('/auth/change-password', dto),
};

export const clientApi = {
  todayMenu: () => http.get<ClientDailyMenuView>('/offers/today'),
  submitOrder: (dto: SubmitOrderDto) => http.post<{ orderId: number }>('/orders', dto),
  cancelOrder: (dailyOfferId: number) => http.post<{ message: string }>(`/orders/${dailyOfferId}/cancel`),
  submitReview: (dto: SubmitReviewDto) => http.post<{ message: string }>('/reviews', dto),
  history: (query: ClientHistoryQuery = {}) =>
    http.get<ClientHistoryEntry[]>(`/client/history${toQuery({ ...query })}`),
};

export const adminApi = {
  // Clients
  listClients: (params: { q?: string; etat?: ClientListFilter } = {}) =>
    http.get<ClientListView>(`/admin/clients${toQuery(params)}`),
  createClient: (dto: CreateClientDto) => http.post<CreateClientResponse>('/admin/clients', dto),
  clientDetail: (id: number) => http.get<ClientDetailView>(`/admin/clients/${id}`),
  updateClient: (id: number, dto: UpdateClientDto) => http.patch<User>(`/admin/clients/${id}`, dto),
  resendWelcome: (id: number) => http.post<AccessDelivery>(`/admin/clients/${id}/resend-welcome`),
  resetPassword: (subscriptionId: number) =>
    http.post<AccessDelivery>(`/admin/clients/${subscriptionId}/reset-password`),
  renew: (subscriptionId: number, dto: RenewSubscriptionDto) =>
    http.post<SubscriptionView>(`/admin/clients/${subscriptionId}/renew`, dto),

  // Carte
  catalog: () => http.get<CatalogItemView[]>('/admin/catalog'),
  createDish: (dto: CreateCatalogItemDto) => http.post<CatalogItemView>('/admin/catalog', dto),
  updateDish: (id: number, dto: UpdateCatalogItemDto) =>
    http.put<UpdateCatalogItemResponse>(`/admin/catalog/${id}`, dto),
  deleteDish: (id: number) => http.delete<{ restants: number }>(`/admin/catalog/${id}`),

  // Menus
  offers: (from: string, to: string) => http.get<WeekDayView[]>(`/admin/offers${toQuery({ from, to })}`),
  publishSingle: (dto: PublishSingleOfferDto) => http.post<{ id: number; date: string }>('/admin/offers/single', dto),
  publishMulti: (dto: PublishMultiDaysOfferDto) =>
    http.post<{ dates: string[]; ignores: string[] }>('/admin/offers/multi-days', dto),
  updateOffer: (date: string, dto: UpdateOfferDto) => http.put<AdminOfferView>(`/admin/offers/${date}`, dto),

  // Suivi du jour
  live: (date?: string) => http.get<LivePreparationSummary>(`/admin/orders/live${toQuery({ date })}`),
  setPrepared: (orderId: number, prepare: boolean) =>
    http.patch<{ message: string }>(`/admin/orders/${orderId}/prepare`, { prepare }),

  // Avis et statistiques
  reviews: () => http.get<AdminReviewView[]>('/admin/reviews'),
  statsOverview: (date?: string) => http.get<StatsOverview>(`/admin/stats/overview${toQuery({ date })}`),
  deliveries: (month: string) => http.get<DeliveryDayStat[]>(`/admin/stats/deliveries${toQuery({ month })}`),
};
