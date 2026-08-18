/* eslint-disable no-await-in-loop -- sequential Mongo writes for demo data */
import mongoose from 'mongoose';
import {
  DEFAULT_ROLE_RATES,
  type BoardBackground,
  type LabelColor,
  type ReleaseStatus,
  type TeamRole,
} from '../constants.js';
import { AppError } from '../errors/app-error.js';
import { ActivityEventModel } from '../models/activity-event.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { NotificationModel } from '../models/notification.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { TeamModel } from '../models/team.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { calcAmount, calcPlan } from '../utils/rates.js';
import { normalizeName } from '../utils/crypto.js';
import { deleteTeamCascade } from './cascade.js';
import { createDefaultBoard } from './project-setup.js';

const COLUMN_KEYS = ['todo', 'doing', 'review', 'done'] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];

const USER_KEYS = ['demo', 'anna', 'ivan', 'maria', 'pavel'] as const;
type UserKey = (typeof USER_KEYS)[number];

interface DemoUserSeed {
  yandexId: string;
  displayName: string;
}

interface DemoChecklistItemSeed {
  text: string;
  done: boolean;
}

interface DemoChecklistSeed {
  title: string;
  items: DemoChecklistItemSeed[];
}

interface DemoCommentSeed {
  author: UserKey;
  body: string;
  daysAgo?: number;
  parentIndex?: number;
}

interface DemoTimeEntrySeed {
  user: UserKey;
  hours: number;
  daysAgo: number;
}

interface DemoActivitySeed {
  kind: 'card_created' | 'card_moved' | 'comment_added';
  actor: UserKey;
  detail?: string;
  daysAgo?: number;
}

interface DemoCardSeed {
  title: string;
  column: ColumnKey;
  description?: string;
  assignee?: UserKey;
  dueDays?: number;
  estimateHours?: number;
  labels?: string[];
  release?: string;
  createdDaysAgo?: number;
  checklists?: DemoChecklistSeed[];
  comments?: DemoCommentSeed[];
  timeEntries?: DemoTimeEntrySeed[];
  activity?: DemoActivitySeed[];
}

interface DemoLabelSeed {
  key: string;
  name: string;
  color: LabelColor;
}

interface DemoReleaseSeed {
  key: string;
  name: string;
  status: ReleaseStatus;
  daysOffset?: number;
}

interface DemoProjectSeed {
  name: string;
  releasesEnabled?: boolean;
  budgetEnabled?: boolean;
  budgetLimit?: number;
  roleRates?: Record<TeamRole, number>;
  boardBackground?: BoardBackground;
  labels?: DemoLabelSeed[];
  releases?: DemoReleaseSeed[];
  cards: DemoCardSeed[];
}

interface DemoMemberSeed {
  user: UserKey;
  role: TeamRole;
}

interface DemoTeamSeed {
  name: string;
  members: DemoMemberSeed[];
  projects: DemoProjectSeed[];
}

const COLLEAGUES: Record<Exclude<UserKey, 'demo'>, DemoUserSeed> = {
  anna: { yandexId: 'demo-anna', displayName: 'Анна Козлова' },
  ivan: { yandexId: 'demo-ivan', displayName: 'Иван Петров' },
  maria: { yandexId: 'demo-maria', displayName: 'Мария Соколова' },
  pavel: { yandexId: 'demo-pavel', displayName: 'Павел Орлов' },
};

const AGENCY_RATES: Record<TeamRole, number> = {
  owner: 3500,
  admin: 2800,
  member: 2200,
  viewer: 0,
};

const TEAMS: DemoTeamSeed[] = [
  {
    name: 'Наша команда',
    members: [
      { user: 'demo', role: 'owner' },
      { user: 'anna', role: 'admin' },
      { user: 'ivan', role: 'member' },
      { user: 'maria', role: 'member' },
      { user: 'pavel', role: 'viewer' },
    ],
    projects: [
      {
        name: 'CRM-система',
        releasesEnabled: true,
        budgetEnabled: true,
        budgetLimit: 2200000,
        roleRates: AGENCY_RATES,
        boardBackground: 'bg-20',
        labels: [
          { key: 'backend', name: 'Бэкенд', color: 'blue' },
          { key: 'frontend', name: 'Фронт', color: 'green' },
          { key: 'client', name: 'Клиент', color: 'amber' },
          { key: 'risk', name: 'Риск', color: 'pink' },
        ],
        releases: [
          {
            key: 'mvp',
            name: 'MVP',
            status: 'released',
            daysOffset: -700,
          },
          {
            key: 'funnel',
            name: 'Воронка',
            status: 'released',
            daysOffset: -480,
          },
          {
            key: 'cabinet1',
            name: 'Кабинет 1.0',
            status: 'released',
            daysOffset: -280,
          },
          {
            key: 'reports',
            name: 'Отчёты',
            status: 'released',
            daysOffset: -90,
          },
          {
            key: 'crm2',
            name: 'Кабинет 2.0',
            status: 'planned',
            daysOffset: 18,
          },
          {
            key: 'crm3',
            name: 'Интеграции',
            status: 'planned',
            daysOffset: 40,
          },
        ],
        cards: [
          {
            title: 'Импорт контактов из Excel',
            column: 'todo',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'crm2',
            createdDaysAgo: 14,
            dueDays: 11,
            estimateHours: 16,
          },
          {
            title: 'Фильтры сделок',
            column: 'todo',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'crm2',
            createdDaysAgo: 13,
            dueDays: 9,
            estimateHours: 10,
          },
          {
            title: 'Права менеджера филиала',
            column: 'todo',
            assignee: 'anna',
            labels: ['backend', 'client'],
            release: 'crm2',
            createdDaysAgo: 18,
            dueDays: 16,
            estimateHours: 20,
          },
          {
            title: 'Уведомление о просрочке',
            column: 'todo',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'crm2',
            createdDaysAgo: 10,
            dueDays: 8,
            estimateHours: 8,
          },
          {
            title: 'Канбан сделок',
            column: 'doing',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'crm2',
            createdDaysAgo: 12,
            dueDays: 3,
            estimateHours: 24,
            checklists: [
              {
                title: 'Колонки',
                items: [
                  { text: 'Новые', done: true },
                  { text: 'В работе', done: true },
                  { text: 'Счёт', done: false },
                  { text: 'Закрыто', done: false },
                ],
              },
            ],
            timeEntries: [
              { user: 'maria', hours: 6, daysAgo: 2 },
              { user: 'maria', hours: 5, daysAgo: 5 },
            ],
            comments: [
              {
                author: 'pavel',
                body: 'Нужен столбец «Ждём клиента», как в старой CRM.',
                daysAgo: 1,
              },
              {
                author: 'maria',
                body: 'Добавлю после текущих статусов, не ломая выгрузку.',
                daysAgo: 1,
                parentIndex: 0,
              },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 12 },
              {
                kind: 'card_moved',
                actor: 'maria',
                detail: 'В работе',
                daysAgo: 6,
              },
            ],
          },
          {
            title: 'Карточка компании',
            column: 'doing',
            assignee: 'anna',
            labels: ['frontend', 'backend'],
            release: 'crm2',
            createdDaysAgo: 15,
            dueDays: 5,
            estimateHours: 18,
            timeEntries: [
              { user: 'anna', hours: 4, daysAgo: 1 },
              { user: 'anna', hours: 7, daysAgo: 8 },
            ],
          },
          {
            title: 'История звонков',
            column: 'doing',
            assignee: 'ivan',
            labels: ['backend', 'risk'],
            release: 'crm2',
            createdDaysAgo: 20,
            dueDays: -2,
            estimateHours: 14,
            timeEntries: [{ user: 'ivan', hours: 8, daysAgo: 3 }],
          },
          {
            title: 'Дашборд руководителя',
            column: 'review',
            assignee: 'maria',
            labels: ['frontend', 'client'],
            release: 'crm2',
            createdDaysAgo: 18,
            dueDays: 1,
            estimateHours: 16,
            timeEntries: [
              { user: 'maria', hours: 4, daysAgo: 4 },
              { user: 'maria', hours: 6, daysAgo: 11 },
            ],
          },
          {
            title: 'Экспорт в PDF',
            column: 'review',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'crm2',
            createdDaysAgo: 16,
            dueDays: 2,
            estimateHours: 8,
            timeEntries: [{ user: 'ivan', hours: 3, daysAgo: 6 }],
          },
          {
            title: 'Интеграция с Телемостом',
            column: 'todo',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'crm3',
            createdDaysAgo: 8,
            dueDays: 30,
            estimateHours: 20,
          },
          {
            title: 'Почта из Яндекса',
            column: 'todo',
            assignee: 'ivan',
            labels: ['backend', 'client'],
            release: 'crm3',
            createdDaysAgo: 7,
            dueDays: 34,
            estimateHours: 16,
          },
          {
            title: 'Массовое назначение менеджера',
            column: 'todo',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'crm2',
            createdDaysAgo: 11,
            dueDays: 12,
            estimateHours: 8,
          },
          {
            title: 'Теги компаний',
            column: 'doing',
            assignee: 'anna',
            labels: ['frontend', 'backend'],
            release: 'crm2',
            createdDaysAgo: 14,
            dueDays: 6,
            estimateHours: 12,
            timeEntries: [
              { user: 'anna', hours: 3, daysAgo: 1 },
              { user: 'anna', hours: 5, daysAgo: 7 },
            ],
            comments: [
              {
                author: 'pavel',
                body: 'Цвета тегов как в Excel-выгрузке.',
                daysAgo: 2,
              },
              {
                author: 'anna',
                body: 'Возьму палитру из макета, вечером сверю.',
                daysAgo: 1,
                parentIndex: 0,
              },
              {
                author: 'pavel',
                body: 'Ок, только без кислотно-зелёного.',
                daysAgo: 1,
                parentIndex: 1,
              },
            ],
          },
          {
            title: 'Дубликаты по телефону',
            column: 'review',
            assignee: 'ivan',
            labels: ['backend', 'risk'],
            release: 'crm2',
            createdDaysAgo: 19,
            dueDays: -1,
            estimateHours: 10,
            timeEntries: [
              { user: 'ivan', hours: 4, daysAgo: 2 },
              { user: 'ivan', hours: 6, daysAgo: 9 },
            ],
          },
          {
            title: 'Мобильная карточка сделки',
            column: 'doing',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'crm2',
            createdDaysAgo: 21,
            dueDays: 8,
            estimateHours: 14,
            timeEntries: [
              { user: 'maria', hours: 5, daysAgo: 3 },
              { user: 'maria', hours: 4, daysAgo: 10 },
              { user: 'maria', hours: 6, daysAgo: 16 },
            ],
          },
          {
            title: 'Шаблоны писем',
            column: 'review',
            assignee: 'anna',
            labels: ['frontend', 'client'],
            release: 'crm2',
            createdDaysAgo: 17,
            dueDays: 2,
            estimateHours: 9,
            timeEntries: [{ user: 'anna', hours: 4, daysAgo: 4 }],
            checklists: [
              {
                title: 'Письма',
                items: [
                  { text: 'Первый контакт', done: true },
                  { text: 'Счёт', done: true },
                  { text: 'Просрочка', done: false },
                ],
              },
            ],
          },
          {
            title: 'Права на удаление сделок',
            column: 'todo',
            assignee: 'demo',
            labels: ['backend', 'risk'],
            release: 'crm2',
            createdDaysAgo: 9,
            dueDays: 15,
            estimateHours: 6,
          },
          {
            title: 'Авторизация и роли',
            column: 'done',
            assignee: 'anna',
            labels: ['backend'],
            release: 'mvp',
            createdDaysAgo: 740,
            estimateHours: 20,
            timeEntries: [
              { user: 'anna', hours: 8, daysAgo: 720 },
              { user: 'anna', hours: 6, daysAgo: 705 },
              { user: 'anna', hours: 6, daysAgo: 690 },
            ],
            comments: [
              {
                author: 'pavel',
                body: 'Роли как в старой CRM: директор, РОП, менеджер.',
                daysAgo: 710,
              },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 740 },
              {
                kind: 'card_moved',
                actor: 'anna',
                detail: 'Готово',
                daysAgo: 688,
              },
            ],
          },
          {
            title: 'Список компаний',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'mvp',
            createdDaysAgo: 735,
            estimateHours: 12,
            timeEntries: [
              { user: 'maria', hours: 7, daysAgo: 715 },
              { user: 'maria', hours: 5, daysAgo: 698 },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 735 },
              {
                kind: 'card_moved',
                actor: 'maria',
                detail: 'Готово',
                daysAgo: 696,
              },
            ],
          },
          {
            title: 'Создание сделки',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend', 'frontend'],
            release: 'mvp',
            createdDaysAgo: 730,
            estimateHours: 16,
            timeEntries: [
              { user: 'ivan', hours: 8, daysAgo: 710 },
              { user: 'ivan', hours: 8, daysAgo: 692 },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 730 },
              {
                kind: 'card_moved',
                actor: 'ivan',
                detail: 'Готово',
                daysAgo: 690,
              },
            ],
          },
          {
            title: 'Комментарии к сделке',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'mvp',
            createdDaysAgo: 720,
            estimateHours: 8,
            timeEntries: [
              { user: 'maria', hours: 8, daysAgo: 700 },
              { user: 'maria', hours: 7, daysAgo: 640 },
            ],
          },
          {
            title: 'Поиск по ИНН',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'mvp',
            createdDaysAgo: 710,
            estimateHours: 6,
            timeEntries: [
              { user: 'ivan', hours: 6, daysAgo: 685 },
              { user: 'ivan', hours: 6, daysAgo: 660 },
            ],
          },
          {
            title: 'Бэкап базы и SSL',
            column: 'done',
            assignee: 'demo',
            labels: ['backend'],
            release: 'mvp',
            createdDaysAgo: 705,
            estimateHours: 7,
            timeEntries: [
              { user: 'demo', hours: 4, daysAgo: 690 },
              { user: 'demo', hours: 3, daysAgo: 680 },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 705 },
              {
                kind: 'card_moved',
                actor: 'demo',
                detail: 'Готово',
                daysAgo: 678,
              },
            ],
          },
          {
            title: 'Статусы сделки',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'funnel',
            createdDaysAgo: 560,
            estimateHours: 14,
            timeEntries: [
              { user: 'ivan', hours: 8, daysAgo: 530 },
              { user: 'ivan', hours: 6, daysAgo: 500 },
              { user: 'ivan', hours: 5, daysAgo: 630 },
            ],
            comments: [
              {
                author: 'pavel',
                body: 'Нельзя перепрыгивать из «Новая» сразу в «Оплата».',
                daysAgo: 520,
              },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 560 },
              {
                kind: 'card_moved',
                actor: 'ivan',
                detail: 'Готово',
                daysAgo: 498,
              },
            ],
          },
          {
            title: 'Смена менеджера',
            column: 'done',
            assignee: 'anna',
            labels: ['backend', 'client'],
            release: 'funnel',
            createdDaysAgo: 545,
            estimateHours: 12,
            timeEntries: [
              { user: 'anna', hours: 6, daysAgo: 520 },
              { user: 'anna', hours: 6, daysAgo: 485 },
              { user: 'anna', hours: 6, daysAgo: 650 },
            ],
          },
          {
            title: 'Уведомление в Telegram',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'funnel',
            createdDaysAgo: 535,
            estimateHours: 10,
            timeEntries: [
              { user: 'ivan', hours: 6, daysAgo: 510 },
              { user: 'ivan', hours: 4, daysAgo: 470 },
              { user: 'ivan', hours: 6, daysAgo: 600 },
            ],
          },
          {
            title: 'Импорт CSV',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend', 'backend'],
            release: 'funnel',
            createdDaysAgo: 550,
            estimateHours: 16,
            timeEntries: [
              { user: 'maria', hours: 8, daysAgo: 540 },
              { user: 'maria', hours: 8, daysAgo: 490 },
              { user: 'maria', hours: 6, daysAgo: 590 },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 550 },
              {
                kind: 'card_moved',
                actor: 'maria',
                detail: 'Готово',
                daysAgo: 488,
              },
            ],
          },
          {
            title: 'История смены статусов',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'funnel',
            createdDaysAgo: 500,
            estimateHours: 8,
            timeEntries: [
              { user: 'maria', hours: 8, daysAgo: 460 },
              { user: 'maria', hours: 5, daysAgo: 560 },
            ],
          },
          {
            title: 'Акт по этапу «Воронка»',
            column: 'done',
            assignee: 'demo',
            labels: ['client'],
            release: 'funnel',
            createdDaysAgo: 470,
            estimateHours: 3,
            timeEntries: [
              { user: 'demo', hours: 3, daysAgo: 450 },
              { user: 'demo', hours: 4, daysAgo: 620 },
            ],
          },
          {
            title: 'Профиль пользователя',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'cabinet1',
            createdDaysAgo: 360,
            estimateHours: 12,
            timeEntries: [
              { user: 'maria', hours: 6, daysAgo: 330 },
              { user: 'maria', hours: 6, daysAgo: 300 },
              { user: 'maria', hours: 6, daysAgo: 252 },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 360 },
              {
                kind: 'card_moved',
                actor: 'maria',
                detail: 'Готово',
                daysAgo: 298,
              },
            ],
          },
          {
            title: 'Фильтры списка компаний',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'cabinet1',
            createdDaysAgo: 350,
            estimateHours: 14,
            timeEntries: [
              { user: 'maria', hours: 8, daysAgo: 320 },
              { user: 'maria', hours: 6, daysAgo: 280 },
              { user: 'maria', hours: 5, daysAgo: 350 },
            ],
          },
          {
            title: 'Вложения к сделке',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'cabinet1',
            createdDaysAgo: 355,
            estimateHours: 16,
            timeEntries: [
              { user: 'ivan', hours: 8, daysAgo: 340 },
              { user: 'ivan', hours: 8, daysAgo: 290 },
              { user: 'ivan', hours: 5, daysAgo: 570 },
              { user: 'ivan', hours: 5, daysAgo: 238 },
            ],
            comments: [
              {
                author: 'pavel',
                body: 'Лимит 20 МБ, как в договоре на хранение.',
                daysAgo: 310,
              },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 355 },
              {
                kind: 'card_moved',
                actor: 'ivan',
                detail: 'Готово',
                daysAgo: 288,
              },
            ],
          },
          {
            title: 'Права РОПа',
            column: 'done',
            assignee: 'anna',
            labels: ['backend', 'client'],
            release: 'cabinet1',
            createdDaysAgo: 345,
            estimateHours: 18,
            timeEntries: [
              { user: 'anna', hours: 8, daysAgo: 315 },
              { user: 'anna', hours: 6, daysAgo: 285 },
              { user: 'anna', hours: 4, daysAgo: 260 },
              { user: 'anna', hours: 5, daysAgo: 610 },
              { user: 'anna', hours: 6, daysAgo: 336 },
            ],
          },
          {
            title: 'История изменений сделки',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'cabinet1',
            createdDaysAgo: 330,
            estimateHours: 10,
            timeEntries: [
              { user: 'ivan', hours: 6, daysAgo: 305 },
              { user: 'ivan', hours: 4, daysAgo: 270 },
              { user: 'ivan', hours: 4, daysAgo: 364 },
            ],
          },
          {
            title: 'Мобильный список компаний',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'cabinet1',
            createdDaysAgo: 325,
            estimateHours: 12,
            timeEntries: [
              { user: 'maria', hours: 6, daysAgo: 295 },
              { user: 'maria', hours: 6, daysAgo: 255 },
              { user: 'anna', hours: 6, daysAgo: 580 },
            ],
          },
          {
            title: 'Отчёт по воронке',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend'],
            release: 'reports',
            createdDaysAgo: 150,
            estimateHours: 14,
            timeEntries: [
              { user: 'maria', hours: 7, daysAgo: 130 },
              { user: 'maria', hours: 7, daysAgo: 100 },
              { user: 'maria', hours: 6, daysAgo: 154 },
              { user: 'maria', hours: 5, daysAgo: 21 },
            ],
            comments: [
              {
                author: 'pavel',
                body: 'Срез по филиалам, не только по всей компании.',
                daysAgo: 120,
              },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 150 },
              {
                kind: 'card_moved',
                actor: 'maria',
                detail: 'Готово',
                daysAgo: 88,
              },
            ],
          },
          {
            title: 'Выгрузка в Excel',
            column: 'done',
            assignee: 'ivan',
            labels: ['backend'],
            release: 'reports',
            createdDaysAgo: 140,
            estimateHours: 12,
            timeEntries: [
              { user: 'ivan', hours: 6, daysAgo: 120 },
              { user: 'ivan', hours: 6, daysAgo: 90 },
              { user: 'ivan', hours: 5, daysAgo: 168 },
              { user: 'ivan', hours: 5, daysAgo: 28 },
            ],
          },
          {
            title: 'Дашборд конверсии',
            column: 'done',
            assignee: 'maria',
            labels: ['frontend', 'client'],
            release: 'reports',
            createdDaysAgo: 145,
            estimateHours: 16,
            timeEntries: [
              { user: 'maria', hours: 8, daysAgo: 140 },
              { user: 'maria', hours: 8, daysAgo: 85 },
              { user: 'maria', hours: 6, daysAgo: 224 },
              { user: 'maria', hours: 6, daysAgo: 49 },
            ],
            activity: [
              { kind: 'card_created', actor: 'demo', daysAgo: 145 },
              {
                kind: 'card_moved',
                actor: 'maria',
                detail: 'Готово',
                daysAgo: 82,
              },
            ],
          },
          {
            title: 'Отчёт по менеджерам',
            column: 'done',
            assignee: 'anna',
            labels: ['frontend', 'backend'],
            release: 'reports',
            createdDaysAgo: 135,
            estimateHours: 14,
            timeEntries: [
              { user: 'anna', hours: 7, daysAgo: 110 },
              { user: 'anna', hours: 7, daysAgo: 80 },
              { user: 'anna', hours: 5, daysAgo: 196 },
              { user: 'anna', hours: 6, daysAgo: 35 },
            ],
          },
          {
            title: 'Сводка за месяц',
            column: 'done',
            assignee: 'anna',
            labels: ['frontend', 'client'],
            release: 'reports',
            createdDaysAgo: 125,
            estimateHours: 10,
            timeEntries: [
              { user: 'anna', hours: 6, daysAgo: 95 },
              { user: 'anna', hours: 4, daysAgo: 72 },
              { user: 'demo', hours: 3, daysAgo: 56 },
              { user: 'demo', hours: 3, daysAgo: 140 },
            ],
          },
          {
            title: 'Фильтр периода в отчётах',
            column: 'done',
            assignee: 'ivan',
            labels: ['frontend', 'backend'],
            release: 'reports',
            createdDaysAgo: 118,
            estimateHours: 8,
            timeEntries: [
              { user: 'ivan', hours: 4, daysAgo: 105 },
              { user: 'ivan', hours: 4, daysAgo: 75 },
              { user: 'ivan', hours: 6, daysAgo: 210 },
              { user: 'ivan', hours: 6, daysAgo: 63 },
              { user: 'maria', hours: 5, daysAgo: 182 },
            ],
          },
        ],
      },
    ],
  },
];

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

async function upsertUser(
  seed: DemoUserSeed,
): Promise<mongoose.Types.ObjectId> {
  const user = await UserModel.findOneAndUpdate(
    { yandexId: seed.yandexId },
    {
      $setOnInsert: {
        yandexId: seed.yandexId,
        displayName: seed.displayName,
        email: '',
        avatarUrl: '',
      },
    },
    { upsert: true, new: true },
  ).lean();

  if (!user) {
    throw new AppError(500, 'Не удалось создать демо-пользователя');
  }

  return user._id;
}

async function upsertDemoUsers(
  ownerId: mongoose.Types.ObjectId,
): Promise<Record<UserKey, mongoose.Types.ObjectId>> {
  return {
    demo: ownerId,
    anna: await upsertUser(COLLEAGUES.anna),
    ivan: await upsertUser(COLLEAGUES.ivan),
    maria: await upsertUser(COLLEAGUES.maria),
    pavel: await upsertUser(COLLEAGUES.pavel),
  };
}

async function seedProject(
  teamId: mongoose.Types.ObjectId,
  users: Record<UserKey, mongoose.Types.ObjectId>,
  roleByUser: Record<UserKey, TeamRole | undefined>,
  projectSeed: DemoProjectSeed,
): Promise<void> {
  const roleRates = projectSeed.roleRates ?? DEFAULT_ROLE_RATES;
  const project = await ProjectModel.create({
    teamId,
    name: projectSeed.name,
    budgetLimit: projectSeed.budgetLimit ?? 0,
    roleRates,
    releasesEnabled: projectSeed.releasesEnabled ?? false,
    budgetEnabled: projectSeed.budgetEnabled ?? false,
    boardBackground: projectSeed.boardBackground ?? 'default',
  });

  const memberDocs = USER_KEYS.flatMap((key) => {
    const role = roleByUser[key];

    if (!role) {
      return [];
    }

    return [{
      projectId: project._id,
      userId: users[key],
      role,
    }];
  });

  if (memberDocs.length > 0) {
    await ProjectMemberModel.insertMany(memberDocs);
  }

  const board = await createDefaultBoard(project._id);
  const columns = await ColumnModel.find({ boardId: board._id })
    .sort({ position: 1 })
    .lean();
  const columnByKey = new Map<ColumnKey, mongoose.Types.ObjectId>();

  for (const [index, key] of COLUMN_KEYS.entries()) {
    const column = columns[index];

    if (!column) {
      throw new AppError(500, 'Не удалось создать колонки демо-доски');
    }

    columnByKey.set(key, column._id);
  }

  const labelByKey = new Map<string, mongoose.Types.ObjectId>();

  if (projectSeed.labels && projectSeed.labels.length > 0) {
    const labels = await LabelModel.insertMany(
      projectSeed.labels.map((label) => ({
        boardId: board._id,
        name: label.name,
        color: label.color,
      })),
    );

    for (const [index, label] of labels.entries()) {
      const seed = projectSeed.labels[index];

      if (seed) {
        labelByKey.set(seed.key, label._id);
      }
    }
  }

  const releaseByKey = new Map<string, mongoose.Types.ObjectId>();

  if (projectSeed.releases) {
    for (const releaseSeed of projectSeed.releases) {
      const release = await ReleaseModel.create({
        projectId: project._id,
        name: releaseSeed.name,
        nameNormalized: normalizeName(releaseSeed.name),
        date:
          releaseSeed.daysOffset === undefined
            ? null
            : daysFromNow(releaseSeed.daysOffset),
        status: releaseSeed.status,
      });

      releaseByKey.set(releaseSeed.key, release._id);
    }
  }

  const positionByColumn = new Map<string, number>();

  for (const cardSeed of projectSeed.cards) {
    const columnId = columnByKey.get(cardSeed.column);

    if (!columnId) {
      throw new AppError(500, 'Неизвестная колонка в демо-данных');
    }

    const columnKey = columnId.toString();
    const position = positionByColumn.get(columnKey) ?? 0;
    positionByColumn.set(columnKey, position + 1);

    const assigneeId = cardSeed.assignee
      ? users[cardSeed.assignee]
      : null;
    const estimateHours = cardSeed.estimateHours ?? 0;
    let planAmount = 0;

    if (assigneeId && cardSeed.assignee && estimateHours > 0) {
      const role = roleByUser[cardSeed.assignee] ?? 'member';
      planAmount = calcPlan(estimateHours, roleRates[role]);
    }

    const createdAt = cardSeed.createdDaysAgo === undefined
      ? undefined
      : daysAgo(cardSeed.createdDaysAgo);

    const card = await CardModel.create({
      boardId: board._id,
      columnId,
      title: cardSeed.title,
      description: cardSeed.description ?? '',
      assigneeId,
      dueDate:
        cardSeed.dueDays === undefined
          ? null
          : daysFromNow(cardSeed.dueDays),
      estimateHours,
      releaseId: cardSeed.release
        ? (releaseByKey.get(cardSeed.release) ?? null)
        : null,
      labelIds: (cardSeed.labels ?? [])
        .map((key) => labelByKey.get(key))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
      checklists: (cardSeed.checklists ?? []).map((list, listIndex) => ({
        title: list.title,
        position: listIndex,
        items: list.items.map((item, itemIndex) => ({
          text: item.text,
          done: item.done,
          position: itemIndex,
        })),
      })),
      position,
      planAmount,
    });

    if (createdAt) {
      await CardModel.updateOne(
        { _id: card._id },
        { $set: { createdAt, updatedAt: createdAt } },
        { timestamps: false },
      );
    }

    if (cardSeed.comments) {
      const created: Array<{
        id: mongoose.Types.ObjectId;
        parentId: mongoose.Types.ObjectId | null;
      }> = [];

      for (const comment of cardSeed.comments) {
        let parentId: mongoose.Types.ObjectId | null = null;

        if (comment.parentIndex !== undefined) {
          const parent = created[comment.parentIndex];

          if (parent) {
            parentId = parent.parentId ?? parent.id;
          }
        }

        const createdComment = await CommentModel.create({
          cardId: card._id,
          userId: users[comment.author],
          parentId,
          body: comment.body,
          createdAt: daysAgo(comment.daysAgo ?? 0),
        });

        created.push({
          id: createdComment._id,
          parentId: createdComment.parentId ?? null,
        });
      }
    }

    if (cardSeed.timeEntries) {
      for (const entry of cardSeed.timeEntries) {
        const role = roleByUser[entry.user] ?? 'member';
        const rate = roleRates[role];

        await TimeEntryModel.create({
          cardId: card._id,
          userId: users[entry.user],
          hours: entry.hours,
          rateSnapshot: rate,
          amount: calcAmount(entry.hours, rate),
          workedAt: daysAgo(entry.daysAgo),
        });
      }
    }

    if (cardSeed.activity) {
      for (const event of cardSeed.activity) {
        await ActivityEventModel.create({
          teamId,
          projectId: project._id,
          boardId: board._id,
          cardId: card._id,
          actorId: users[event.actor],
          kind: event.kind,
          cardTitle: cardSeed.title,
          detail: event.detail ?? '',
          createdAt: daysAgo(event.daysAgo ?? 0),
        });
      }
    }
  }
}

function expectedCardCount(): number {
  return TEAMS.reduce(
    (sum, team) => sum
      + team.projects.reduce(
        (projectSum, project) => projectSum + project.cards.length,
        0,
      ),
    0,
  );
}

async function demoTeamIds(
  ownerId: mongoose.Types.ObjectId,
): Promise<mongoose.Types.ObjectId[]> {
  const memberships = await TeamMemberModel.find({
    userId: ownerId,
    role: 'owner',
  }).lean();

  return memberships.map((item) => item.teamId);
}

async function demoTeamNamesMatch(
  teamIds: mongoose.Types.ObjectId[],
): Promise<boolean> {
  const teams = await TeamModel.find({ _id: { $in: teamIds } }).lean();
  const existing = teams.map((team) => team.name).sort();
  const expected = TEAMS.map((team) => team.name).sort();

  return (
    existing.length === expected.length
    && existing.every((name, index) => name === expected[index])
  );
}

async function demoCardCount(
  teamIds: mongoose.Types.ObjectId[],
): Promise<number> {
  if (teamIds.length === 0) {
    return 0;
  }

  const projects = await ProjectModel.find({
    teamId: { $in: teamIds },
  }).lean();
  const boards = await BoardModel.find({
    projectId: { $in: projects.map((project) => project._id) },
  }).lean();

  return CardModel.countDocuments({
    boardId: { $in: boards.map((board) => board._id) },
  });
}

/**
 * Создаёт демо-команды. Если состав или объём сида изменился — пересоздаёт их.
 */
export async function ensureDemoData(
  ownerId: mongoose.Types.ObjectId,
): Promise<void> {
  const existingIds = await demoTeamIds(ownerId);
  const namesMatch = await demoTeamNamesMatch(existingIds);
  const cardCount = await demoCardCount(existingIds);

  if (namesMatch && cardCount === expectedCardCount()) {
    return;
  }

  for (const teamId of existingIds) {
    await deleteTeamCascade(teamId);
  }

  const users = await upsertDemoUsers(ownerId);
  const createdTeamIds: mongoose.Types.ObjectId[] = [];

  try {
    for (const teamSeed of TEAMS) {
      const team = await TeamModel.create({ name: teamSeed.name });
      createdTeamIds.push(team._id);

      const roleByUser: Record<UserKey, TeamRole | undefined> = {
        demo: undefined,
        anna: undefined,
        ivan: undefined,
        maria: undefined,
        pavel: undefined,
      };

      for (const member of teamSeed.members) {
        roleByUser[member.user] = member.role;
        await TeamMemberModel.create({
          teamId: team._id,
          userId: users[member.user],
          role: member.role,
        });
      }

      for (const projectSeed of teamSeed.projects) {
        await seedProject(team._id, users, roleByUser, projectSeed);
      }
    }
  } catch (err) {
    for (const teamId of createdTeamIds) {
      try {
        await deleteTeamCascade(teamId);
      } catch (rollbackErr) {
        console.error(rollbackErr);
      }
    }

    throw err;
  }
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

/**
 * Пересоздаёт непрочитанные уведомления демо-пользователя на каждый вход.
 */
export async function refreshDemoNotifications(
  ownerId: mongoose.Types.ObjectId,
): Promise<void> {
  await NotificationModel.deleteMany({ recipientId: ownerId });

  const teamIds = await demoTeamIds(ownerId);

  if (teamIds.length === 0) {
    return;
  }

  const [anna, pavel, maria, projects] = await Promise.all([
    UserModel.findOne({ yandexId: 'demo-anna' }).lean(),
    UserModel.findOne({ yandexId: 'demo-pavel' }).lean(),
    UserModel.findOne({ yandexId: 'demo-maria' }).lean(),
    ProjectModel.find({ teamId: { $in: teamIds } }).lean(),
  ]);

  if (!anna || !pavel || !maria || projects.length === 0) {
    return;
  }

  const boards = await BoardModel.find({
    projectId: { $in: projects.map((project) => project._id) },
  }).lean();
  const assigned = await CardModel.find({
    boardId: { $in: boards.map((board) => board._id) },
    assigneeId: ownerId,
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  if (assigned.length === 0) {
    return;
  }

  const firstCard = assigned[0];

  if (!firstCard) {
    return;
  }

  const boardById = new Map(
    boards.map((board) => [board._id.toString(), board]),
  );
  const projectById = new Map(
    projects.map((project) => [project._id.toString(), project]),
  );

  const seeds: Array<{
    actorId: mongoose.Types.ObjectId;
    kind: 'card_assigned' | 'comment_added' | 'comment_reply';
    card: (typeof assigned)[number];
    detail: string;
    createdAt: Date;
  }> = [
    {
      actorId: anna._id,
      kind: 'card_assigned',
      card: firstCard,
      detail: '',
      createdAt: minutesAgo(4),
    },
  ];

  if (assigned[1]) {
    seeds.push({
      actorId: pavel._id,
      kind: 'comment_added',
      card: assigned[1],
      detail: 'Можно взять в работу на этой неделе?',
      createdAt: minutesAgo(18),
    });
  }

  seeds.push({
    actorId: maria._id,
    kind: 'comment_reply',
    card: assigned[assigned.length - 1] ?? firstCard,
    detail: 'Согласен, давай так и сделаем.',
    createdAt: minutesAgo(42),
  });

  const docs = seeds.flatMap((seed) => {
    const board = boardById.get(seed.card.boardId.toString());
    const project = board
      ? projectById.get(board.projectId.toString())
      : undefined;

    if (!board || !project) {
      return [];
    }

    return [{
      recipientId: ownerId,
      actorId: seed.actorId,
      kind: seed.kind,
      teamId: project.teamId,
      projectId: board.projectId,
      boardId: board._id,
      cardId: seed.card._id,
      cardTitle: seed.card.title,
      detail: seed.detail,
      readAt: null,
      createdAt: seed.createdAt,
    }];
  });

  if (docs.length > 0) {
    await NotificationModel.insertMany(docs);
  }
}
