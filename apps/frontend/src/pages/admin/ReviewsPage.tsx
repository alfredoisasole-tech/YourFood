/**
 * « Ce qu'ils en pensent. » (SPEC 6) : flux global des avis, du plus récent au plus ancien.
 */

import { useEffect } from 'react';
import { adminApi } from '../../api/endpoints';
import { useApi } from '../../hooks/useApi';
import { AdminPage, useAdminArea } from './AdminArea';
import { groupByPeriod } from '../../components/history/HistoryList';
import { Avatar, SectionTitle, Stars } from '../../components/ui/Controls';
import { EmptyState, ErrorState, SectionLoader } from '../../components/ui/States';
import { formatShortDate, initials, todayKinshasa } from '../../lib/format';

export function ReviewsPage() {
  const today = todayKinshasa();
  const reviews = useApi(() => adminApi.reviews(), []);
  const { markReviewsSeen } = useAdminArea();

  useEffect(() => {
    markReviewsSeen();
  }, [markReviewsSeen]);

  const rows = (reviews.data ?? []).map((review) => ({ ...review, date: review.createdAt.slice(0, 10) }));
  const groups = groupByPeriod(rows, today).map((group) => ({
    ...group,
    label: group.label === 'Cette semaine' && group.rows.every((r) => r.date === today) ? "Aujourd'hui" : group.label,
  }));

  return (
    <AdminPage title="Ce qu'ils en pensent." subtitle="Du plus récent au plus ancien, en lecture seule.">
      {reviews.loading && !reviews.data ? (
        <SectionLoader />
      ) : reviews.error ? (
        <ErrorState message={reviews.error.message} onRetry={() => void reviews.reload()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="star" title="Pas encore d'avis">
          Les avis des clients apparaîtront ici dès qu'ils noteront leurs repas.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.label} className="a-rise">
              <SectionTitle className="mb-2">{group.label}</SectionTitle>
              <ul className="flex flex-col">
                {group.rows.map((review) => (
                  <li key={review.reviewId} className="flex gap-3 border-b border-line/[0.06] py-3 last:border-0">
                    <Avatar text={initials(review.clientPrenom, review.clientNom)} size={40} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold text-ink">
                          {review.clientPrenom} {review.clientNom}
                        </span>
                        {review.noteEtoile ? <Stars value={review.noteEtoile} size={14} /> : null}
                      </div>
                      <span className="text-[12px] text-muted">
                        Repas du {formatShortDate(review.date)} · {review.repas.split(' · ')[0]}
                      </span>
                      {review.commentaire && <p className="mt-1 text-[15px] leading-snug text-ink">{review.commentaire}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
