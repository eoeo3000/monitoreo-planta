import { render, screen } from '@testing-library/react';
import App from './App';

test('renders analista screen with equipment table', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: /CONDICIÓN DE ACTIVOS/i })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /TAG/i })).toBeInTheDocument();
});
