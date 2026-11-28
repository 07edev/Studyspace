import type { SessionManager } from '../../shared/auth/sessionManager';
import type {
  BooleanResult,
  DuplicateCheck,
  DuplicateResult,
  Review,
  ReviewWrite,
  Suggestion,
  SuggestionCreate,
} from '../../shared/contracts/places';

export function placesApi(session: SessionManager) {
  return {
    addFavorite(placeId: string) {
      return session.request<BooleanResult>(`/users/me/favorites/places/${placeId}`, {
        method: 'PUT',
      });
    },
    removeFavorite(placeId: string) {
      return session.request<void>(`/users/me/favorites/places/${placeId}`, {
        method: 'DELETE',
      });
    },
    createReview(placeId: string, body: ReviewWrite) {
      return session.request<Review>(`/places/${placeId}/reviews`, {
        method: 'POST',
        body,
      });
    },
    updateReview(reviewId: string, body: ReviewWrite) {
      return session.request<Review>(`/reviews/${reviewId}`, {
        method: 'PATCH',
        body,
      });
    },
    deleteReview(reviewId: string) {
      return session.request<void>(`/reviews/${reviewId}`, {
        method: 'DELETE',
      });
    },
    checkSuggestionDuplicate(body: DuplicateCheck) {
      return session.request<DuplicateResult>('/place-suggestions/duplicate-check', {
        method: 'POST',
        body,
      });
    },
    createSuggestion(body: SuggestionCreate, idempotencyKey: string) {
      return session.request<Suggestion>('/place-suggestions', {
        method: 'POST',
        body,
        idempotencyKey,
      });
    },
  };
}
