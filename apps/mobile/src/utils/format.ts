import { MeetingStatus } from '../types';

export function formatDate(iso: string) {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  } catch (error) {
    return iso;
  }
}

export function formatCurrency(value?: number | null, currency: 'USD' | 'BRL' = 'BRL') {
  if (value === undefined || value === null) {
    return '—';
  }
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency
    }).format(value);
  } catch (error) {
    const symbol = currency === 'USD' ? 'US$' : 'R$';
    return `${symbol} ${value.toFixed(2)}`;
  }
}

export function translateStatus(status: MeetingStatus) {
  switch (status) {
    case 'PENDING_SYNC':
      return 'Pendente de sincronização';
    case 'NEW':
      return 'Aguardando transcrição';
    case 'PROCESSING':
      return 'Transcrevendo';
    case 'DONE':
      return 'Concluída';
    case 'ERROR':
    default:
      return 'Erro';
  }
}
