import { render, screen } from '@testing-library/react';
import App from './App';

test('renders analista screen with plant tree', () => {
  render(<App />);
  const heading = screen.getByText(/Selecciona un equipo/i);
  expect(heading).toBeInTheDocument();
});
