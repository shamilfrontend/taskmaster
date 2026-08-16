import type { BoardBackgroundId } from '../types/index.ts';

export interface BoardBackgroundOption {
  id: BoardBackgroundId;
  label: string;
  thumb: string | null;
  full: string | null;
}

function photo(
  id: BoardBackgroundId,
  label: string,
  fileId: string
): BoardBackgroundOption {
  return {
    id,
    label,
    thumb: `/backgrounds/${fileId}-thumb.jpg`,
    full: `/backgrounds/${fileId}.jpg`
  };
}

export const BOARD_BACKGROUNDS: BoardBackgroundOption[] = [
  photo('default', 'Горный хребет', 'bg-01'),
  photo('bg-01', 'Горный хребет', 'bg-01'),
  photo('bg-02', 'Ночные вершины', 'bg-02'),
  photo('bg-03', 'Снежная вершина', 'bg-03'),
  photo('bg-04', 'Горное озеро', 'bg-04'),
  photo('bg-05', 'Альпы', 'bg-05'),
  photo('bg-06', 'Гребень', 'bg-06'),
  photo('bg-07', 'Долина на закате', 'bg-07'),
  photo('bg-08', 'Зелёные склоны', 'bg-08'),
  photo('bg-09', 'Туманные холмы', 'bg-09'),
  photo('bg-10', 'Скалы', 'bg-10'),
  photo('bg-11', 'Пустынные горы', 'bg-11'),
  photo('bg-12', 'Лесной туман', 'bg-12'),
  photo('bg-13', 'Озеро в горах', 'bg-13'),
  photo('bg-14', 'Тихая заводь', 'bg-14'),
  photo('bg-15', 'Глубина океана', 'bg-15'),
  photo('bg-16', 'Тропический берег', 'bg-16'),
  photo('bg-17', 'Гладкая вода', 'bg-17'),
  photo('bg-18', 'Бирюза', 'bg-18'),
  photo('bg-19', 'Закат у моря', 'bg-19'),
  photo('bg-20', 'Открытый океан', 'bg-20'),
  photo('bg-21', 'Горизонт', 'bg-21'),
  photo('bg-22', 'Волны', 'bg-22'),
  photo('bg-23', 'Побережье', 'bg-23'),
  photo('bg-24', 'Тропики', 'bg-24'),
  photo('bg-25', 'Океан сверху', 'bg-25'),
  photo('bg-26', 'Риф', 'bg-26'),
  photo('bg-27', 'Лес', 'bg-27'),
  photo('bg-28', 'Тропа', 'bg-28'),
  photo('bg-29', 'Сосны', 'bg-29'),
  photo('bg-30', 'Чаща', 'bg-30'),
  photo('bg-31', 'Кроны', 'bg-31'),
  photo('bg-32', 'Пейзаж', 'bg-32'),
  photo('bg-33', 'Луг', 'bg-33'),
  photo('bg-34', 'Поле', 'bg-34'),
  photo('bg-35', 'Солнце в лесу', 'bg-35'),
  photo('bg-36', 'Роща', 'bg-36')
];

const DEFAULT_OPTION: BoardBackgroundOption = photo(
  'default',
  'Горный хребет',
  'bg-01'
);

export function findBoardBackground(
  id: BoardBackgroundId | undefined
): BoardBackgroundOption {
  return BOARD_BACKGROUNDS.find((item) => item.id === id) ?? DEFAULT_OPTION;
}

export function boardBackgroundStyle(
  id: BoardBackgroundId | undefined
): Record<string, string> | undefined {
  const option = findBoardBackground(id);

  if (!option.full) {
    return undefined;
  }

  return {
    '--board-image': `url("${option.full}")`
  };
}
