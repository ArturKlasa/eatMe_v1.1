import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SectionCard } from '@/components/SectionCard';

describe('SectionCard', () => {
  it('renders title', () => {
    const { getByText } = render(
      <SectionCard title="My Section">Content</SectionCard>
    );
    expect(getByText('My Section')).toBeTruthy();
  });

  it('renders description when provided', () => {
    const { getByText } = render(
      <SectionCard title="Title" description="A description">Content</SectionCard>
    );
    expect(getByText('A description')).toBeTruthy();
  });

  it('renders children for non-collapsible card', () => {
    const { getByText } = render(
      <SectionCard title="Title">Child content</SectionCard>
    );
    expect(getByText('Child content')).toBeTruthy();
  });

  it('renders action slot', () => {
    const { getByTestId } = render(
      <SectionCard title="Title" action={<button data-testid="action-btn">Edit</button>}>
        Content
      </SectionCard>
    );
    expect(getByTestId('action-btn')).toBeTruthy();
  });

  it('renders collapsible with children expanded by default', () => {
    const { getByText } = render(
      <SectionCard title="Title" collapsible defaultExpanded>
        Collapsible content
      </SectionCard>
    );
    expect(getByText('Collapsible content')).toBeTruthy();
  });

  it('toggles collapsible section on trigger click', () => {
    const { getByRole } = render(
      <SectionCard title="Title" collapsible defaultExpanded>
        Toggleable content
      </SectionCard>
    );
    const trigger = getByRole('button', { name: /collapse section/i });
    fireEvent.click(trigger);
    // After collapse trigger, button label changes
    expect(getByRole('button', { name: /expand section/i })).toBeTruthy();
  });

  it('renders collapsed by default when defaultExpanded=false', () => {
    const { getByRole } = render(
      <SectionCard title="Title" collapsible defaultExpanded={false}>
        Hidden content
      </SectionCard>
    );
    expect(getByRole('button', { name: /expand section/i })).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const { getByTestId } = render(
      <SectionCard title="Title" icon={<span data-testid="section-icon">★</span>}>
        Content
      </SectionCard>
    );
    expect(getByTestId('section-icon')).toBeTruthy();
  });
});
