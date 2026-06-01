import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats integer cents as US currency, e.g. 600 -> "$6.00".
 * Usage in a template: {{ item.priceCents | cents }}
 */
@Pipe({ name: 'cents' })
export class CentsPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    const value = (cents ?? 0) / 100;
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }
}
