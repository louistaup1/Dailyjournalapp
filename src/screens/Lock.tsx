import { useState } from 'react';
import { checkPin } from '../lib/pin';

export function Lock({ salt, hash, onUnlock }: { salt: string; hash: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [fails, setFails] = useState(0);
  const [wait, setWait] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wait || !pin) return;
    if (await checkPin(pin, salt, hash)) return onUnlock();
    const n = fails + 1;
    setFails(n);
    setPin('');
    if (n >= 5) {
      setWait(true);
      setMsg('That PIN didn’t match. Wait a moment before trying again.');
      setTimeout(() => setWait(false), 30_000);
    } else setMsg('That PIN didn’t match.');
  };

  return (
    <div className="page">
      <form className="lock" onSubmit={submit}>
        <h1 className="title">Journal</h1>
        <label htmlFor="pin" className="muted">
          Enter your PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn block" type="submit" disabled={wait || pin.length < 4}>
          Open
        </button>
        <p className="muted small" role="status" style={{ marginTop: '1rem', minHeight: '1.5em' }}>
          {msg}
        </p>
      </form>
    </div>
  );
}
