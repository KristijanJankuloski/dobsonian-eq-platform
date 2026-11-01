import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkingSketch } from './marking-sketch';

describe('MarkingSketch', () => {
  let fixture: ComponentFixture<MarkingSketch>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MarkingSketch] }).compileComponents();
    fixture = TestBed.createComponent(MarkingSketch);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('title', 'North segment');
    fixture.componentRef.setInput('radiusMm', 462.744);
    fixture.componentRef.setInput('angleDeg', 61.749);
    fixture.componentRef.setInput('cutChordMm', 504.925);
    fixture.componentRef.setInput('testId', 'sketch-north');
    await fixture.whenStable();
  });

  it('renders an accessible SVG with the measurements', () => {
    const svg = el.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toContain('radius 462.7 mm');
    const text = el.textContent!;
    expect(text).toContain('R 462.7 mm');
    expect(text).toContain('61.75°');
    expect(text).toContain('chord 474.9 mm');
    expect(text).toContain('Cut length with margin: 504.9 mm');
  });

  it('draws the arc path and updates when the inputs change', async () => {
    const arc = () => el.querySelector('path.arc')!.getAttribute('d');
    const before = arc();
    expect(before).toContain('A 462.74 462.74');
    fixture.componentRef.setInput('radiusMm', 207.275);
    await fixture.whenStable();
    expect(arc()).toContain('A 207.28 207.28');
    expect(arc()).not.toBe(before);
  });
});
