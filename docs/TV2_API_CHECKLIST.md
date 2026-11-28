# Danh sách 44 API TV2 (Places & Explore)

Đối chiếu mục 7.2 của Báo cáo phân công StudySpace G1. Base path: `/api/v1`.
Trạng thái: `TODO` = chưa làm; `BE CODE` = đã viết BE + typecheck/build (chờ MongoDB chạy e2e); `BE DONE` = BE + e2e đạt; `DONE` = BE + FE đã nối và kiểm thử.

## Taxonomy (8 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| BE CODE | `GET /taxonomies/place-categories` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `USR-07` |
| BE CODE | `GET /taxonomies/amenities` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `—` |
| BE CODE | `GET /taxonomies/universities` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `U07` |
| BE CODE | `GET /taxonomies/majors` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `U07,U37` |
| BE CODE | `GET /taxonomies/subjects` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `USR-23,U08,U37` |
| BE CODE | `GET /locations/provinces` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `A18,U09,U21` |
| BE CODE | `GET /locations/wards` | `PUBLIC` | `none → Page<TaxonomyItem>` | `200` | `A18,U09,U21` |
| BE CODE | `GET /places/attribute-definitions` | `PUBLIC` | `none → Page<AttributeDefinition>` | `200` | `U10,U24` |

## PlacesPublic (7 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| BE CODE | `GET /home` | `PUBLIC` | `none → Homepage` | `200` | `USR-07` |
| BE CODE | `GET /places` | `PUBLIC` | `none → Page<Place>` | `200` | `USR-07,USR-08,U10-U13,U15,U24` |
| BE CODE | `GET /places/map` | `PUBLIC` | `none → Page<PlaceMapFeature>` | `200` | `USR-08,U12` |
| BE CODE | `GET /places/facets` | `PUBLIC` | `none → PlaceFacets` | `200` | `USR-08,U10` |
| BE CODE | `GET /places/{placeId}` | `PUBLIC` | `none → Place` | `200` | `U12,U13,U15,U24` |
| TODO | `GET /places/{placeId}/reviews` | `PUBLIC` | `none → Page<Review>` | `200` | `U15` |
| BE CODE | `GET /places/{placeId}/similar` | `PUBLIC` | `none → Page<Place>` | `200` | `—` |

## Favorites (3 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| TODO | `GET /users/me/favorites/places` | `USER` | `none → Page<Place>` | `200` | `USR-35,U18` |
| TODO | `PUT /users/me/favorites/places/{placeId}` | `USER` | `none → BooleanResult` | `200` | `U13` |
| TODO | `DELETE /users/me/favorites/places/{placeId}` | `USER` | `none → none` | `204` | `U13,U18` |

## Reviews (4 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| TODO | `POST /places/{placeId}/reviews` | `USER` | `ReviewWrite → Review` | `201` | `U16` |
| TODO | `PATCH /reviews/{reviewId}` | `OWNER` | `ReviewWrite → Review` | `200` | `U16` |
| TODO | `DELETE /reviews/{reviewId}` | `OWNER` | `none → none` | `204` | `U17` |
| TODO | `GET /users/me/reviews` | `USER` | `none → Page<Review>` | `200` | `—` |

## PlaceSuggestions (4 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| TODO | `POST /place-suggestions/duplicate-check` | `USER` | `DuplicateCheck → DuplicateResult` | `200` | `U20,U22` |
| TODO | `POST /place-suggestions` | `USER` | `SuggestionCreate → Suggestion` | `201` | `U20,U22,U23,U25` |
| TODO | `GET /users/me/place-suggestions` | `USER` | `none → Page<Suggestion>` | `200` | `U26,U27` |
| TODO | `GET /users/me/place-suggestions/{suggestionId}` | `OWNER` | `none → Suggestion` | `200` | `U27` |

## AdminPlaces (12 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| TODO | `GET /admin/places` | `ADMIN:PLACES.READ` | `none → Page<Place>` | `200` | `ADM-06,ADM-10,A16,A26,A31` |
| TODO | `GET /admin/places/{placeId}` | `ADMIN:PLACES.READ` | `none → Place` | `200` | `ADM-10,A16,A26,A31` |
| TODO | `GET /admin/place-candidates/search` | `ADMIN:PLACES.CREATE` | `none → Page<PlaceCandidate>` | `200` | `ADM-08` |
| TODO | `POST /admin/places/duplicate-check` | `ADMIN:PLACES.CREATE` | `DuplicateCheck → DuplicateResult` | `200` | `ADM-08,A15` |
| TODO | `POST /admin/places` | `ADMIN:PLACES.CREATE` | `PlaceUpsert → Place` | `201` | `ADM-06,ADM-08,ADM-09,A15,A22` |
| TODO | `PATCH /admin/places/{placeId}` | `ADMIN:PLACES.UPDATE` | `PlacePatch → Place` | `200` | `ADM-06,ADM-09,ADM-10,A13,A14,A22,A24,A25` |
| TODO | `PATCH /admin/places/{placeId}/status` | `ADMIN:PLACES.UPDATE` | `PlaceStatusPatch → Place` | `200` | `ADM-06,A13,A14` |
| TODO | `GET /admin/places/{placeId}/history` | `ADMIN:PLACES.READ` | `none → Page<PlaceHistory>` | `200` | `ADM-10,A26` |
| TODO | `PATCH /admin/places/{placeId}/fields/state` | `ADMIN:PLACES.UPDATE` | `FieldDecision → Place` | `200` | `ADM-10,A24,A25` |
| BE CODE | `GET /admin/place-attributes` | `ADMIN:PLACES.READ` | `none → Page<AttributeDefinition>` | `200` | `ADM-09,A20` |
| BE CODE | `POST /admin/place-attributes` | `ADMIN:PLACES.UPDATE` | `AttributeDefinitionWrite → AttributeDefinition` | `201` | `A20` |
| BE CODE | `PATCH /admin/place-attributes/{attributeId}` | `ADMIN:PLACES.UPDATE` | `AttributeDefinitionWrite → AttributeDefinition` | `200` | `A20` |

## AdminSuggestions (3 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| TODO | `GET /admin/place-suggestions` | `ADMIN:SUGGESTIONS.READ` | `none → Page<Suggestion>` | `200` | `ADM-13,ADM-14,A28,A31` |
| TODO | `GET /admin/place-suggestions/{suggestionId}` | `ADMIN:SUGGESTIONS.READ` | `none → Suggestion` | `200` | `ADM-13,ADM-14,A28,A31` |
| TODO | `POST /admin/place-suggestions/{suggestionId}/decision` | `ADMIN:SUGGESTIONS.MODERATE` | `ModerationDecision → Suggestion` | `200` | `ADM-14,A29,A30` |

## AdminReviews (3 endpoint)

| Trạng thái | Method và path | Scope | Request → Data DTO | HTTP | UI |
| --- | --- | --- | --- | --- | --- |
| TODO | `GET /admin/reviews` | `ADMIN:REVIEWS.READ` | `none → Page<Review>` | `200` | `ADM-15,A27,A32` |
| TODO | `GET /admin/reviews/{reviewId}` | `ADMIN:REVIEWS.READ` | `none → Review` | `200` | `A27,A32` |
| TODO | `PATCH /admin/reviews/{reviewId}/moderation` | `ADMIN:REVIEWS.MODERATE` | `ContentModerate → Review` | `200` | `ADM-15,A33,A34` |
