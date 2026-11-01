import { TestBed } from '@angular/core/testing';
import { FileDownload } from './file-download';

describe('FileDownload', () => {
  it('clicks a temporary download link and cleans up', () => {
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    TestBed.inject(FileDownload).save('a.svg', '<svg/>');
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
