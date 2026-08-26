import { render, screen } from '@testing-library/react';
import App from './App';

test('renders plant heat map view by default', () => {
  render(<App />);
  const heading = screen.getByText(/Mapa de calor de planta/i);
  expect(heading).toBeInTheDocument();
});
