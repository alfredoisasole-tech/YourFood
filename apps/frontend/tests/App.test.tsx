import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../src/App';

describe('Frontend : Composant App', () => {
  it('affiche le titre YourFood et le message de bienvenue', () => {
    render(<App />);
    expect(screen.getByText('YourFood')).toBeDefined();
    expect(screen.getByText('Bienvenue sur YourFood')).toBeDefined();
  });
});
