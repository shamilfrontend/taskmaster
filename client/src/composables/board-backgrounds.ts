import type { BoardBackgroundId } from '../types/index.ts';

export interface BoardBackgroundOption {
  id: BoardBackgroundId;
  label: string;
  thumb: string | null;
  full: string | null;
}

function unsplash(photoId: string, width: number): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

function photo(
  id: BoardBackgroundId,
  label: string,
  photoId: string
): BoardBackgroundOption {
  return {
    id,
    label,
    thumb: unsplash(photoId, 400),
    full: unsplash(photoId, 1920)
  };
}

export const BOARD_BACKGROUNDS: BoardBackgroundOption[] = [
  photo('default', 'Горный хребет', '1464822759023-fed622ff2c3b'),
  photo('bg-01', 'Горный хребет', '1464822759023-fed622ff2c3b'),
  photo('bg-02', 'Ночные вершины', '1519681393784-d120267933ba'),
  photo('bg-03', 'Снежная вершина', '1483728642387-6c3bdd6c93e5'),
  photo('bg-04', 'Горное озеро', '1506905925346-21bda4d32df4'),
  photo('bg-05', 'Альпы', '1454496522488-7a8e488e8606'),
  photo('bg-06', 'Гребень', '1486870591958-9b9d0d1dda99'),
  photo('bg-07', 'Долина на закате', '1469474968028-56623f02e42e'),
  photo('bg-08', 'Зелёные склоны', '1482192505345-5655af888cc4'),
  photo('bg-09', 'Туманные холмы', '1470071459604-3b5ec3a7fe05'),
  photo('bg-10', 'Скалы', '1426604966848-d7adac402bff'),
  photo('bg-11', 'Пустынные горы', '1500534314209-a25ddb2bd429'),
  photo('bg-12', 'Лесной туман', '1418065460487-3e41a6c84dc5'),
  photo('bg-13', 'Озеро в горах', '1501785888041-af3ef285b470'),
  photo('bg-14', 'Тихая заводь', '1470770841072-f978cf4d019e'),
  photo('bg-15', 'Глубина океана', '1505118380757-91f5f5632de0'),
  photo('bg-16', 'Тропический берег', '1507525428034-b723cf961d3e'),
  photo('bg-17', 'Гладкая вода', '1439066615861-d1af74d3bb02'),
  photo('bg-18', 'Бирюза', '1505142468610-359e7d316be0'),
  photo('bg-19', 'Закат у моря', '1471922694854-ff1b63b20054'),
  photo('bg-20', 'Открытый океан', '1518837695005-2083093ee35b'),
  photo('bg-21', 'Горизонт', '1468581264429-2548fb9d2adf'),
  photo('bg-22', 'Волны', '1513553404607-988bf2703777'),
  photo('bg-23', 'Побережье', '1476673160081-cf065307f649'),
  photo('bg-24', 'Тропики', '1473116763249-2faa1670543a'),
  photo('bg-25', 'Океан сверху', '1559827260-dc66d52bef19'),
  photo('bg-26', 'Риф', '1540206395-68808572332d'),
  photo('bg-27', 'Лес', '1441974231531-c6227db76b6e'),
  photo('bg-28', 'Тропа', '1511497584788-876760111969'),
  photo('bg-29', 'Сосны', '1448375240586-882707db888b'),
  photo('bg-30', 'Чаща', '1518173946687-a4c8892ce6f4'),
  photo('bg-31', 'Кроны', '1542273917363-3b1817f69a2d'),
  photo('bg-32', 'Пейзаж', '1472214103451-9374bd1c798e'),
  photo('bg-33', 'Луг', '1502082553048-f009c37129b9'),
  photo('bg-34', 'Поле', '1447758902204-48010b87c681'),
  photo('bg-35', 'Солнце в лесу', '1518495973542-8260c5370d4a'),
  photo('bg-36', 'Роща', '1476237832082-62712219bb4d')
];

const DEFAULT_OPTION: BoardBackgroundOption = photo(
  'default',
  'Горный хребет',
  '1464822759023-fed622ff2c3b'
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
