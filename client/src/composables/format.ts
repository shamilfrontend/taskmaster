const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes HTML and wraps http(s) URLs in safe anchor tags. */
export function linkifyText(text: string): string {
  const escaped = escapeHtml(text);

  return escaped.replace(URL_PATTERN, (rawUrl) => {
    const trailing = rawUrl.match(/[.,;:!?)]+$/);
    const url = trailing ? rawUrl.slice(0, -trailing[0].length) : rawUrl;
    const suffix = trailing ? trailing[0] : '';

    if (!url) {
      return rawUrl;
    }

    return (
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${
        suffix}`
    );
  });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
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
    year: 'numeric',
  });
}

export function isOverdue(
  dueDate: string | Date | null | undefined,
  isDone: boolean,
): boolean {
  if (!dueDate || isDone) {
    return false;
  }

  const due = new Date(dueDate);

  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return due.getTime() < today.getTime();
}

export function roleLabel(role: string): string {
  if (role === 'owner') {
    return 'Владелец';
  }

  if (role === 'admin') {
    return 'Админ';
  }

  if (role === 'member') {
    return 'Участник';
  }

  if (role === 'viewer') {
    return 'Наблюдатель';
  }

  return role;
}

/** Russian plural: 1 участник, 2 участника, 5 участников */
export function pluralRu(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) {
    return `${count} ${many}`;
  }

  if (last === 1) {
    return `${count} ${one}`;
  }

  if (last >= 2 && last <= 4) {
    return `${count} ${few}`;
  }

  return `${count} ${many}`;
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
