import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { axe } from '../test/setup.js';
import MaintenanceScreen from './MaintenanceScreen.jsx';

describe('MaintenanceScreen', () => {
  test('shows the maintenance message accessibly', async () => {
    const { container } = render(<MaintenanceScreen />);

    expect(
      screen.getByRole('heading', {
        name: '잠시 쇼핑을 멈추고 더 나은 서비스를 준비 중이에요',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('서비스 점검 중');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
