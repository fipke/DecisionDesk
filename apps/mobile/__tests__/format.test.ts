import { formatCurrency } from '../src/utils/format';

describe('formatCurrency', () => {
  it('formata valores em BRL', () => {
    expect(formatCurrency(12.5, 'BRL')).toContain('12');
  });

  it('retorna traço quando valor ausente', () => {
    expect(formatCurrency(null, 'USD')).toBe('—');
  });
});
