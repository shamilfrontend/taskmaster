export interface ProductLink {
  id: string;
  name: string;
  href: string;
  host: string;
  initial: string;
  iconSrc?: string;
  iconBg: string;
}

export const PRODUCT_LINKS: ProductLink[] = [
  {
    id: 'taskmaster',
    name: 'TaskMaster',
    href: 'https://taskmaster.shamilfrontend.ru',
    host: 'taskmaster.shamilfrontend.ru',
    initial: 'T',
    iconSrc: '/logo/kanban.svg',
    iconBg: '#4a6c9b',
  },
  {
    id: 'roundtalk',
    name: 'RoundTalk',
    href: 'https://roundtalk.shamilfrontend.ru',
    host: 'roundtalk.shamilfrontend.ru',
    initial: 'R',
    iconBg: '#3d8f4a',
  },
  {
    id: 'mockapi',
    name: 'MockApi',
    href: 'https://mockapi.shamilfrontend.ru',
    host: 'mockapi.shamilfrontend.ru',
    initial: 'M',
    iconBg: '#7a4ea3',
  },
];
