import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InfoBox, type InfoBoxVariant } from '@/components/InfoBox';

const ALL_VARIANTS: InfoBoxVariant[] = ['info', 'warning', 'success', 'error', 'tip'];

describe('InfoBox', () => {
  it.each(ALL_VARIANTS)('renders %s variant', (variant) => {
    const { container } = render(<InfoBox variant={variant}>Content</InfoBox>);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders children content', () => {
    const { getByText } = render(<InfoBox variant="info">Hello world</InfoBox>);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('defaults to info variant', () => {
    const { container } = render(<InfoBox>Default variant</InfoBox>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('surface-info');
  });

  it('applies surface-warning class for warning variant', () => {
    const { container } = render(<InfoBox variant="warning">Warning</InfoBox>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('surface-warning');
  });

  it('applies surface-error class for error variant', () => {
    const { container } = render(<InfoBox variant="error">Error</InfoBox>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('surface-error');
  });

  it('applies surface-success class for success variant', () => {
    const { container } = render(<InfoBox variant="success">Success</InfoBox>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('surface-success');
  });

  it('renders custom icon override', () => {
    const { getByTestId } = render(
      <InfoBox variant="info" icon={<span data-testid="custom-icon">X</span>}>
        Content
      </InfoBox>
    );
    expect(getByTestId('custom-icon')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <InfoBox variant="info" className="rounded-full">Content</InfoBox>
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
  });
});
