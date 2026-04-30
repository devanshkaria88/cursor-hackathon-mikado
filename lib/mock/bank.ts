// docs/backend.md §Mock bank
// Single in-memory MockBank singleton. Module-level state survives across
// API route invocations within a single Next.js dev server process.

type Tx = { supplier: string; amount: number; at: string };

class MockBank {
  balance = 100_000;
  history: Tx[] = [];

  pay(supplier: string, amount: number) {
    this.balance -= amount;
    this.history.push({
      supplier,
      amount,
      at: new Date().toISOString(),
    });
  }

  reset() {
    this.balance = 100_000;
    this.history = [];
  }
}

export const bank = new MockBank();
