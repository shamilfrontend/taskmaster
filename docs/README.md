# Техническая карта Taskmaster

Продуктовый чеклист — в [корневом README](../README.md). Здесь — схема системы: сущности, поля, экраны и API.

**Стек:** Vue 3 + TypeScript, Pinia, axios / Express + Mongoose / MongoDB.

## Содержание

- [Архитектура](#архитектура)
- [Иерархия домена](#иерархия-домена)
- [Авторизация](#авторизация)
- [Роли](#роли)
- [Экономика](#экономика)
- [Исходники](#исходники)
- [data-model.md](data-model.md) — ER-диаграмма и поля коллекций
- [frontend.md](frontend.md) — маршруты SPA и экраны
- [api.md](api.md) — REST API

## Архитектура

Браузер ходит на один домен. Caddy отдаёт SPA и проксирует `/api` на Express. JWT живёт в httpOnly cookie, TTL 7 дней, без refresh.

```mermaid
flowchart LR
  User[Пользователь] --> Caddy[Caddy TLS]
  Caddy --> Frontend[frontend Vue SPA]
  Caddy --> Backend[backend Express]
  Backend --> MongoDB[(MongoDB)]
  Backend --> YandexOAuth[Яндекс ID OAuth]
  Frontend -->|"axios /api cookie"| Backend
```

Контейнеры Compose: `frontend`, `backend`, `mongodb` (наружу не открыт). Прод: [taskmaster.shamilfrontend.ru](https://taskmaster.shamilfrontend.ru).

```mermaid
flowchart TB
  subgraph spa [Клиент]
    Views[views]
    Stores[Pinia stores]
    Router[Vue Router]
    Http[axios baseURL /api]
    Views --> Stores
    Router --> Views
    Stores --> Http
  end

  subgraph api [Сервер]
    App[app.ts]
    Mw[auth access demo-guard]
    Routes[routers]
    Models[Mongoose models]
    App --> Mw --> Routes --> Models
  end

  Http --> App
  Models --> Mongo[(MongoDB)]
```

## Иерархия домена

Команда — рабочее пространство. Проект принадлежит команде и имеет одну канбан-доску (в UI доска не показывается отдельно). Карточка живёт в колонке доски; релиз, списания и комментарии висят на карточке.

```mermaid
flowchart TB
  User[User]
  Team[Team]
  TeamMember[TeamMember]
  Invite[Invite]
  Activity[ActivityEvent]
  Project[Project]
  ProjectMember[ProjectMember]
  Board[Board 1:1]
  Column[Column]
  Label[Label]
  Card[Card]
  Release[Release]
  TimeEntry[TimeEntry]
  Comment[Comment]
  Notification[Notification]
  Checklist[Checklist внутри Card]

  User --> TeamMember
  Team --> TeamMember
  Team --> Invite
  Team --> Activity
  Team --> Project
  Project --> Invite
  User --> ProjectMember
  User --> Notification
  Project --> ProjectMember
  Project --> Board
  Project --> Release
  Board --> Column
  Board --> Label
  Board --> Card
  Column --> Card
  Release --> Card
  Card --> TimeEntry
  Card --> Comment
  Card --> Notification
  Card --> Checklist
```

Пользователь может быть в нескольких командах. Состав и роль на проекте задаются отдельно от командной роли. Owner команды видит все проекты команды.

## Авторизация

Локального логина/пароля нет. Аккаунт создаётся или обновляется при входе через Яндекс ID.

```mermaid
sequenceDiagram
  participant Browser
  participant SPA
  participant API
  participant Yandex
  participant Mongo

  Browser->>SPA: /landing
  SPA->>API: GET /api/auth/yandex?next=/
  API->>Yandex: redirect authorize
  Yandex->>API: GET /api/auth/yandex/callback?code
  API->>Yandex: token + profile
  API->>Mongo: upsert User по yandexId
  API->>Browser: Set-Cookie JWT httpOnly
  API->>SPA: redirect frontendUrl + next
  SPA->>API: GET /api/auth/me
```

Демо-вход: `POST /api/auth/demo` создаёт пользователя с `yandexId = demo` и сидирует команду «Наша команда». Записи в демо блокируются (`blockDemoWrites` + клиентский interceptor), кроме logout и повторного demo.

## Роли

Два независимых слоя: **команда** и **проект**. Значения одинаковые: `owner | admin | member | viewer`.

| Слой | Кто задаёт | Зачем |
| --- | --- | --- |
| Команда | инвайт или создатель | инвайты, состав команды, создание проекта, удаление команды |
| Проект | Owner/Admin проекта или Owner команды | карточки, колонки, релизы, аналитика |

Owner через инвайт и смену роли не выдаётся. Создатель команды/проекта становится Owner.

## Часы

- **План карточки** = `estimateHours`
- **Факт** = сумма `TimeEntry.hours` по списаниям карточки
- Списание пишет `hours` и `workedAt`; ставка и суммы не хранятся

## Исходники

| Что | Где |
| --- | --- |
| Модели | [`server/src/models/`](../server/src/models/) |
| REST-роутеры | [`server/src/routes/`](../server/src/routes/), монтирование в [`server/src/app.ts`](../server/src/app.ts) |
| Vue-маршруты | [`client/src/router/index.ts`](../client/src/router/index.ts) |
| Типы клиента | [`client/src/types/index.ts`](../client/src/types/index.ts) |
| Константы ролей и колонок | [`server/src/constants.ts`](../server/src/constants.ts) |
