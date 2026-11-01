import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/** Material form field for a number with a unit suffix and error text. */
@Component({
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  selector: 'app-numeric-field',
  styleUrl: './numeric-field.scss',
  templateUrl: './numeric-field.html',
})
export class NumericField {
  readonly control = input.required<FormControl<number | null>>();
  readonly label = input.required<string>();
  readonly unit = input<string>('');
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);
  readonly step = input<number | string>('any');
  readonly hint = input<string>('');
  readonly testId = input<string>('');

  protected errorText(): string {
    const errors = this.control().errors;
    if (!errors) return '';
    if (errors['required'] || errors['numeric']) return 'Enter a number';
    if (errors['min']) return `Must be at least ${errors['min'].min}`;
    if (errors['max']) return `Must be at most ${errors['max'].max}`;
    if (errors['exclusiveMin']) return `Must be greater than ${errors['exclusiveMin'].min}`;
    return 'Invalid value';
  }
}
