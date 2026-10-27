// Hermes has no crypto.randomUUID; ../src/domain.ts calls it. Import this module first.
import { randomUUID } from 'expo-crypto';

const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
g.crypto ??= {};
g.crypto.randomUUID ??= randomUUID;
