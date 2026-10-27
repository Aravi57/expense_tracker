import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signIn = vi.fn();
const signUp = vi.fn();
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ signIn, signUp }) }));
const { default: Login } = await import('./Login');

beforeEach(() => {
  signIn.mockReset().mockResolvedValue(undefined);
  signUp.mockReset().mockResolvedValue(undefined);
});

describe('Login screen', () => {
  it('signs in with username and password', async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.type(screen.getByLabelText('Username'), 'Aravindh57');
    await user.type(screen.getByLabelText('Password'), 'whatever1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn).toHaveBeenCalledWith('Aravindh57', 'whatever1');
  });

  it('shows the error from a failed sign-in on the page', async () => {
    signIn.mockRejectedValue(new Error('Incorrect username or password'));
    const user = userEvent.setup();
    render(<Login />);
    await user.type(screen.getByLabelText('Username'), 'nobody');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password');
  });

  it('checks sign-up details before creating an account', async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.click(screen.getByRole('radio', { name: 'Sign up' }));
    await user.type(screen.getByLabelText('Full name'), 'Test User');
    await user.type(screen.getByLabelText('Username'), 'ab'); // too short
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Username: 4–30');
    expect(signUp).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Username'));
    await user.type(screen.getByLabelText('Username'), 'test.user');
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'Different1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('don’t match');

    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(signUp).toHaveBeenCalledWith('Test User', 'test.user', 'Password1');
  });

  it('ticks off password rules as they are met', async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.click(screen.getByRole('radio', { name: 'Sign up' }));
    expect(screen.getByText(/At least 8 characters/)).toHaveTextContent('○');
    await user.type(screen.getByLabelText('Password'), 'Abcdefg1');
    expect(screen.getByText(/At least 8 characters/)).toHaveTextContent('✓');
    expect(screen.getByText(/A number/)).toHaveTextContent('✓');
  });
});
