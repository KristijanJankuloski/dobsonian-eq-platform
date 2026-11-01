import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from './clipboard';

describe('Clipboard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('copies the text and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const open = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    await TestBed.inject(Clipboard).copy('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(open).toHaveBeenCalledWith('Copied to clipboard', undefined, { duration: 2000 });
  });

  it('reports a failure instead of throwing', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const open = vi.spyOn(TestBed.inject(MatSnackBar), 'open');
    await expect(TestBed.inject(Clipboard).copy('x')).resolves.toBeUndefined();
    expect(open).toHaveBeenCalledWith('Could not copy', undefined, { duration: 3000 });
  });
});
