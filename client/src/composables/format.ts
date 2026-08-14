export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function formatMoney(value: number | undefined): string {
  if (value === undefined) {
    return '—';
  }

  return `${value.toLocaleString('ru-RU')} ₽`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function daysLeft(iso: string): string {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0) {
    return `просрочен на ${-diff} дн.`;
  }

  if (diff === 0) {
    return 'сегодня';
  }

  return `через ${diff} дн.`;
}

export function roleClass(role: string): string {
  if (role === 'owner') {
    return 'badge badge-owner';
  }

  if (role === 'admin') {
    return 'badge badge-admin';
  }

  if (role === 'member') {
    return 'badge badge-member';
  }

  return 'badge badge-viewer';
}

export function labelClass(color: string): string {
  return `label label-${color}`;
}

export function avatarClass(role: string): string {
  if (role === 'admin') {
    return 'avatar admin';
  }

  if (role === 'member') {
    return 'avatar member';
  }

  if (role === 'viewer') {
    return 'avatar viewer';
  }

  return 'avatar';
}
