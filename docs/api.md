# REST API

База: `/api`. JSON, cookie JWT (`httpOnly`, `SameSite=lax`, TTL 7 дней). CORS: origin = frontend URL, `credentials: true`.

Монтирование: [`server/src/app.ts`](../server/src/app.ts).

Ошибки: `{ "error": "текст" }` + HTTP-код (`AppError`). Health: `GET /api/health` → `{ "ok": true }`.

Импорт из Trello: лимит тела `10mb` только на `POST /api/teams/:teamId/projects/from-trello`.

## Авторизация колонки Auth

| Значение | Смысл |
| --- | --- |
| public | Без cookie |
| JWT | `requireAuth`, любой залогиненный |
| team O/A | участник команды, роль owner или admin |
| team owner | только owner команды |
| project * | `requireProjectAccess` (+ роли ниже) |
| Member+ | owner, admin или member проекта (не viewer) |

Демо (`yandexId = demo`): middleware `blockDemoWrites` отвечает 403 на POST/PUT/PATCH/DELETE, кроме `/api/auth/logout`, `/api/auth/demo`, `PATCH /api/notifications/:id/read` и `POST /api/notifications/read-all`.

## Auth `/api/auth`

| Метод | Путь | Auth | Тело / query | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/yandex` | public | `?next=/path` | Redirect на oauth.yandex.ru |
| GET | `/yandex/callback` | public | `?code` `&state` | Upsert User, Set-Cookie JWT, redirect на SPA |
| POST | `/demo` | public | — | Cookie демо-пользователя, сид команды |
| GET | `/me` | JWT | — | `{ id, displayName, email, avatarUrl, isDemo }` |
| POST | `/logout` | public | — | Clear-Cookie, `{ ok: true }` |

## Teams `/api/teams`

Все эндпоинты ниже — JWT.

| Метод | Путь | Роль | Тело | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/` | JWT | — | Список своих команд: `id, name, role, memberCount, projectCount` |
| POST | `/` | JWT | `{ name }` | 201 `{ id, name, role: "owner" }` |
| GET | `/:teamId` | участник | — | Команда: members, visible projects, invites (O/A) |
| PATCH | `/:teamId` | team O/A | `{ name }` | `{ id, name }` |
| DELETE | `/:teamId` | team owner | — | Каскад, `{ ok: true }` |
| GET | `/:teamId/activity` | участник | `?before=ISO` | `{ items, hasMore }`, страница 10 |
| PATCH | `/:teamId/members/:userId` | см. состав | `{ role }` | `{ ok, role }`; owner назначить нельзя |
| DELETE | `/:teamId/members/:userId` | см. состав | — | Выход или исключение; owner не выходит |
| POST | `/:teamId/invites` | team O/A | `{ role }` | 201 `{ id, token, role, expiresAt }` — сырой token один раз |
| DELETE | `/:teamId/invites/:inviteId` | team O/A | — | Отзыв, `{ ok: true }` |
| POST | `/:teamId/projects` | team O/A | `{ name, budgetLimit? }` | 201 проект + доска по умолчанию; budgetLimit только team owner |
| POST | `/:teamId/projects/from-trello` | team O/A | `{ name, board }` | 201 импорт JSON Trello |

Состав команды: Owner меняет/исключает любого; Admin — только Member/Viewer. Сам себя может удалить любой кроме Owner.

## Invites `/api/invites`

| Метод | Путь | Auth | Ответ |
| --- | --- | --- | --- |
| GET | `/:token` | public | `{ teamName, role, expiresAt }` или 404 |
| POST | `/:token/accept` | JWT | `{ teamId, alreadyMember }` — токен сгорает |

## Projects `/api/projects`

JWT + доступ к проекту (участник проекта или owner команды).

| Метод | Путь | Роль | Тело | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/:projectId` | любой доступ | — | Детали: флаги, board.id, releases, rates (деньги по роли) |
| PATCH | `/:projectId` | O/A; бюджет только owner | `name`, `releasesEnabled`, `budgetEnabled`, `budgetLimit`, `boardBackground` | Обновлённые поля |
| POST | `/:projectId/duplicate` | O/A | — | 201 `{ id }` копия с составом и ставками, пустая доска |
| DELETE | `/:projectId` | O/A | — | Каскад колонок, карточек, релизов |
| PUT | `/:projectId/role-rates` | O/A | `{ owner, admin, member, viewer }` | `{ roleRates }`, пересчёт планов |
| PUT | `/:projectId/member-rates` | O/A | `{ userId, amount? }` | `{ ok }`; без `amount` — сброс персональной ставки |
| GET | `/:projectId/members` | любой доступ | — | `{ role, teamRole, members, candidates }` |
| POST | `/:projectId/members` | O/A проекта или owner команды | `{ userId, role }` | 201; роль не owner; кандидат из команды |
| PATCH | `/:projectId/members/:userId` | см. состав | `{ role }` | `{ ok, role }` |
| DELETE | `/:projectId/members/:userId` | см. состав | — | Owner проекта не выходит и не исключается |
| POST | `/:projectId/releases` | O/A | `{ name, date? }` | 201 `{ id, name, date, status: "planned" }`; нужен `releasesEnabled` |

GET проекта: Viewer без ставок/бюджета; Member видит `remainder`, не видит чужие ставки; O/A видят `budgetLimit`, `fact`, `roleRates`.

## Analytics `/api/projects`

| Метод | Путь | Auth | Query | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/:projectId/analytics` | доступ к проекту | `period=today\|7d\|30d\|quarter\|year\|3y\|5y` или `from`+`to` | `AnalyticsPayload` |

Сводка, статусы, риски, релизы «готово/всего» — снимок сейчас. План vs факт, загрузка, недели — списания с `workedAt` в периоде. Burn бюджета — всё время. Viewer без денег; Member — часы всех, ₽ только свои + remainder.

## Boards `/api/boards`

| Метод | Путь | Роль | Тело | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/:boardId` | доступ к проекту | — | Колонки, метки, карточки (агрегаты часов/₽), релизы |
| PATCH | `/:boardId` | O/A | `{ name }` | `{ id, name }` |
| DELETE | `/:boardId` | O/A | — | Каскад доски |
| POST | `/:boardId/columns` | O/A | `{ name }` | 201 колонка, `isDone: false`, position в конец |
| PATCH | `/columns/:columnId` | O/A | `{ name?, position? }` | Колонка |
| DELETE | `/columns/:columnId` | O/A | — | 409 если есть карточки |
| POST | `/:boardId/labels` | O/A | `{ name, color }` | 201 метка |
| PATCH | `/labels/:labelId` | O/A | `{ name }` | Метка |
| DELETE | `/labels/:labelId` | O/A | — | Снимает метку с карточек |

## Cards `/api/cards`

| Метод | Путь | Роль | Тело | Ответ |
| --- | --- | --- | --- | --- |
| POST | `/` | Member+ | `{ boardId, columnId, title, assigneeId?, dueDate?, estimateHours?, releaseId?, labelIds? }` | 201 `{ id, title, planAmount }` |
| GET | `/:cardId` | доступ | — | Детали, checklists, timeEntries, comments |
| PATCH | `/:cardId` | Member+ | любое из: `title, description, columnId, position, assigneeId, dueDate, estimateHours, releaseId, labelIds` | `{ ok: true }`, пересчёт плана |
| DELETE | `/:cardId` | Member+ без списаний; O/A со списаниями | — | Карточка, списания, комментарии |
| POST | `/:cardId/time-entries` | O/A любые; member — свой assignee | `{ hours, workedAt? }` | 201 `{ id, hours, amount, rateSnapshot }` |
| PATCH | `/time-entries/:entryId` | O/A; member — своё на своей карточке | `{ hours }` | `{ ok, amount }` |
| DELETE | `/time-entries/:entryId` | как PATCH | — | `{ ok: true }` |
| POST | `/:cardId/comments` | Member+ | `{ body, parentId? }` | 201 `{ id, body }` |
| PATCH | `/comments/:commentId` | автор | `{ body }` | `{ id, body, editedAt }` |
| DELETE | `/comments/:commentId` | автор или O/A | — | Корень удаляет ответы |
| POST | `/:cardId/checklists` | Member+ | `{ title? }` | 201 чеклист |
| PATCH | `/checklists/:checklistId` | Member+ | `{ title }` | `{ ok: true }` |
| DELETE | `/checklists/:checklistId` | Member+ | — | `{ ok: true }` |
| POST | `/checklists/:checklistId/items` | Member+ | `{ text }` | 201 пункт |
| PATCH | `/checklist-items/:itemId` | Member+ | `{ text?, done? }` | `{ ok: true }` |
| DELETE | `/checklist-items/:itemId` | Member+ | — | `{ ok: true }` |

## Releases `/api/releases`

Нужен `releasesEnabled` на проекте.

| Метод | Путь | Роль | Тело | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/:releaseId` | доступ | — | `{ id, projectId, name, date, status, role, cards[] }` |
| PATCH | `/:releaseId` | O/A | `{ name?, date?, status? }` | Релиз; `status`: `planned` \| `released` |
| DELETE | `/:releaseId` | O/A | — | Карточки остаются, `releaseId → null` |
| POST | `/:releaseId/cards` | Member+ | `{ cardId }` | Прикрепить карточку этого проекта |
| DELETE | `/:releaseId/cards/:cardId` | Member+ | — | Открепить |

## Notifications `/api/notifications`

Личный инбокс. Автор действия не получает уведомление о себе.

| Метод | Путь | Auth | Query / тело | Ответ |
| --- | --- | --- | --- | --- |
| GET | `/` | JWT | `?before=ISO` | `{ items, hasMore, unreadCount }`, страница 10 |
| PATCH | `/:id/read` | получатель | — | `{ ok: true }` |
| POST | `/read-all` | JWT | — | `{ ok: true }` |

`kind`: `card_assigned` (назначили исполнителем), `comment_added` (комментарий на вашей карточке), `comment_reply` (ответ на ваш комментарий; если вы и исполнитель — только этот kind).

Элемент: `id`, `kind`, `readAt`, `actorId`, `actorName`, `actorAvatarUrl`, `cardId`, `cardTitle`, `projectId`, `projectName`, `teamId`, `teamName`, `detail`, `createdAt`.

## Кто что видит в деньгах

| Роль проекта | Бюджет / ставки | План/факт ₽ карточки | Аналитика ₽ |
| --- | --- | --- | --- |
| Owner | чтение и запись лимита и ставок | все | все + burn |
| Admin | ставки чтение/запись; лимит только смотрит | все | все + burn |
| Member | только остаток проекта | свои карточки | часы всех; ₽ свои; remainder |
| Viewer | скрыто | скрыто | без денег и burn |

`budgetEnabled = false` — денежные поля в ответах не отдаются.
